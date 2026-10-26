import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { RecoveryDesk } from '@/features/platform/components/RecoveryDesk'
import {
  normalizeRecoveryCursor,
  normalizeRecoveryFrom,
  RECOVERY_DESK_QUERY,
  RECOVERY_DISRUPTION_PAGE_SIZE,
  RECOVERY_FLIGHT_PAGE_SIZE,
  recoveryCursorHref,
  recoveryOuterPage,
} from '@/features/platform/lib/recovery-queue'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function RecoveryPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ? await searchParams : {}
  const disruptionCursor = normalizeRecoveryCursor(params.disruptionCursor)
  const serviceCursor = normalizeRecoveryCursor(params.serviceCursor)
  const recoveryServicesFrom = normalizeRecoveryFrom(params.recoveryFrom)
  const response = await keystoneClient<{ flightInstances: any[]; flightInstancesCount: number; disruptions: any[]; disruptionsCount: number }>(RECOVERY_DESK_QUERY, {
    from: recoveryServicesFrom,
    serviceCursor: serviceCursor ? { id: serviceCursor } : null,
    serviceSkip: serviceCursor ? 1 : 0,
    disruptionCursor: disruptionCursor ? { id: disruptionCursor } : null,
    disruptionSkip: disruptionCursor ? 1 : 0,
  })
  const servicePage = response.success ? recoveryOuterPage(response.data.flightInstances, response.data.flightInstancesCount, RECOVERY_FLIGHT_PAGE_SIZE) : null
  const disruptionPage = response.success ? recoveryOuterPage(response.data.disruptions, response.data.disruptionsCount, RECOVERY_DISRUPTION_PAGE_SIZE) : null
  const cursorState = { disruptionCursor, serviceCursor, recoveryFrom: recoveryServicesFrom }
  const serviceNextHref = servicePage?.nextCursor ? recoveryCursorHref('/dashboard/recovery', cursorState, 'service', servicePage.nextCursor) : null
  const disruptionNextHref = disruptionPage?.nextCursor ? recoveryCursorHref('/dashboard/recovery', cursorState, 'disruption', disruptionPage.nextCursor) : null
  return <PageContainer title="Recovery" header={<div><p className="text-sm font-medium text-primary">Irregular operations</p><h1 className="text-2xl font-semibold tracking-tight">Disruption & reaccommodation</h1><p className="mt-1 text-sm text-muted-foreground">Publish passenger impact, identify affected bookings, protect replacement inventory, and reissue eligible ticket coupons.</p></div>} breadcrumbs={[{ type: 'link' as const, label: 'Operations', href: '/dashboard/operations' }, { type: 'page' as const, label: 'Recovery' }]}><div className="p-4 md:p-6">{response.success ? <RecoveryDesk key={disruptionCursor ?? 'first'} flights={servicePage?.items ?? []} flightCount={servicePage?.totalCount ?? 0} flightHasNextPage={servicePage?.hasNextPage ?? false} serviceNextHref={serviceNextHref} recoveryServicesFrom={recoveryServicesFrom} disruptions={disruptionPage?.items ?? []} disruptionCount={disruptionPage?.totalCount ?? 0} disruptionHasNextPage={disruptionPage?.hasNextPage ?? false} disruptionNextHref={disruptionNextHref} /> : <p className="rounded-[4px] bg-destructive/10 px-3 py-2 text-sm">{response.error}</p>}</div></PageContainer>
}
