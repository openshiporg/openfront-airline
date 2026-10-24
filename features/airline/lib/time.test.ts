import assert from 'node:assert/strict'
import test from 'node:test'

import { formatAirportClock, formatAirportTime } from './time'

test('airport time formats with an explicit zone and never throws', () => {
  assert.equal(formatAirportTime('2026-11-07T13:00:00.000Z', 'America/New_York'), 'Nov 7, 2026, 8:00 AM EST')
  assert.equal(formatAirportTime('2026-11-07T13:00:00.000Z', 'Not/AZone'), 'Nov 7, 2026, 1:00 PM UTC')
  assert.equal(formatAirportTime(null, 'UTC'), null)
  assert.equal(formatAirportTime('nope', 'UTC'), null)
})

test('clock time carries its zone', () => {
  assert.equal(formatAirportClock('2026-11-07T13:00:00.000Z', 'America/New_York'), '8:00 AM EST')
})
