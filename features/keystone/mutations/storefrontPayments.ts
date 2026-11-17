import type { Context } from '.keystone/types'

import { createStripeCheckoutSession, expireStripeCheckoutSession, refundStripePaymentIntent, retrieveStripeCheckoutSession, stripeSecretKey, type StripeCheckoutSession } from '../../integrations/payment/stripe'
import { DomainError } from '../lib/domain-error'
import { assertDatedFlightEligibleForAction } from '../lib/service-eligibility'
import { consumeDurableRateLimit } from '../lib/rate-limit'
import { durableRequestFingerprint } from '../lib/request-identity'
import { runSerializableTransaction, throwIfKeystonePrismaError } from '../lib/transactions'
import { beginOperation, finishOperation, inspectOperation, randomReference, writeAudit } from './airlineOperations'
import { issueBookingTicketsInTransaction } from './airlineWorkflows'
import { expireUnpaidBookings } from '../../integrations/booking-expiry'
import { isConfiguredPublicCarrier, ownedBooking } from './storefront'

// Online card payment for storefront reservations through Stripe Checkout. A carrier turns it on by activating a
// Stripe PaymentProvider with a secret key on the Payment providers page; until then bookings are paid to the
// airline and recorded by an operator.

export async function activeStripeProvider(prisma: any, carrierId: string) {
  const providers = await prisma.paymentProvider.findMany({
    where: { carrierId, adapterType: 'stripe', status: 'active' },
    orderBy: [{ providerKey: 'asc' }],
    take: 5,
    select: { id: true, providerKey: true, credentials: true },
  })
  const provider = providers.find((candidate: any) => stripeSecretKey(candidate.credentials))
  return provider ? { id: provider.id as string, providerKey: provider.providerKey as string, secretKey: stripeSecretKey(provider.credentials)! } : null
}

export async function onlinePaymentEnabled(prisma: any, carrierId: string) {
  return Boolean(await activeStripeProvider(prisma, carrierId))
}

// Public origin for Stripe's return links: the configured store link or Railway domain, else this request's host.
function storefrontOrigin(context: Context) {
  if (process.env.SMTP_STORE_LINK) return process.env.SMTP_STORE_LINK.replace(/\/+$/, '')
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  const headers = ((context as any).req?.headers ?? {}) as Record<string, string | string[] | undefined>
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.split(',')[0]?.trim()
  const host = first(headers['x-forwarded-host']) || first(headers.host)
  if (!host || !/^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(host)) throw new DomainError('Online payment isn’t available right now.')
  const protocol = first(headers['x-forwarded-proto']) === 'http' || host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'
  return `${protocol}://${host}`
}

const BOOKING_SELECT = {
  id: true, carrierId: true, recordLocator: true, status: true, paymentStatus: true, ticketingStatus: true, totalAmount: true, currencyCode: true, contactEmail: true, metadata: true,
  segments: { select: { status: true, flightInstance: { select: { id: true, status: true, scheduledDepartureAt: true, estimatedDepartureAt: true, actualDepartureAt: true, actualArrivalAt: true } } } },
} as const

const STRIPE_MIN_EXPIRY_MS = 31 * 60_000

async function payableBooking(context: Context, carrierCode: string, recordLocator: string, accessToken: string) {
  if (!await isConfiguredPublicCarrier((context as any).prisma, carrierCode)) throw new DomainError('Carrier is unavailable on this storefront.')
  const owned = await ownedBooking(context, recordLocator, accessToken)
  const booking = await (context.prisma as any).booking.findUnique({
    where: { id: owned.id },
    select: BOOKING_SELECT,
  })
  if (!booking || booking.carrierId !== owned.carrier.id) throw new DomainError('Booking not found or inaccessible.')
  return { booking, carrier: owned.carrier as { id: string; code: string; name: string } }
}

