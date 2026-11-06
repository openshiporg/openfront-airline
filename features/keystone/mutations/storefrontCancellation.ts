import type { Context } from '.keystone/types'

import { DomainError } from '../lib/domain-error'
import { formatMinorUnits } from '../lib/money'
import { hashStorefrontToken, withStorefrontSession } from '../lib/storefront-session'
import { runSerializableTransaction } from '../lib/transactions'
import { quoteCustomerCancellation, type CancellationQuote } from '../../airline/lib/cancellation-policy'
import { cancelBookingInTransaction, normalizeIdempotencyKey } from './airlineOperations'
import { processBookingRefundInTransaction } from './airlineWorkflows'
import { sendBookingNotice } from '../lib/booking-notices'
import { ownedBooking } from './storefront'

// Self-service cancellation for travelers: quote what they get back, then refund the card and cancel in one
// transaction, so a cancel can never strand captured airfare and a refund never happens without the cancel.

async function cancellationFacts(prisma: any, bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true, status: true, paymentStatus: true, createdAt: true, currencyCode: true, contactEmail: true, recordLocator: true,
      carrier: { select: { id: true, name: true, code: true } },
      segments: { select: { status: true, flightInstance: { select: { scheduledDepartureAt: true } } } },
      payments: { select: { id: true, status: true, capturedAmount: true, refundedAmount: true, metadata: true, provider: { select: { adapterType: true } } } },
      lineItems: { where: { itemType: 'flight' }, select: { sourceOfferItem: { select: { fareRule: { select: { isRefundable: true, cancellationFeeAmount: true } }, fareBrand: { select: { refundabilitySummary: true } } } } } },
    },
  })
  if (!booking) throw new DomainError('Booking not found or inaccessible.')
  const departures = booking.segments.filter((segment: any) => !['cancelled', 'refunded', 'reaccommodated'].includes(segment.status) && segment.flightInstance)
    .map((segment: any) => new Date(segment.flightInstance.scheduledDepartureAt).getTime()).filter(Number.isFinite)
  const farePayments = booking.payments.filter((payment: any) => (payment.metadata?.purchaseKind ?? 'booking') !== 'seat' && ['captured', 'partially_refunded'].includes(payment.status))
  const paidAmount = farePayments.reduce((sum: number, payment: any) => sum + payment.capturedAmount - payment.refundedAmount, 0)
  const quote = quoteCustomerCancellation({
    bookedAt: new Date(booking.createdAt),
    firstDepartureAt: new Date(departures.length ? Math.min(...departures) : NaN),
    now: new Date(),
    paidAmount,
    fareRules: booking.lineItems.map((item: any) => item.sourceOfferItem?.fareRule ?? null),
    // Without a fare rule the fare brand is the policy; a brand that says refunds need operator processing is
    // treated as non-refundable online, so those travelers are sent to the airline rather than refunded blind.
    fallbackRefundable: false,
  })
  const cardOnly = farePayments.every((payment: any) => payment.provider?.adapterType === 'stripe')
  return { booking, quote, farePayments, cardOnly }
}

function quoteResult(quote: CancellationQuote, currencyCode: string, status: string, cardOnly: boolean) {
  if (status === 'cancelled') return { allowed: false, reason: 'already_cancelled', refundAmount: 0, feeAmount: 0, currencyCode, summary: 'This booking is already cancelled.' }
  if (!quote.allowed) {
    const summary = quote.reason === 'departed' ? 'Your flight has departed, so this booking can’t be cancelled online.'
      : 'This fare can’t be refunded online. Contact the airline about changing your flight or a travel credit.'
    return { allowed: false, reason: quote.reason, refundAmount: 0, feeAmount: 0, currencyCode, summary }
  }
  if (quote.refundAmount > 0 && !cardOnly) return { allowed: false, reason: 'not_card', refundAmount: 0, feeAmount: 0, currencyCode, summary: 'This booking wasn’t paid by card online. Contact the airline to cancel it.' }
  const summary = quote.basis === 'unpaid' ? 'Nothing has been charged. Cancelling releases your seats.'
    : quote.basis === 'risk_free_24h' ? `Booked within the last 24 hours: you get a full refund of ${formatMinorUnits(quote.refundAmount, currencyCode)} to your card.`
      : quote.feeAmount > 0 ? `You get ${formatMinorUnits(quote.refundAmount, currencyCode)} back to your card (fare less a ${formatMinorUnits(quote.feeAmount, currencyCode)} cancellation fee).`
        : `You get a full refund of ${formatMinorUnits(quote.refundAmount, currencyCode)} to your card.`
  return { allowed: true, reason: quote.basis, refundAmount: quote.refundAmount, feeAmount: quote.feeAmount, currencyCode, summary }
}

export async function customerCancellationQuote(_root: unknown, args: { recordLocator: string; accessToken: string }, context: Context) {
  const owned = await ownedBooking(context, args.recordLocator, args.accessToken)
  const { booking, quote, cardOnly } = await cancellationFacts(context.prisma, owned.id)
  return quoteResult(quote, booking.currencyCode, booking.status, cardOnly)
}

export async function cancelCustomerBookingWithRefund(
  _root: unknown,
  args: { recordLocator: string; accessToken: string; reason: string; idempotencyKey: string },
  context: Context,
) {
  const owned = await ownedBooking(context, args.recordLocator, args.accessToken)
  const key = normalizeIdempotencyKey(args.idempotencyKey)
  const storefrontContext = withStorefrontSession(context, owned.carrier, owned.id)
  const outcome = await runSerializableTransaction(storefrontContext, async transactionContext => {
    const { booking, quote, cardOnly } = await cancellationFacts(transactionContext.prisma, owned.id)
    const offered = quoteResult(quote, booking.currencyCode, booking.status, cardOnly)
    if (booking.status === 'cancelled') return { status: 'cancelled', refundAmount: 0, currencyCode: booking.currencyCode, replayed: true }
    if (!offered.allowed) throw new DomainError(offered.summary)
    if (offered.refundAmount > 0) {
      await processBookingRefundInTransaction(transactionContext, {
        bookingId: booking.id, amount: offered.refundAmount, reason: 'customer_request',
        providerReference: `self-cancel-${booking.recordLocator}-${key.slice(0, 24)}`, idempotencyKey: `${key}:refund`,
      }, { authorize: false, cardOnly: true })
    }
    await cancelBookingInTransaction(transactionContext, {
      bookingId: booking.id, idempotencyKey: `${key}:cancel`, reason: args.reason?.trim() || 'Traveler cancelled online.',
      customerBookingId: booking.id, customerAccessTokenHash: hashStorefrontToken(args.accessToken),
    }, booking.id, { refundSettled: offered.refundAmount > 0 })
    return { status: 'cancelled', refundAmount: offered.refundAmount, currencyCode: booking.currencyCode, replayed: false, email: booking.contactEmail, carrier: booking.carrier, recordLocator: booking.recordLocator }
  })
  if (!outcome.replayed && 'email' in outcome && outcome.email) {
    await sendBookingNotice({
      to: outcome.email, carrierName: outcome.carrier.name, recordLocator: outcome.recordLocator,
      subject: `Booking ${outcome.recordLocator} cancelled`,
      heading: 'Your booking is cancelled',
      lines: [outcome.refundAmount > 0 ? `${formatMinorUnits(outcome.refundAmount, outcome.currencyCode)} is on its way back to your card. Refunds usually show within 5–10 business days.` : 'Nothing was charged for this booking.', 'Your seats have been released.'],
    })
  }
  return { status: outcome.status, refundAmount: outcome.refundAmount, currencyCode: outcome.currencyCode }
}
