// What a traveler gets back when they cancel online. The rules match how US carriers price it:
// - US DOT 14 CFR 259.5: a booking made at least 7 days before departure can be cancelled for a full refund within
//   24 hours of booking.
// - A refundable fare refunds the airfare less the fare rule's cancellation fee.
// - A non-refundable fare cancelled online returns nothing, so online cancellation is refused and the traveler is
//   sent to the airline (the booking stays intact for a change or credit at the counter).
// - Nothing is refundable online once the first flight has departed.

export const RISK_FREE_WINDOW_MS = 24 * 60 * 60_000
export const RISK_FREE_MIN_ADVANCE_MS = 7 * 24 * 60 * 60_000

export type CancellationFareRule = { isRefundable: boolean; cancellationFeeAmount: number } | null

export type CancellationQuoteInput = {
  bookedAt: Date
  firstDepartureAt: Date
  now: Date
  paidAmount: number // captured airfare still held (captured minus already refunded), minor units
  fareRules: CancellationFareRule[] // the fare rule of each priced flight line item; null when none was attached
  fallbackRefundable: boolean // carrier fare-brand policy when a line item carries no fare rule
}

export type CancellationQuote =
  | { allowed: true; refundAmount: number; feeAmount: number; basis: 'risk_free_24h' | 'refundable_fare' | 'unpaid' }
  | { allowed: false; reason: 'departed' | 'non_refundable' | 'nothing_paid_yet' }

export function quoteCustomerCancellation(input: CancellationQuoteInput): CancellationQuote {
  const now = input.now.getTime()
  const departure = input.firstDepartureAt.getTime()
  if (!Number.isFinite(departure) || departure <= now) return { allowed: false, reason: 'departed' }
  if (!Number.isSafeInteger(input.paidAmount) || input.paidAmount <= 0) return { allowed: true, refundAmount: 0, feeAmount: 0, basis: 'unpaid' }
  const bookedAt = input.bookedAt.getTime()
  if (Number.isFinite(bookedAt) && now - bookedAt <= RISK_FREE_WINDOW_MS && departure - bookedAt >= RISK_FREE_MIN_ADVANCE_MS) {
    return { allowed: true, refundAmount: input.paidAmount, feeAmount: 0, basis: 'risk_free_24h' }
  }
  const rules = input.fareRules.length ? input.fareRules : [null]
  const refundable = rules.every(rule => rule ? rule.isRefundable : input.fallbackRefundable)
  if (!refundable) return { allowed: false, reason: 'non_refundable' }
  const fee = Math.min(input.paidAmount, rules.reduce((sum, rule) => sum + Math.max(0, rule?.cancellationFeeAmount ?? 0), 0))
  return { allowed: true, refundAmount: input.paidAmount - fee, feeAmount: fee, basis: 'refundable_fare' }
}
