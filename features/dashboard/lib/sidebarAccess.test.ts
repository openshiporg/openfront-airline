import assert from 'node:assert/strict'
import { test } from 'node:test'

import { canUsePlatformPage, staffLandingPath, visibleSidebarLists } from './sidebarAccess'

test('onboarding and bookings pages follow role permissions', () => {
  const finance = { role: { canAccessDashboard: true, canManageOnboarding: false, canReadBookings: false } }
  const owner = { role: { canAccessDashboard: true, canManageOnboarding: true, canReadBookings: true } }
  assert.equal(canUsePlatformPage('onboarding', finance), false)
  assert.equal(canUsePlatformPage('bookings', finance), false)
  assert.equal(canUsePlatformPage('onboarding', owner), true)
  assert.equal(canUsePlatformPage('bookings', owner), true)
})

test('Models list is for admins/developers only', () => {
  const lists = [{ path: 'bookings' }, { path: 'roles', isHidden: true }]
  assert.deepEqual(visibleSidebarLists(lists, { role: { canAccessDashboard: true, canManageRoles: true } }), [{ path: 'bookings' }])
  assert.deepEqual(visibleSidebarLists(lists, { role: { canAccessDashboard: true, canReadBookings: true } }), [])
  assert.deepEqual(visibleSidebarLists(lists, null), [])
})

test('each staff role lands on its own desk; admins on the overview', () => {
  assert.equal(staffLandingPath({ role: { canManageRoles: true, canManageBookings: true } }), null)
  assert.equal(staffLandingPath({ role: { canManageOffers: true, canManageBookings: true } }), '/dashboard/platform/bookings')
  assert.equal(staffLandingPath({ role: { canManageAirportService: true } }), '/dashboard/platform/departures')
  assert.equal(staffLandingPath({ role: { canManagePayments: true } }), '/dashboard/platform/payments')
  assert.equal(staffLandingPath({ role: { canManageNetwork: true, canManageOffers: true } }), '/dashboard/platform/flight-ops')
  assert.equal(staffLandingPath({ role: { canManageBookings: true, canManagePayments: true } }), null)
  assert.equal(staffLandingPath(null), null)
})
