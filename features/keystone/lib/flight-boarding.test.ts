import assert from 'node:assert/strict'
import test from 'node:test'
import { assertLifecycleTransition } from './lifecycle'

test('gate agent advances Boarding to Closed to Departed; cannot skip closure', () => {
  assert.doesNotThrow(() => assertLifecycleTransition('flightInstance', 'open_for_sale', 'boarding'))
  assert.doesNotThrow(() => assertLifecycleTransition('flightInstance', 'boarding', 'boarding_closed'))
  assert.doesNotThrow(() => assertLifecycleTransition('flightInstance', 'boarding_closed', 'departed'))
  assert.throws(() => assertLifecycleTransition('flightInstance', 'boarding', 'departed'))
  assert.throws(() => assertLifecycleTransition('flightInstance', 'open_for_sale', 'departed'))
  assert.throws(() => assertLifecycleTransition('flightInstance', 'departed', 'boarding'))
})
