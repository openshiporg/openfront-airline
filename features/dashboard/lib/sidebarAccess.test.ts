import assert from 'node:assert/strict'
import { test } from 'node:test'

import { canUsePlatformPage } from './sidebarAccess'

test('onboarding and bookings pages follow role permissions', () => {
  const finance = { role: { canAccessDashboard: true, canManageOnboarding: false, canReadBookings: false } }
  const owner = { role: { canAccessDashboard: true, canManageOnboarding: true, canReadBookings: true } }
  assert.equal(canUsePlatformPage('onboarding', finance), false)
  assert.equal(canUsePlatformPage('bookings', finance), false)
  assert.equal(canUsePlatformPage('onboarding', owner), true)
  assert.equal(canUsePlatformPage('bookings', owner), true)
})
