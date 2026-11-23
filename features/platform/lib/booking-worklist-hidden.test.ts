import assert from 'node:assert/strict'
import test from 'node:test'

import { bookingWorklistWhere, VISIBLE_BOOKING } from './booking-worklist'

test('desk lists skip hidden QA bookings', () => {
  assert.deepEqual(bookingWorklistWhere('').where, VISIBLE_BOOKING)
  assert.deepEqual((bookingWorklistWhere('Maya Brennan').where as any).AND[0], VISIBLE_BOOKING)
})

test('an exact six-character reference still finds a hidden booking', () => {
  const where = bookingWorklistWhere('b93b8e').where as any
  assert.equal(where.AND, undefined)
  assert.deepEqual(where.OR[0], { recordLocator: { equals: 'B93B8E' } })
})
