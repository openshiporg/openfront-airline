import { BadgeDollarSign, BookOpenCheck, CalendarClock, CreditCard, Database, Gauge, Landmark, Luggage, MapPinned, PackageSearch, Palette, PlaneTakeoff, RefreshCw, Settings2, Tags, Ticket, Undo2, UserRoundCog, Users, Warehouse } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface PlatformNavItem {
  title: string
  href: string
  icon: LucideIcon
  group?: string
  section?: PlatformNavSection
}

export type PlatformNavSection = 'sales' | 'operations' | 'finance' | 'settings'
export const platformNavSections: Array<{ id: PlatformNavSection; title: string }> = [
  { id: 'sales', title: 'Sales' },
  { id: 'operations', title: 'Operations' },
  { id: 'finance', title: 'Finance' },
  { id: 'settings', title: 'Settings' },
]

export interface PlatformNavGroup {
  id: string
  title: string
  icon: LucideIcon
  items: PlatformNavItem[]
}

// Airline workspaces, in four sidebar sections (Sales, Operations, Finance, Settings); hrefs are relative to the dashboard basePath, as in E-commerce.
// Each page and Keystone list enforces its own carrier permissions, so the sidebar lists every workspace.
// The dashboard home is the operations page; the desks follow in the order of the working day: sell, fly, settle, plan, set up.
export const platformNavItems: PlatformNavItem[] = [
  { title: 'Sell a flight', href: '/platform/offers', icon: BadgeDollarSign, section: 'sales' },
  { title: 'Bookings', href: '/platform/bookings', icon: BookOpenCheck, section: 'sales' },
  { title: 'Tickets', href: '/platform/tickets', icon: Ticket, section: 'sales' },
  { title: 'Passengers', href: '/platform/passengers', icon: Users, section: 'sales' },
  { title: 'Departures', href: '/platform/departures', icon: PlaneTakeoff, section: 'operations' },
  { title: 'Flight operations', href: '/platform/flight-ops', icon: Gauge, section: 'operations' },
  { title: 'Baggage', href: '/platform/baggage', icon: Luggage, section: 'operations' },
  { title: 'Disruptions', href: '/platform/disruptions', icon: RefreshCw, section: 'operations' },
  { title: 'Manifests', href: '/platform/manifests', icon: Database, section: 'operations' },
  { title: 'Network', href: '/platform/network', icon: MapPinned, section: 'operations' },
  { title: 'Schedules', href: '/platform/schedules', icon: CalendarClock, section: 'operations' },
  { title: 'Fares', href: '/platform/fares', icon: Tags, section: 'operations' },
  { title: 'Seat inventory', href: '/platform/inventory', icon: PackageSearch, section: 'operations' },
  { title: 'Stations', href: '/platform/stations', icon: Warehouse, section: 'operations' },
  { title: 'Payments', href: '/platform/payments', icon: CreditCard, section: 'finance' },
  { title: 'Refunds', href: '/platform/refunds', icon: Undo2, section: 'finance' },
  { title: 'Payment providers', href: '/platform/payment-providers', icon: Landmark, section: 'finance' },
  { title: 'Storefront settings', href: '/platform/store-settings', icon: Palette, section: 'settings' },
  { title: 'Settings', href: '/platform/settings', icon: Settings2, section: 'settings' },
  { title: 'Staff', href: '/platform/staff', icon: UserRoundCog, section: 'settings' },
]

export const platformStandaloneItems = platformNavItems.filter((item) => item.section)

export const platformNavGroups: PlatformNavGroup[] = []

export function getPlatformNavItemsWithBasePath(basePath: string) {
  return platformNavItems.map((item) => ({ ...item, href: `${basePath}${item.href}` }))
}
