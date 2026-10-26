import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { ShoppingResults } from '@/features/platform/components/ShoppingResults'

const query = `query OperatorShopping($origin: String!, $destination: String!, $date: String!) {
  authenticatedItem { ... on User { carrier { defaultTimezone } } }
  airlineFlightOptions(originCode: $origin, destinationCode: $destination, serviceDate: $date) {
    id inventoryBucketId flightNumber scheduledDepartureAt scheduledArrivalAt originCode destinationCode
    fareBrand { code name } currencyCode totalAmount availability { available }
  }
  passengers(take: 20) { id givenName familyName }
}`

export default async function ShoppingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const origin = String(params.origin ?? 'JFK').toUpperCase()
  const destination = String(params.destination ?? 'BOS').toUpperCase()
  const date = String(params.date ?? new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10))
  const response = await keystoneClient<{ authenticatedItem?: { carrier?: { defaultTimezone: string } | null } | null; airlineFlightOptions: any[]; passengers: any[] }>(query, { origin, destination, date })
  const flights = response.success ? response.data.airlineFlightOptions : []
  const passengers = response.success ? response.data.passengers : []
  return <PageContainer title="Shop & hold" header={<div><p className="text-sm font-medium text-primary">Commercial workspace</p><h1 className="text-2xl font-semibold tracking-tight">Find available fares</h1><p className="mt-1 text-sm text-muted-foreground">Search dated carrier inventory and place an atomic 15-minute hold.</p></div>} breadcrumbs={[{ type: 'link' as const, label: 'Operations', href: '/dashboard/operations' }, { type: 'page' as const, label: 'Shop & hold' }]}>
    <div className="grid gap-6 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section>
        <form className="mb-6 grid gap-3 rounded-[4px] border bg-card p-4 sm:grid-cols-4" method="get">
          <label className="text-sm font-medium">From<input name="origin" defaultValue={origin} className="mt-2 w-full rounded-[4px] border bg-background px-3 py-2 uppercase" maxLength={3} /></label>
          <label className="text-sm font-medium">To<input name="destination" defaultValue={destination} className="mt-2 w-full rounded-[4px] border bg-background px-3 py-2 uppercase" maxLength={3} /></label>
          <label className="text-sm font-medium">Date<input name="date" type="date" defaultValue={date} className="mt-2 w-full rounded-[4px] border bg-background px-3 py-2" /></label>
          <button className="self-end rounded-[4px] bg-primary px-4 py-2 font-medium text-primary-foreground">Search</button>
        </form>
        {!response.success && <p className="mb-4 rounded-[4px] bg-destructive/10 px-3 py-2 text-sm">{response.error}</p>}
        <ShoppingResults flights={flights} passengers={passengers} defaultTimezone={response.success ? response.data.authenticatedItem?.carrier?.defaultTimezone ?? 'UTC' : 'UTC'} />
      </section>
      <aside className="h-fit rounded-[4px] border bg-muted/40 p-5 text-sm"><p className="font-semibold">Commercial controls</p><ul className="mt-3 space-y-2 text-muted-foreground"><li>• Availability comes from dated inventory.</li><li>• Holds are carrier-scoped and expire.</li><li>• Booking lines preserve accepted prices.</li><li>• Continue in the booking desk after holding a fare.</li></ul></aside>
    </div>
  </PageContainer>
}