export async function startCustomerCheckout(
  _root: unknown,
  args: { carrierCode: string; recordLocator: string; accessToken: string },
  context: Context,
) {
  const { booking, carrier } = await payableBooking(context, args.carrierCode, args.recordLocator, args.accessToken)
  if (booking.status === 'cancelled') throw new DomainError('Cancelled bookings can’t be paid.')
  if (!['unpaid', 'failed'].includes(booking.paymentStatus)) throw new DomainError('This booking is already paid.')
  const dueAt = Date.parse(booking.metadata?.paymentDueAt ?? '')
  if (Number.isFinite(dueAt) && dueAt <= Date.now()) {
    // Past its deadline: record a stored paid session, else release the seats now, on the request that touches the booking.
    const unsettled = await settleStoredCheckouts(context, booking.id)
    if (!unsettled.size) await expireUnpaidBookings(context.prisma as any, 1, booking.id)
    throw new DomainError('The payment window for this reservation has closed. Contact the airline.')
  }
  // Only a booking whose flights can still be ticketed may be paid.
  const current = booking.segments.filter((segment: any) => !['reaccommodated', 'cancelled', 'refunded'].includes(String(segment.status)))
  if (!current.length || current.some((segment: any) => segment.status !== 'confirmed')) throw new DomainError('This booking’s flight changed. Contact the airline before paying.')
  for (const segment of current) assertDatedFlightEligibleForAction(segment.flightInstance, 'Payment')
  const provider = await activeStripeProvider(context.prisma, carrier.id)
  if (!provider) throw new DomainError('Online payment isn’t available for this airline.')
  // One payable session at a time: close the last one, and if it was already paid, record that instead.
  const previous = typeof booking.metadata?.checkoutSessionId === 'string' ? booking.metadata.checkoutSessionId : ''
  if (previous) {
    const settled = await closeOrSettleSession(context, booking, carrier, provider, previous).catch(error => {
      if (error instanceof DomainError) throw error
      console.error('Previous Stripe checkout could not be closed:', error instanceof Error ? error.message : 'unknown error')
      throw new DomainError('Online payment couldn’t start. Try again in a moment.')
    })
    if (settled === 'paid') throw new DomainError('This booking is already paid.')
  }
  const firstDeparture = Math.min(...current.map((segment: any) => Date.parse(segment.flightInstance?.scheduledDepartureAt ?? '')).filter(Number.isFinite))
  // A Checkout session stays open at least 30 minutes, so online payment closes that long before departure.
  if (!(firstDeparture > Date.now() + STRIPE_MIN_EXPIRY_MS)) throw new DomainError('Online payment has closed for this flight. Contact the airline.')
  const closesAt = Math.min(Number.isFinite(dueAt) ? dueAt : Infinity, firstDeparture, Date.now() + 24 * 60 * 60_000)
  const expiresAt = Math.ceil(Math.max(closesAt, Date.now() + STRIPE_MIN_EXPIRY_MS) / 60_000) * 60
  await consumeDurableRateLimit(context.prisma as any, 'storefront.checkout.client', durableRequestFingerprint((context as any).req ?? {}), 20, 15 * 60_000)
  const origin = storefrontOrigin(context)
  const locator = encodeURIComponent(booking.recordLocator)
  let session: StripeCheckoutSession
  try {
    session = await createStripeCheckoutSession(provider.secretKey, {
      bookingId: booking.id,
      recordLocator: booking.recordLocator,
      description: `${carrier.name} reservation ${booking.recordLocator}`,
      amount: booking.totalAmount,
      currencyCode: booking.currencyCode,
      customerEmail: booking.contactEmail,
      successUrl: `${origin}/manage-booking?ref=${locator}&checkout={CHECKOUT_SESSION_ID}#code=${encodeURIComponent(args.accessToken)}`,
      cancelUrl: `${origin}/manage-booking?ref=${locator}&checkout=cancelled`,
      // One Checkout session per booking amount and previous session: double clicks reuse it.
      idempotencyKey: `checkout:${booking.id}:${booking.totalAmount}:${previous || 'first'}:${expiresAt}`,
      // The session stops taking payment when the reservation closes (Stripe needs at least 30 minutes).
      expiresAt,
    })
  } catch (error) {
    console.error('Stripe checkout could not start:', error instanceof Error ? error.message : 'unknown error')
    throw new DomainError('Online payment couldn’t start. Try again in a moment.')
  }
  if (!session.url) throw new DomainError('Online payment couldn’t start. Try again in a moment.')
  // Remembered so returning to Manage booking can finish a payment even if the redirect back was lost.
  await (context.prisma as any).booking.update({ where: { id: booking.id }, data: { metadata: { ...(booking.metadata ?? {}), checkoutSessionId: session.id } } })
  return { url: session.url, checkoutSessionId: session.id }
}

export async function completeCustomerCheckout(
  _root: unknown,
  args: { carrierCode: string; recordLocator: string; accessToken: string; checkoutSessionId?: string | null },
  context: Context,
) {
  const { booking, carrier } = await payableBooking(context, args.carrierCode, args.recordLocator, args.accessToken)
  const sessionId = args.checkoutSessionId?.trim() || (typeof booking.metadata?.checkoutSessionId === 'string' ? booking.metadata.checkoutSessionId : '')
  if (booking.paymentStatus === 'paid') return { status: 'paid', ticketingStatus: booking.ticketingStatus }
  if (!sessionId) return { status: 'none', ticketingStatus: booking.ticketingStatus }
  const provider = await activeStripeProvider(context.prisma, carrier.id)
  if (!provider) return { status: 'none', ticketingStatus: booking.ticketingStatus }
  let session: StripeCheckoutSession
  try {
    session = await retrieveStripeCheckoutSession(provider.secretKey, sessionId)
  } catch {
    throw new DomainError('We couldn’t confirm your payment yet. Retrieve your booking again in a moment.')
  }
  return recordCheckoutSession(context, booking, carrier, provider, session)
}

