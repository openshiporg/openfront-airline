import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { DeskHeader, DeskSection, Notice, Plate, Route, StatusLabel, Well } from '@/features/platform/components/desk'
import { OnboardingLaunchCard } from '@/features/platform/onboarding/components/OnboardingLaunchCard'
import Link from 'next/link'
import { formatAirportClock } from '@/features/airline/lib/time'

// Desks grouped by the job an operator opens them for: plan, sell, fly, settle, administer.
const workspaceGroups = [
  { title: 'Plan', items: [
    { href: '/dashboard/platform/network', title: 'Network' },
    { href: '/dashboard/platform/schedules', title: 'Schedules & flights' },
    { href: '/dashboard/platform/fares', title: 'Fares & products' },
  ] },
  { title: 'Sell', items: [
    { href: '/dashboard/platform/inventory', title: 'Inventory & fares' },
    { href: '/dashboard/platform/offers', title: 'Offers' },
    { href: '/dashboard/platform/bookings', title: 'Bookings' },
    { href: '/dashboard/platform/tickets', title: 'Tickets' },
    { href: '/dashboard/platform/passengers', title: 'Passengers' },
  ] },
  { title: 'Fly', items: [
    { href: '/dashboard/platform/flight-ops', title: 'Flight operations' },
    { href: '/dashboard/platform/departures', title: 'Departures' },
    { href: '/dashboard/platform/baggage', title: 'Baggage' },
    { href: '/dashboard/platform/disruptions', title: 'Disruptions' },
  ] },
  { title: 'Settle', items: [
    { href: '/dashboard/platform/payments', title: 'Payments' },
    { href: '/dashboard/platform/refunds', title: 'Refunds' },
    { href: '/dashboard/platform/payment-providers', title: 'Payment providers' },
  ] },
  { title: 'Administer', items: [
    { href: '/dashboard/platform/manifests', title: 'Manifest entry & audit' },
    { href: '/dashboard/platform/stations', title: 'Stations & access' },
    { href: '/dashboard/platform/store-settings', title: 'Storefront settings' },
    { href: '/dashboard/platform/settings', title: 'Readiness & settings' },
  ] },
] as const

type NextFlight = {
  id: string
  flightNumber: string | null
  serviceDate: string | null
  scheduledDepartureAt: string | null
  scheduledArrivalAt: string | null
  estimatedDepartureAt: string | null
  departureGate: string | null
  status: string | null
  origin: { iataCode: string | null; timezone: string | null } | null
  destination: { iataCode: string | null; timezone: string | null } | null
  inventoryBuckets: Array<{ capacity: number | null; sold: number | null; held: number | null }> | null
}

const NEXT_DEPARTURES_QUERY = `query OperationsNextDepartures($now: DateTime!) {
  flightInstances(where: { scheduledDepartureAt: { gte: $now }, status: { notIn: [cancelled, arrived] } }, orderBy: [{ scheduledDepartureAt: asc }], take: 8) {
    id flightNumber serviceDate scheduledDepartureAt scheduledArrivalAt estimatedDepartureAt departureGate status
    origin { iataCode timezone } destination { iataCode timezone }
    inventoryBuckets(take: 20) { capacity sold held }
  }
}`

// Each queue is read on its own, so a desk the operator cannot read drops out without blanking the page.
const QUEUES = [
  { key: 'approvals', label: 'Payments awaiting approval', href: '/dashboard/platform/bookings', query: `query OperationsQueueApprovals { count: manualPaymentEvidencesCount(where: { status: { equals: submitted } }) }` },
  { key: 'unpaid', label: 'Unpaid bookings', href: '/dashboard/platform/bookings', query: `query OperationsQueueUnpaid { count: bookingsCount(where: { paymentStatus: { equals: unpaid } }) }` },
  { key: 'disruptions', label: 'Open disruptions', href: '/dashboard/platform/disruptions', query: `query OperationsQueueDisruptions { count: disruptionsCount(where: { status: { in: [detected, published, recovering] } }) }` },
  { key: 'delayed', label: 'Delayed flights', href: '/dashboard/platform/flight-ops', query: `query OperationsQueueDelayed { count: flightInstancesCount(where: { status: { equals: delayed } }) }` },
  { key: 'bags', label: 'Mishandled bags', href: '/dashboard/platform/baggage', query: `query OperationsQueueBags { count: bagsCount(where: { status: { in: [delayed, mishandled] } }) }` },
] as const

function load(flight: NextFlight) {
  const buckets = flight.inventoryBuckets ?? []
  const capacity = buckets.reduce((sum, bucket) => sum + (bucket.capacity ?? 0), 0)
  const taken = buckets.reduce((sum, bucket) => sum + (bucket.sold ?? 0) + (bucket.held ?? 0), 0)
  return capacity > 0 ? { capacity, taken } : null
}

