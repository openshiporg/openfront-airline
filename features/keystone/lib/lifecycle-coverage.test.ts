import assert from 'node:assert/strict'
import test from 'node:test'

import { canTransition, lifecycleHooks } from './lifecycle'

test('archived route cannot be reactivated, suspended route can', () => {
  assert.equal(canTransition('route', 'archived', 'active'), false)
  assert.equal(canTransition('route', 'suspended', 'active'), true)
  assert.equal(canTransition('flightSchedule', 'retired', 'published'), false)
  assert.equal(canTransition('catalogProduct', 'archived', 'draft'), false)
})

test('booking payment and ticketing statuses cannot move backwards', () => {
  assert.equal(canTransition('bookingPayment', 'refunded', 'paid'), false)
  assert.equal(canTransition('bookingPayment', 'paid', 'unpaid'), false)
  assert.equal(canTransition('bookingPayment', 'unpaid', 'paid'), true)
  assert.equal(canTransition('bookingTicketing', 'voided', 'ticketed'), false)
  assert.equal(canTransition('bookingTicketing', 'not_ticketed', 'ticketed'), true)
})

test('lifecycle hook rejects an illegal update with a reason and allows same-state writes', () => {
  const errors: string[] = []
  const hook = lifecycleHooks('stationAssignment')
  hook.validate({ operation: 'update', item: { status: 'revoked' }, resolvedData: { status: 'active' }, addValidationError: (m: string) => errors.push(m) })
  assert.equal(errors.length, 1)
  hook.validate({ operation: 'update', item: { status: 'revoked' }, resolvedData: { status: 'revoked' }, addValidationError: (m: string) => errors.push(m) })
  assert.equal(errors.length, 1)
})
