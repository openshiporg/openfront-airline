import Link from 'next/link'
import { BadgeDollarSign, BookOpenCheck, CalendarClock, CreditCard, Database, PackageSearch, PlaneTakeoff, RefreshCw, Settings2, Users } from 'lucide-react'

import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { OnboardingLaunchCard } from '@/features/platform/onboarding/components/OnboardingLaunchCard'

const workspaces = [
  { href: '/dashboard/platform/schedules', title: 'Schedules', description: 'Published patterns and dated flight instances.', icon: CalendarClock },
  { href: '/dashboard/platform/inventory', title: 'Inventory & fares', description: 'Authorization, commitments, availability, and persisted prices.', icon: PackageSearch },
  { href: '/dashboard/platform/offers', title: 'Offers', description: 'Expiring commercial proposals before booking acceptance.', icon: BadgeDollarSign },
  { href: '/dashboard/platform/bookings', title: 'Bookings', description: 'Locator, payment, ticketing, and servicing state.', icon: BookOpenCheck },
  { href: '/dashboard/platform/passengers', title: 'Passengers', description: 'Passenger records and linked service workload.', icon: Users },
  { href: '/dashboard/platform/departures', title: 'Departures', description: 'Station-scoped check-in, boarding, and bag queues.', icon: PlaneTakeoff },
  { href: '/dashboard/platform/disruptions', title: 'Disruptions', description: 'Published impact and reaccommodation progress.', icon: RefreshCw },
  { href: '/dashboard/platform/payments', title: 'Payments & refunds', description: 'Captured value, refunds, and provider evidence.', icon: CreditCard },
  { href: '/dashboard/platform/manifests', title: 'Manifest entry & audit', description: 'Enter the passenger manifest desk or inspect command evidence.', icon: Database },
  { href: '/dashboard/platform/store-settings', title: 'Storefront settings', description: 'Public carrier identity, homepage content, and approved theme.', icon: Settings2 },
  { href: '/dashboard/platform/settings', title: 'Review readiness & settings', description: 'Carrier posture and bounded provider configuration.', icon: Settings2 },
] as const

export default async function OperationsPage() {
  const identity = await keystoneClient<{ authenticatedItem: { onboardingStatus: string; carrier?: { name: string; legalName: string; code: string; defaultCurrencyCode: string; defaultTimezone: string } | null; role?: { canManageOnboarding: boolean } | null } | null }>(`query OperatorOperationsIdentity { authenticatedItem { ... on User { onboardingStatus carrier { name legalName code defaultCurrencyCode defaultTimezone } role { canManageOnboarding } } } }`)
  const operator = identity.success ? identity.data.authenticatedItem : null
  const carrier = operator?.carrier
  return <PageContainer title="Carrier operations" breadcrumbs={[{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'page' as const, label: 'Platform' }, { type: 'page' as const, label: 'Carrier operations' }]}>
    <header className="border-b px-4 py-5 md:px-6"><p className="text-xs font-medium text-muted-foreground">{carrier ? `${carrier.name} · ${carrier.code}` : 'Carrier context unavailable'}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Carrier operations</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Manage flights, bookings, passenger service, and settlement evidence.</p></header>
    {carrier && operator?.onboardingStatus !== 'completed' && operator?.role?.canManageOnboarding && <div className="mx-4 mt-4 md:mx-6"><OnboardingLaunchCard initialCarrier={carrier} initialServiceDate={new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)} /></div>}
    {!identity.success && <p role="alert" className="mx-4 mt-4 border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive md:mx-6">Operator identity could not be loaded. Workspaces will preserve access errors rather than presenting them as empty data.</p>}
    <div className="grid gap-px bg-border p-px sm:grid-cols-2 xl:grid-cols-5">{workspaces.map(item => <Link key={item.href} href={item.href} className="group min-w-0 bg-card p-4 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><item.icon className="size-4 text-muted-foreground group-hover:text-foreground" aria-hidden="true" /><h2 className="mt-6 font-medium">{item.title}</h2><p className="mt-1 text-sm text-muted-foreground">{item.description}</p></Link>)}</div>
  </PageContainer>
}
