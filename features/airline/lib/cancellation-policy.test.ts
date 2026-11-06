import assert from 'node:assert/strict'
import { test } from 'node:test'

import { quoteCustomerCancellation } from './cancellation-policy'

const day = 24 * 60 * 60_000
const now = new Date('2026-11-06T12:00:00Z')
const base = { now, paidAmount: 15480, fareRules: [null], fallbackRefundable: false }

test('24-hour risk-free: full refund within a day of booking when departure is 2+ days out', () => {
  const quote = quoteCustomerCancellation({ ...base, bookedAt: new Date(now.getTime() - 2 * 3600_000), firstDepartureAt: new Date(now.getTime() + 10 * day) })
  assert.deepEqual(quote, { allowed: true, refundAmount: 15480, feeAmount: 0, basis: 'risk_free_24h' })
})

test('inside 2 days of departure a non-refundable fare is not refunded online, even if just booked', () => {
  const quote = quoteCustomerCancellation({ ...base, bookedAt: new Date(now.getTime() - 3600_000), firstDepartureAt: new Date(now.getTime() + day) })
  assert.deepEqual(quote, { allowed: false, reason: 'non_refundable' })
})

test('refundable fare returns the fare less its cancellation fee', () => {
  const quote = quoteCustomerCancellation({ ...base, bookedAt: new Date(now.getTime() - 3 * day), firstDepartureAt: new Date(now.getTime() + 3 * day), fareRules: [{ isRefundable: true, cancellationFeeAmount: 5000 }] })
  assert.deepEqual(quote, { allowed: true, refundAmount: 10480, feeAmount: 5000, basis: 'refundable_fare' })
})

test('unpaid holds cancel with nothing to refund; departed flights do not cancel online', () => {
  assert.deepEqual(quoteCustomerCancellation({ ...base, paidAmount: 0, bookedAt: now, firstDepartureAt: new Date(now.getTime() + day) }), { allowed: true, refundAmount: 0, feeAmount: 0, basis: 'unpaid' })
  assert.deepEqual(quoteCustomerCancellation({ ...base, bookedAt: now, firstDepartureAt: new Date(now.getTime() - 60_000) }), { allowed: false, reason: 'departed' })
})
