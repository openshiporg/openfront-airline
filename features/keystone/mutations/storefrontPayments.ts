import type { Context } from '.keystone/types'

import { createStripeCheckoutSession, retrieveStripeCheckoutSession, stripeSecretKey, type StripeCheckoutSession } from '../../integrations/payment/stripe'
import { DomainError } from '../lib/domain-error'
import { consumeDurableRateLimit } from '../lib/rate-limit'
import { durableRequestFingerprint } from '../lib/request-identity'
import { runSerializableTransaction, throwIfKeystonePrismaError } from '../lib/transactions'
import { beginOperation, finishOperation, inspectOperation, randomReference, writeAudit } from './airlineOperations'
import { issueBookingTicketsInTransaction } from './airlineWorkflows'
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

async function payableBooking(context: Context, carrierCode: string, recordLocator: string, accessToken: string) {
  if (!await isConfiguredPublicCarrier((context as any).prisma, carrierCode)) throw new DomainError('Carrier is unavailable on this storefront.')
  const owned = await ownedBooking(context, recordLocator, accessToken)
  const booking = await (context.prisma as any).booking.findUnique({
    where: { id: owned.id },
    select: { id: true, carrierId: true, recordLocator: true, status: true, paymentStatus: true, ticketingStatus: true, totalAmount: true, currencyCode: true, contactEmail: true, metadata: true },
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
  if (Number.isFinite(dueAt) && dueAt <= Date.now()) throw new DomainError('The payment window for this reservation has closed. Contact the airline.')
  const provider = await activeStripeProvider(context.prisma, carrier.id)
  if (!provider) throw new DomainError('Online payment isn’t available for this airline.')
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
      successUrl: `${origin}/manage-booking?ref=${locator}&checkout={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/manage-booking?ref=${locator}&checkout=cancelled`,
      // One Checkout session per booking amount and ten-minute window: double clicks reuse it.
      idempotencyKey: `checkout:${booking.id}:${booking.totalAmount}:${Math.floor(Date.now() / 600_000)}`,
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
  // The session must be this booking's, for its exact amount and currency, and paid.
  if (session.client_reference_id !== booking.id || session.metadata?.bookingId !== booking.id) throw new DomainError('This payment doesn’t belong to this booking.')
  if (session.payment_status !== 'paid') return { status: session.status === 'expired' ? 'expired' : 'pending', ticketingStatus: booking.ticketingStatus }
  if (session.amount_total !== booking.totalAmount || session.currency?.toUpperCase() !== booking.currencyCode) throw new DomainError('The paid amount doesn’t match this booking. Contact the airline.')
  const intent = typeof session.payment_intent === 'string' ? { id: session.payment_intent, latest_charge: null } : session.payment_intent
  if (!intent?.id) throw new DomainError('We couldn’t confirm your payment yet. Retrieve your booking again in a moment.')
  const charge = intent.latest_charge && typeof intent.latest_charge === 'object' ? intent.latest_charge : null
  const card = charge?.payment_method_details?.card

  // 1. Record the payment. This commits on its own so a paid booking is never lost to a later ticketing problem.
  await runSerializableTransaction(context, async transactionContext => {
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
    if (current.status === 'cancelled' || !['unpaid', 'failed'].includes(current.paymentStatus)) {
      console.error(`Stripe payment ${intent.id} arrived for booking ${booking.id} in state ${current.status}/${current.paymentStatus}; needs operator refund review.`)
      throw new DomainError('Your payment was received but the booking changed. Contact the airline.')
    }
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
