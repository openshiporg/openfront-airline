export const operatorRouteAliases = {
  flights: '/dashboard/platform/schedules',
  schedules: '/dashboard/platform/schedules',
  inventory: '/dashboard/platform/inventory',
  fares: '/dashboard/platform/fares',
  offers: '/dashboard/platform/offers',
  reservations: '/dashboard/platform/bookings',
  passengers: '/dashboard/platform/passengers',
  'check-in': '/dashboard/platform/departures',
  boarding: '/dashboard/platform/departures',
  baggage: '/dashboard/platform/baggage',
  disruptions: '/dashboard/platform/disruptions',
  refunds: '/dashboard/platform/refunds',
  payments: '/dashboard/platform/payments',
  manifests: '/dashboard/platform/manifests',
  reports: '/dashboard/platform/manifests',
  settings: '/dashboard/platform/settings',
} as const

// Pre-platform desk URLs. The platform desks replaced these screens, and their drill-in links resolve to no record page.
// None of these is a Keystone list path, so no generic list view is hidden.
export const retiredDeskRoutes = {
  departures: '/dashboard/platform/departures',
  network: '/dashboard/platform/network',
  recovery: '/dashboard/platform/disruptions',
  shopping: '/dashboard/platform/offers',
} as const

export type OperatorRouteAlias = keyof typeof operatorRouteAliases

export function operatorRouteDestination(alias: OperatorRouteAlias) {
  return operatorRouteAliases[alias]
}
