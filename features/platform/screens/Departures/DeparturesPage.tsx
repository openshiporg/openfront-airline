import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { DepartureDesk } from '@/features/platform/components/DepartureDesk'

const query = `query DepartureManifest($serviceDate: String!, $originCode: String, $cleanupCursor: String) {
  departureManifest(serviceDate: $serviceDate, originCode: $originCode, cleanupCursor: $cleanupCursor)
}`

export default async function DeparturesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {}
  const defaultDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
  const serviceDate = typeof params.date === 'string' ? params.date : defaultDate
  const originCode = typeof params.origin === 'string' && params.origin.trim() ? params.origin.trim().toUpperCase() : null
  const cleanupCursor = typeof params.cleanupCursor === 'string' ? params.cleanupCursor : null
  const response = await keystoneClient<{ departureManifest: any }>(query, { serviceDate, originCode, cleanupCursor })
  const nextCleanupCursor = response.success ? response.data.departureManifest.refundCleanup.nextCursor as string | null : null
  const nextCleanupParams = nextCleanupCursor ? new URLSearchParams({ date: serviceDate, cleanupCursor: nextCleanupCursor }) : null
  if (nextCleanupParams && originCode) nextCleanupParams.set('origin', originCode)
  const cleanupNextHref = nextCleanupParams ? `/dashboard/departures?${nextCleanupParams.toString()}` : null
  return <PageContainer title="Departure control" header={<div><p className="text-sm font-medium text-primary">Station-scoped passenger service</p><h1 className="text-2xl font-semibold tracking-tight">Flight manifests</h1><p className="mt-1 text-sm text-muted-foreground">Document verification, check-in, bag acceptance, boarding, and offload only. This workspace performs no dispatch, safety, load-control, or crew-legality decisions.</p></div>} breadcrumbs={[{ type: 'link' as const, label: 'Operations', href: '/dashboard/operations' }, { type: 'page' as const, label: 'Departure control' }]}>
    <div className="space-y-5 p-4 md:p-6">
      <form className="grid gap-3 rounded-[4px] border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-sm font-medium">Service date<input type="date" name="date" defaultValue={serviceDate} required className="mt-2 w-full rounded-[4px] border bg-background px-3 py-2" /></label>
        <label className="text-sm font-medium">Origin station <span className="font-normal text-muted-foreground">(optional)</span><input name="origin" defaultValue={originCode ?? ''} maxLength={3} placeholder="JFK" className="mt-2 w-full rounded-[4px] border bg-background px-3 py-2 uppercase" /></label>
        <button className="self-end rounded-[4px] bg-primary px-4 py-2 font-medium text-primary-foreground">Load manifest</button>
      </form>
      {response.success ? <DepartureDesk manifest={response.data.departureManifest} cleanupNextHref={cleanupNextHref} /> : <p className="rounded-[4px] bg-destructive/10 px-3 py-2 text-sm">{response.error}</p>}
    </div>
  </PageContainer>
}