/** Close an open Checkout session, or record it if it was paid. Returns what the session turned out to be. */
async function closeOrSettleSession(context: Context, booking: any, carrier: any, provider: any, sessionId: string): Promise<'paid' | 'closed'> {
  try { await expireStripeCheckoutSession(provider.secretKey, sessionId) } catch { /* already complete or expired: read it below */ }
  const session = await retrieveStripeCheckoutSession(provider.secretKey, sessionId)
  if (session.payment_status !== 'paid') return 'closed'
  await recordCheckoutSession(context, booking, carrier, provider, session)
  return 'paid'
}

/**
 * Before overdue unpaid bookings are expired, settle the Checkout session each one stored: a paid session is recorded
 * (so the booking is kept), an open one is closed (so it can no longer be paid). Bounded; a Stripe error leaves the booking
 * to the next pass rather than expiring it with money possibly taken.
 */
export async function settleStoredCheckouts(context: Context, bookingId?: string): Promise<Set<string>> {
  const prisma = context.prisma as any
  const unsettled = new Set<string>()
  const bookings = await prisma.booking.findMany({
    where: { ...(bookingId ? { id: bookingId } : {}), status: 'pending', paymentStatus: { in: ['unpaid', 'failed'] }, metadata: { path: ['checkoutSessionId'], string_starts_with: 'cs_' } },
    select: BOOKING_SELECT, orderBy: { createdAt: 'asc' }, take: 100,
  })
  for (const booking of bookings) {
    const dueAt = Date.parse(booking.metadata?.paymentDueAt ?? '')
    if (!Number.isFinite(dueAt) || dueAt > Date.now()) continue
    try {
      const carrier = await prisma.carrier.findUnique({ where: { id: booking.carrierId }, select: { id: true, code: true, name: true } })
      const provider = await activeStripeProvider(prisma, booking.carrierId)
      if (!carrier || !provider) { unsettled.add(booking.id); continue }
      await closeOrSettleSession(context, booking, carrier, provider, booking.metadata.checkoutSessionId)
    } catch (error) {
      unsettled.add(booking.id)
      console.error(`Checkout session for overdue booking ${booking.id} could not be settled:`, error instanceof Error ? error.message : 'unknown error')
    }
  }
  return unsettled
}