export default async function OperationsPage() {
  const now = new Date().toISOString()
  const [identity, departures, ...queueResults] = await Promise.all([
    keystoneClient<{ authenticatedItem: { onboardingStatus: string; carrier?: { name: string; legalName: string; code: string; defaultCurrencyCode: string; defaultTimezone: string } | null; role?: { canManageOnboarding: boolean } | null } | null }>(`query OperatorOperationsIdentity { authenticatedItem { ... on User { onboardingStatus carrier { name legalName code defaultCurrencyCode defaultTimezone } role { canManageOnboarding } } } }`),
    keystoneClient<{ flightInstances: NextFlight[] | null }>(NEXT_DEPARTURES_QUERY, { now }),
    ...QUEUES.map(queue => keystoneClient<{ count: number | null }>(queue.query)),
  ])
  const operator = identity.success ? identity.data.authenticatedItem : null
  const carrier = operator?.carrier
  const launchStatus = operator?.onboardingStatus
  const launchTone = launchStatus === 'completed' ? 'ok' as const : launchStatus ? 'warn' as const : 'idle' as const
  const flights = departures.success ? departures.data.flightInstances ?? [] : null
  const queues = QUEUES.map((queue, index) => {
    const result = queueResults[index]
    return { ...queue, count: result.success ? result.data.count ?? 0 : null }
  }).filter(queue => queue.count !== null)
  return <PageContainer
    title="Carrier operations"
    breadcrumbs={[{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'page' as const, label: 'Platform' }, { type: 'page' as const, label: 'Carrier operations' }]}
    header={<DeskHeader
      title={carrier?.name ?? 'Carrier unavailable'}
      tone={carrier ? launchTone : 'idle'}
      status={carrier ? `Launch setup ${(launchStatus ?? 'unknown').replaceAll('_', ' ')}` : 'Unavailable'}
      meta={carrier ? <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><Plate>{carrier.code}</Plate><span>{carrier.legalName}</span><span>{carrier.defaultCurrencyCode}</span><span>{carrier.defaultTimezone}</span>{launchStatus !== 'completed' && <span className="capitalize">Launch setup {(launchStatus ?? 'unknown').replaceAll('_', ' ')}</span>}</span> : undefined}
    />}
  >
    <div className="min-w-0 space-y-8 px-4 pb-8 md:px-6">
      {!identity.success && <Notice tone="bad">Operator identity could not be loaded.</Notice>}
      {carrier && launchStatus !== 'completed' && operator?.role?.canManageOnboarding && <OnboardingLaunchCard initialCarrier={carrier} initialServiceDate={new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)} />}

      <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <DeskSection title="Next departures" count={flights?.length} actions={<Link href="/dashboard/platform/flight-ops" className="text-sm font-medium underline-offset-4 hover:underline">Flight operations</Link>}>
          {flights === null ? <Notice tone="warn">Flights could not be loaded. Check your network access.</Notice>
            : flights.length === 0 ? <Well>No upcoming departures. Publish a schedule to generate dated flights.</Well>
            : <div className="overflow-x-auto rounded-[4px] border">
              <table className="w-full text-sm md:min-w-[40rem]">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                    <th scope="col">Departs</th><th scope="col">Flight</th><th scope="col">Route</th><th scope="col" className="hidden md:table-cell">Arrives</th><th scope="col" className="hidden md:table-cell">Gate</th><th scope="col" className="text-right">Load</th><th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {flights.map(flight => {
                    const seats = load(flight)
                    const date = flight.serviceDate?.slice(0, 10)
                    return <tr key={flight.id} className="tabular-nums [&>td]:px-3 [&>td]:py-2">
                      <td className="whitespace-nowrap font-semibold">{formatAirportClock(flight.estimatedDepartureAt ?? flight.scheduledDepartureAt, flight.origin?.timezone) ?? '—'}<span className="ml-2 hidden text-xs font-normal text-muted-foreground sm:inline">{date}</span></td>
                      <td><Link href={`/dashboard/platform/departures?date=${encodeURIComponent(date ?? '')}&origin=${encodeURIComponent(flight.origin?.iataCode ?? '')}`} className="font-semibold underline-offset-4 hover:underline">{flight.flightNumber || '—'}</Link></td>
                      <td><Route from={flight.origin?.iataCode} to={flight.destination?.iataCode} /></td>
                      <td className="hidden whitespace-nowrap text-muted-foreground md:table-cell">{formatAirportClock(flight.scheduledArrivalAt, flight.destination?.timezone) ?? '—'}</td>
                      <td className="hidden md:table-cell">{flight.departureGate || <span className="text-muted-foreground">—</span>}</td>
                      <td className="whitespace-nowrap text-right">{seats ? <>{seats.taken}<span className="text-muted-foreground">/{seats.capacity}</span></> : <span className="text-muted-foreground">—</span>}</td>
                      <td><StatusLabel status={flight.status} /></td>
                    </tr>
                  })}
                </tbody>
              </table>
            </div>}
        </DeskSection>

        <DeskSection title="Needs action">
          {queues.length === 0 ? <Well>No work queues are available to this operator.</Well>
            : <ul className="divide-y rounded-[4px] border">
              {queues.map(queue => <li key={queue.key}>
                <Link href={queue.href} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted/50">
                  <span className="flex items-center gap-2">{queue.count! > 0 ? <Plate tone="attention" className="min-w-8">{queue.count}</Plate> : <span className="inline-flex min-w-8 justify-center tabular-nums text-muted-foreground">0</span>}<span className={queue.count! > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}>{queue.label}</span></span>
                  <span aria-hidden="true" className="text-muted-foreground">›</span>
                </Link>
              </li>)}
            </ul>}
        </DeskSection>
      </div>

      <DeskSection title="Desks">
        <nav aria-label="Desks" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {workspaceGroups.map(group => <div key={group.title} className="min-w-0">
            <h3 className="border-b pb-1.5 text-xs font-semibold text-muted-foreground">{group.title}</h3>
            <ul className="mt-1">
              {group.items.map(item => <li key={item.href}><Link href={item.href} className="block rounded-[3px] px-1 py-1.5 text-sm font-medium text-foreground hover:bg-muted/60">{item.title}</Link></li>)}
            </ul>
          </div>)}
        </nav>
      </DeskSection>
    </div>
  </PageContainer>
}
