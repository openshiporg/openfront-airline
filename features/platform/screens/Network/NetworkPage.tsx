import Link from 'next/link'
import { NO_RECORD_ID } from '@/features/platform/lib/no-cursor'

import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { NetworkDesk } from '@/features/platform/components/NetworkDesk'
import {
  FLIGHT_INVENTORY_BUCKET_PAGE_SIZE,
  flightWorklistHref,
  flightWorklistPage,
  flightWorklistScopeAuthorized,
  futureFlightWorklistWhere,
  normalizeFlightWorklistCursor,
  normalizeFlightWorklistFrom,
} from '@/features/platform/lib/flight-worklist'
import {
  includeSelectedSchedule,
  normalizeScheduleWorklistCursor,
  normalizeSelectedScheduleId,
  PLATFORM_NETWORK_DESK_QUERY,
  scheduleWorklistPage,
  scheduleWorklistScopeAuthorized,
} from '@/features/platform/lib/schedule-worklist'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

type NetworkDeskResponse = {
  authenticatedItem?: {
    carrier?: { id: string; defaultCurrencyCode: string | null; defaultTimezone: string | null } | null
    role?: {
      canReadNetwork: boolean | null
      canManageNetwork: boolean | null
      canReadInventory: boolean | null
      canManageInventory: boolean | null
      canManageCarriers: boolean | null
    } | null
  } | null
  flightSchedules: any[] | null
  flightSchedulesCount: number | null
  selectedSchedule: any[] | null
  flightInstances: any[] | null
  flightInstancesCount: number | null
  flightCursorRecord: Array<{ id: string }> | null
}

export default async function NetworkPage({ searchParams }: { searchParams?: SearchParams } = {}) {
  const params = searchParams ? await searchParams : {}
  const scheduleCursor = normalizeScheduleWorklistCursor(params.scheduleCursor)
  const requestedScheduleId = normalizeSelectedScheduleId(params.scheduleId)
  const requestedFlightCursor = normalizeFlightWorklistCursor(params.flightCursor)
  const requestedFlightFrom = normalizeFlightWorklistFrom(params.flightFrom)
  const flightCursor = requestedFlightCursor && requestedFlightFrom ? requestedFlightCursor : null
  const flightFrom = requestedFlightFrom ?? new Date().toISOString()
  const response = await keystoneClient<NetworkDeskResponse>(PLATFORM_NETWORK_DESK_QUERY, {
    scheduleWhere: { status: { equals: 'published' } },
    scheduleCursor: scheduleCursor ? { id: scheduleCursor } : null,
    scheduleSkip: scheduleCursor ? 1 : 0,
    selectedScheduleId: requestedScheduleId ?? NO_RECORD_ID,
    flightWhere: futureFlightWorklistWhere(flightFrom),
    flightCursor: flightCursor ? { id: flightCursor } : null,
    flightCursorId: flightCursor ?? NO_RECORD_ID,
    flightSkip: flightCursor ? 1 : 0,
  })

  const schedulePage = response.success
    ? scheduleWorklistPage(response.data.flightSchedules, response.data.flightSchedulesCount, scheduleCursor, scheduleWorklistScopeAuthorized(response.data.authenticatedItem))
    : null
  const selectedSchedule = response.success ? response.data.selectedSchedule?.[0] ?? null : null
  const scheduleSelectionUnavailable = Boolean(requestedScheduleId && (!selectedSchedule || schedulePage?.state === 'unavailable'))
  const scheduleSelectionId = requestedScheduleId
    ? scheduleSelectionUnavailable ? '' : selectedSchedule?.id ?? ''
    : schedulePage?.items[0]?.id ?? ''
  const schedules = schedulePage && schedulePage.state !== 'unavailable'
    ? includeSelectedSchedule(schedulePage.items, selectedSchedule)
    : []

  const cursorAuthorized = !flightCursor || Boolean(response.success && response.data.flightCursorRecord?.some(record => record.id === flightCursor))
  const flightPage = response.success
    ? flightWorklistPage(response.data.flightInstances, response.data.flightInstancesCount, flightCursor, flightWorklistScopeAuthorized(response.data.authenticatedItem), cursorAuthorized)
    : null
  const incompleteBuckets = Boolean(flightPage?.items.some(flight => !Array.isArray(flight.inventoryBuckets)))
  const flightState = incompleteBuckets ? 'unavailable' as const : flightPage?.state
  const flights = !flightPage || flightState === 'unavailable'
    ? []
    : flightPage.items.map(flight => {
      const rows = flight.inventoryBuckets as any[]
      return {
        ...flight,
        inventoryBuckets: rows.slice(0, FLIGHT_INVENTORY_BUCKET_PAGE_SIZE),
        inventoryBucketsOverflow: rows.length > FLIGHT_INVENTORY_BUCKET_PAGE_SIZE,
      }
    })
  const flightRetryHref = requestedFlightCursor
    ? flightWorklistHref('/dashboard/network', null, flightFrom, {
      ...(scheduleCursor ? { scheduleCursor } : {}),
      ...(requestedScheduleId ? { scheduleId: requestedScheduleId } : {}),
    })
    : null

  return (
    <PageContainer
      title="Dated service"
      header={
        <div>
          <p className="text-sm font-medium text-primary">Controlled commercial provisioning</p>
          <h1 className="text-2xl font-semibold tracking-tight">Network & inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">Provision bounded sellable service from published schedules, then maintain sales and authorization through auditable commands.</p>
        </div>
      }
      breadcrumbs={[
        { type: 'link' as const, label: 'Operations', href: '/dashboard/operations' },
        { type: 'page' as const, label: 'Dated service' },
      ]}
    >
      <div className="p-4 md:p-6">
        {response.success ? (
          <NetworkDesk
            schedules={schedules}
            flights={flights}
            defaultCurrencyCode={response.data.authenticatedItem?.carrier?.defaultCurrencyCode ?? 'USD'}
            defaultTimezone={response.data.authenticatedItem?.carrier?.defaultTimezone ?? 'UTC'}
            mode="all"
            detailBase="/dashboard/network"
            scheduleSelectionId={scheduleSelectionId}
            scheduleSelectionUnavailable={scheduleSelectionUnavailable}
            scheduleWorklist={schedulePage ? {
              state: schedulePage.state,
              totalCount: schedulePage.totalCount,
              pageItemCount: schedulePage.items.length,
              nextCursor: schedulePage.state === 'ready' ? schedulePage.nextCursor : null,
              cursor: scheduleCursor,
            } : undefined}
            flightWorklist={flightPage ? {
              state: flightState ?? flightPage.state,
              totalCount: incompleteBuckets ? null : flightPage.totalCount,
              pageItemCount: flights.length,
              nextCursor: flightPage.state === 'ready' && !incompleteBuckets ? flightPage.nextCursor : null,
              cursor: flightCursor,
              from: flightFrom,
            } : undefined}
          />
        ) : (
          <>
            <p className="rounded-[4px] bg-destructive/10 px-3 py-2 text-sm">{response.error}</p>
            {flightRetryHref && (
              <Link href={flightRetryHref} className="mt-3 inline-flex rounded-[4px] border px-3 py-2 text-sm">
                Return to first future-flight page
              </Link>
            )}
          </>
        )}
      </div>
    </PageContainer>
  )
}