async function recordCheckoutSession(context: Context, booking: any, carrier: { id: string; code: string; name: string }, provider: { id: string; secretKey: string }, session: StripeCheckoutSession) {
  // The session must be this booking's, for its exact amount and currency, and paid.
  if (session.client_reference_id !== booking.id || session.metadata?.bookingId !== booking.id) throw new DomainError('This payment doesn’t belong to this booking.')
  if (session.payment_status !== 'paid') return { status: session.status === 'expired' ? 'expired' : 'pending', ticketingStatus: booking.ticketingStatus }
  if (session.amount_total !== booking.totalAmount || session.currency?.toUpperCase() !== booking.currencyCode) throw new DomainError('The paid amount doesn’t match this booking. Contact the airline.')
  const intent = typeof session.payment_intent === 'string' ? { id: session.payment_intent, latest_charge: null } : session.payment_intent
  if (!intent?.id) throw new DomainError('We couldn’t confirm your payment yet. Retrieve your booking again in a moment.')
  const charge = intent.latest_charge && typeof intent.latest_charge === 'object' ? intent.latest_charge : null
  const card = charge?.payment_method_details?.card

  // 1. Record the payment. This commits on its own so a paid booking is never lost to a later ticketing problem.
  const recorded = await runSerializableTransaction(context, async (transactionContext): Promise<'late' | void> => {
    const sudo = transactionContext.sudo() as any
    const lock = await transactionContext.prisma.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id} FOR UPDATE`
    throwIfKeystonePrismaError(lock)
    const key = `stripe-checkout:${session.id}`
    const request = { bookingId: booking.id, checkoutSessionId: session.id, paymentIntentId: intent.id, amount: booking.totalAmount, currencyCode: booking.currencyCode }
    const inspected = await inspectOperation(sudo, carrier.id, key, 'payment.checkout', request)
    if (inspected.replay) return
    const current = await (transactionContext.prisma as any).booking.findUnique({ where: { id: booking.id }, select: { status: true, paymentStatus: true, payments: { select: { providerPaymentId: true } } } })
    if (!current) throw new DomainError('Booking not found or inaccessible.')
    if (current.payments.some((payment: any) => payment.providerPaymentId === intent.id)) return
    if (current.status === 'cancelled' || !['unpaid', 'failed'].includes(current.paymentStatus)) return 'late'
    const claim = await beginOperation(sudo, transactionContext, carrier.id, key, 'payment.checkout', request)
    if (claim.replay) return
    const now = new Date().toISOString()
    const payment = await sudo.query.Payment.createOne({
      data: {
        carrier: { connect: { id: carrier.id } }, paymentKey: `PAY-${randomReference('', 12)}`, idempotencyKey: claim.storageKey,
        booking: { connect: { id: booking.id } }, provider: { connect: { id: provider.id } },
        status: 'captured', amount: booking.totalAmount, authorizedAmount: booking.totalAmount, capturedAmount: booking.totalAmount, currencyCode: booking.currencyCode,
        providerPaymentId: intent.id, providerCaptureId: charge?.id ?? '', instrumentBrand: card?.brand ?? 'card', instrumentLast4: card?.last4 && /^\d{4}$/.test(card.last4) ? card.last4 : null,
        authorizedAt: now, capturedAt: now, rawProviderData: { checkoutSessionId: session.id, paymentIntentId: intent.id, chargeId: charge?.id ?? null },
        metadata: { adapterType: 'stripe', purchaseKind: 'booking', checkoutSessionId: session.id },
      }, query: 'id',
    })
    await sudo.query.Booking.updateOne({ where: { id: booking.id }, data: { paymentStatus: 'paid', ...(current.status === 'pending' ? { status: 'confirmed', confirmedAt: now } : {}) } })
    await writeAudit(sudo, transactionContext, {
      carrierId: carrier.id, key: claim.storageKey, action: 'payment.checkout', aggregateType: 'Booking', aggregateId: booking.id,
      after: { paymentStatus: 'paid', amount: booking.totalAmount, currencyCode: booking.currencyCode }, metadata: { paymentId: payment.id, providerId: provider.id },
    })
    await finishOperation(sudo, claim.record.id, { resourceType: 'Payment', resourceId: payment.id, status: 'captured', changed: true, replayed: false })
  })
  if (recorded === 'late') {
    // Money for a booking that expired, was cancelled or was already paid: give it back and leave a record.
    const refund = await refundStripePaymentIntent(provider.secretKey, intent.id, `late-checkout-refund:${intent.id}`).catch(error => {
      console.error(`Late Stripe payment ${intent.id} for booking ${booking.id} could not be refunded:`, error instanceof Error ? error.message : 'unknown error')
      return null
    })
    const eventKey = `checkout-late-payment:${intent.id}`
    await (context.prisma as any).auditEvent.upsert({ where: { eventKey }, update: refund ? { action: 'payment.late-refunded', afterSummary: { refunded: true, refundId: refund.id } } : {}, create: {
      carrierId: carrier.id, eventKey, action: refund ? 'payment.late-refunded' : 'payment.late-unrefunded', aggregateType: 'Booking', aggregateId: booking.id, source: 'storefront',
      beforeSummary: {}, afterSummary: { refunded: Boolean(refund), refundId: refund?.id ?? null }, metadata: { checkoutSessionId: session.id, paymentIntentId: intent.id, amount: session.amount_total, currencyCode: booking.currencyCode }, occurredAt: new Date(),
    } })
    throw new DomainError(refund ? 'Your payment arrived after this reservation closed, so it has been refunded to your card.' : 'Your payment was received but the booking changed. Contact the airline.')
  }

  // 2. Issue tickets so seats and check-in open straight away. If issuance is blocked, the booking stays paid
  //    and an operator issues tickets from the Bookings desk.
  let ticketingStatus = 'not_ticketed'
  try {
    await runSerializableTransaction(context, transactionContext => issueBookingTicketsInTransaction(transactionContext, { bookingId: booking.id, idempotencyKey: `checkout-ticketing:${session.id}` }, { authorize: false }))
    ticketingStatus = 'ticketed'
  } catch (error) {
    const latest = await (context.prisma as any).booking.findUnique({ where: { id: booking.id }, select: { ticketingStatus: true } })
    ticketingStatus = latest?.ticketingStatus ?? 'not_ticketed'
    if (ticketingStatus !== 'ticketed') console.error(`Tickets for paid booking ${booking.id} need operator issuance:`, error instanceof Error ? error.message : 'unknown error')
  }
  return { status: 'paid', ticketingStatus }
}
