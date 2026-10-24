import { BadgeDollarSign, BookOpenCheck, Building2, CalendarClock, CreditCard, Database, Gauge, Landmark, Luggage, MapPinned, PackageSearch, Palette, PlaneTakeoff, RefreshCw, Settings2, Tags, Ticket, Undo2, UserRoundCog, Users, Warehouse } from 'lucide-react'
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
export const platformNavItems: PlatformNavItem[] = [
  { title: 'Carrier operations', href: '/operations', icon: Building2, group: 'standalone' },
  { title: 'Network', href: '/platform/network', icon: MapPinned, group: 'standalone' },
  { title: 'Fares & products', href: '/platform/fares', icon: Tags, group: 'standalone' },
  { title: 'Schedules & flights', href: '/platform/schedules', icon: CalendarClock, group: 'standalone' },
  { title: 'Flight operations', href: '/platform/flight-ops', icon: Gauge, group: 'standalone' },
  { title: 'Inventory & fares', href: '/platform/inventory', icon: PackageSearch, group: 'standalone' },
  { title: 'Offers', href: '/platform/offers', icon: BadgeDollarSign, group: 'standalone' },
  { title: 'Bookings', href: '/platform/bookings', icon: BookOpenCheck, group: 'standalone' },
  { title: 'Tickets', href: '/platform/tickets', icon: Ticket, group: 'standalone' },
  { title: 'Passengers & service', href: '/platform/passengers', icon: Users, group: 'standalone' },
  { title: 'Departures', href: '/platform/departures', icon: PlaneTakeoff, group: 'standalone' },
  { title: 'Baggage', href: '/platform/baggage', icon: Luggage, group: 'standalone' },
  { title: 'Disruptions', href: '/platform/disruptions', icon: RefreshCw, group: 'standalone' },
  { title: 'Payments & refunds', href: '/platform/payments', icon: CreditCard, group: 'standalone' },
  { title: 'Refunds', href: '/platform/refunds', icon: Undo2, group: 'standalone' },
  { title: 'Payment providers', href: '/platform/payment-providers', icon: Landmark, group: 'standalone' },
  { title: 'Manifest entry & audit', href: '/platform/manifests', icon: Database, group: 'standalone' },
  { title: 'Stations & access', href: '/platform/stations', icon: Warehouse, group: 'standalone' },
  { title: 'Storefront settings', href: '/platform/store-settings', icon: Palette, group: 'standalone' },
  { title: 'Settings & readiness', href: '/platform/settings', icon: Settings2, group: 'standalone' },
  { title: 'Operator access', href: '/users', icon: UserRoundCog, group: 'standalone' },
]

export const platformStandaloneItems = platformNavItems.filter((item) => item.group === 'standalone')

export const platformNavGroups: PlatformNavGroup[] = []

export function getPlatformNavItemsWithBasePath(basePath: string) {
  return platformNavItems.map((item) => ({ ...item, href: `${basePath}${item.href}` }))
}
