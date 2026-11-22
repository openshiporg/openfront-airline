import { BadgeDollarSign, BookOpenCheck, CalendarClock, CreditCard, Database, Gauge, Landmark, Luggage, MapPinned, PackageSearch, Palette, PlaneTakeoff, RefreshCw, Settings2, Tags, Ticket, Undo2, UserRoundCog, Users, Warehouse } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface PlatformNavItem {
  title: string
  href: string
  icon: LucideIcon
  group?: string
}

export interface PlatformNavGroup {
  id: string
  title: string
  icon: LucideIcon
  items: PlatformNavItem[]
}

// Airline workspaces, listed flat in the sidebar; hrefs are relative to the dashboard basePath, as in E-commerce.
// Each page and Keystone list enforces its own carrier permissions, so the sidebar lists every workspace.
// The dashboard home is the operations page; the desks follow in the order of the working day: sell, fly, settle, plan, set up.
export const platformNavItems: PlatformNavItem[] = [
  { title: 'Sell a flight', href: '/platform/offers', icon: BadgeDollarSign, group: 'standalone' },
  { title: 'Bookings', href: '/platform/bookings', icon: BookOpenCheck, group: 'standalone' },
  { title: 'Tickets', href: '/platform/tickets', icon: Ticket, group: 'standalone' },
  { title: 'Passengers', href: '/platform/passengers', icon: Users, group: 'standalone' },
  { title: 'Departures', href: '/platform/departures', icon: PlaneTakeoff, group: 'standalone' },
  { title: 'Flight operations', href: '/platform/flight-ops', icon: Gauge, group: 'standalone' },
  { title: 'Baggage', href: '/platform/baggage', icon: Luggage, group: 'standalone' },
  { title: 'Disruptions', href: '/platform/disruptions', icon: RefreshCw, group: 'standalone' },
  { title: 'Manifests', href: '/platform/manifests', icon: Database, group: 'standalone' },
  { title: 'Payments', href: '/platform/payments', icon: CreditCard, group: 'standalone' },
  { title: 'Refunds', href: '/platform/refunds', icon: Undo2, group: 'standalone' },
  { title: 'Network', href: '/platform/network', icon: MapPinned, group: 'standalone' },
  { title: 'Schedules', href: '/platform/schedules', icon: CalendarClock, group: 'standalone' },
  { title: 'Fares', href: '/platform/fares', icon: Tags, group: 'standalone' },
  { title: 'Seat inventory', href: '/platform/inventory', icon: PackageSearch, group: 'standalone' },
  { title: 'Stations', href: '/platform/stations', icon: Warehouse, group: 'standalone' },
  { title: 'Payment providers', href: '/platform/payment-providers', icon: Landmark, group: 'standalone' },
  { title: 'Storefront settings', href: '/platform/store-settings', icon: Palette, group: 'standalone' },
  { title: 'Settings', href: '/platform/settings', icon: Settings2, group: 'standalone' },
  { title: 'Staff access', href: '/users', icon: UserRoundCog, group: 'standalone' },
]

export const platformStandaloneItems = platformNavItems.filter((item) => item.group === 'standalone')

export const platformNavGroups: PlatformNavGroup[] = []

export function getPlatformNavItemsWithBasePath(basePath: string) {
  return platformNavItems.map((item) => ({ ...item, href: `${basePath}${item.href}` }))
}
