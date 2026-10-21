import { readBookingWorkspace } from '@/features/platform/lib/booking-workspace'
import { detailWithReturn } from '@/features/platform/lib/desk-return'
import { worklistSearch, withWorklistSearch, textSearch } from '@/features/platform/lib/worklist-search'
import Link from 'next/link'

import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { carrierCalendarDate } from '@/features/storefront/lib/branding'
import { BookingDesk } from '@/features/platform/components/BookingDesk'
import { DepartureDesk } from '@/features/platform/components/DepartureDesk'
import {
  boundedFlightInventoryBuckets,
  flightWorklistHref,
  flightWorklistPage,
  flightWorklistScopeAuthorized,
  futureFlightWorklistWhere,
  normalizeFlightWorklistCursor,
  normalizeFlightWorklistFrom,
  PLATFORM_INVENTORY_DESK_QUERY,
} from '@/features/platform/lib/flight-worklist'
import {
  BOOKING_WORKLIST_QUERY,
  bookingWorklistNextHref,
  bookingWorklistPage,
  normalizeBookingWorklistCursor,
} from '@/features/platform/lib/booking-worklist'
import { NetworkDesk } from '@/features/platform/components/NetworkDesk'
import { RecoveryDesk } from '@/features/platform/components/RecoveryDesk'
import {
  normalizePaymentEvidenceCursor,
  paymentEvidenceWorklistPage,
  paymentEvidenceWorklistScopeAuthorized,
  PLATFORM_PAYMENTS_DESK_QUERY,
  PAYMENT_EVIDENCE_WORKLIST_WHERE,
  type PaymentEvidenceWorklistActor,
} from '@/features/platform/lib/payment-evidence-worklist'
import {
  normalizePaymentRecordCursor,
  paymentDeskWorklistHref,
  paymentRecordWorklistPage,
  paymentRecordWorklistScopeAuthorized,
  PAYMENT_RECORD_WORKLIST_WHERE,
  type PaymentRecordWorklistActor,
} from '@/features/platform/lib/payment-record-worklist'
import {
  normalizeProviderConnectionCursor,
  providerConnectionScope,
  providerConnectionWorklistHref,
  providerConnectionWorklistPage,
  PLATFORM_SETTINGS_ACTOR_SCOPE_QUERY,
  PLATFORM_SETTINGS_CONNECTIONS_QUERY,
  PROVIDER_CONNECTION_WORKLIST_WHERE,
  type ProviderConnectionWorklistActor,
} from '@/features/platform/lib/provider-connection-worklist'
import { ShoppingResults } from '@/features/platform/components/ShoppingResults'
import {
  normalizeOfferWorklistCursor,
  offerWorklistHref,
  offerWorklistPage,
  PLATFORM_OFFERS_QUERY,
} from '@/features/platform/lib/offer-worklist'
import {
  includeSelectedSchedule,
  normalizeScheduleWorklistCursor,
  normalizeSelectedScheduleId,
  PLATFORM_NETWORK_DESK_QUERY,
  scheduleWorklistPage,
  scheduleWorklistScopeAuthorized,
  type ScheduleWorklistActor,
} from '@/features/platform/lib/schedule-worklist'
import {
  normalizePassengerServiceCursor,
  passengerServiceHref,
  passengerServicePage,
  passengerServiceScopeAuthorized,
  PASSENGER_SERVICE_QUERY,
  type PassengerServiceActor,
  type PassengerServiceRow,
} from '@/features/platform/lib/passenger-worklist'
import {
  normalizeRecoveryCursor,
  normalizeRecoveryFrom,
  RECOVERY_DESK_QUERY,
  RECOVERY_DISRUPTION_PAGE_SIZE,
  RECOVERY_FLIGHT_PAGE_SIZE,
  recoveryCursorHref,
  recoveryOuterPage,
} from '@/features/platform/lib/recovery-queue'
import {
  auditEventWorklistPage,
  auditEventWorklistScope,
  auditEventWorklistHref,
  normalizeAuditEventCursor,
  PLATFORM_AUDIT_ACTOR_SCOPE_QUERY,
  PLATFORM_AUDIT_EVENTS_QUERY,
  AUDIT_EVENT_WORKLIST_WHERE,
  type AuditEventWorklistActor,
} from '@/features/platform/lib/audit-event-worklist'
import { formatMinorUnits } from '@/features/keystone/lib/money'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export function Shell({ title, eyebrow, description, children, parent }: { title: string; eyebrow: string; description: string; children: React.ReactNode; parent?: { title: string; href: string } }) {
  return <PageContainer title={title} header={<div><p className="text-sm font-medium text-primary">{eyebrow}</p><h1 className="text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">{description}</p></div>} breadcrumbs={[{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'page' as const, label: 'Platform' }, ...(parent ? [{ type: 'link' as const, label: parent.title, href: parent.href }] : []), { type: 'page' as const, label: title }]}><div className="min-w-0 space-y-5 p-4 [overflow-wrap:anywhere] md:p-6">{children}</div></PageContainer>
}

function SearchFilters({ action, filters, label, statuses = [], hidden = {} }: { action: string; filters: { q: string; status: string }; label: string; statuses?: string[]; hidden?: Record<string,string> }) {
  return <form action={action} className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
    {Object.entries(hidden).map(([name,value]) => <input type="hidden" key={name} name={name} value={value} />)}
    <label className="min-w-0 flex-1 text-sm font-medium">{label}<input type="search" name="q" defaultValue={filters.q} maxLength={120} className="mt-2 w-full rounded-lg border bg-background px-3 py-2" /></label>
    {statuses.length > 0 && <label className="text-sm font-medium">Status<select name="status" defaultValue={filters.status} className="mt-2 block rounded-lg border bg-background px-3 py-2"><option value="">All statuses</option>{statuses.map(status => <option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></label>}
    <button className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Search</button><Link className="rounded-lg border px-4 py-2 text-sm" href={action}>Clear</Link>
  </form>
}

function Boundary({ children }: { children: React.ReactNode }) { return <aside className="border-l-4 border-amber-500/60 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">{children}</aside> }
function Failure({ error }: { error: string }) { return <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm">This section could not be loaded. Check your access and try again.</p> }
function Empty({ children }: { children: React.ReactNode }) { return <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{children}</p> }
function DateText({ value }: { value?: string | null }) { return <>{value ? new Date(value).toLocaleString() : '—'}</> }
function Money({ amount, currency }: { amount?: number | null; currency?: string | null }) { return <>{formatMinorUnits(amount, currency)}</> }

// Station work defaults to today's operation in the operator carrier's timezone (UTC when it is unavailable).
async function carrierToday() {
  const identity = await keystoneClient<{ authenticatedItem?: { carrier?: { defaultTimezone: string | null } | null } | null }>(`query DepartureCarrierTimezone { authenticatedItem { ... on User { carrier { defaultTimezone } } } }`)
  const timezone = identity.success ? identity.data.authenticatedItem?.carrier?.defaultTimezone : null
  try {
    return carrierCalendarDate(new Date(), timezone || 'UTC')
  } catch {
    return carrierCalendarDate(new Date(), 'UTC')
  }
}

export async function PlatformDeparturesPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ? await searchParams : {}
  const serviceDate = typeof params.date === 'string' ? params.date : await carrierToday()
  const originCode = typeof params.origin === 'string' && params.origin.trim() ? params.origin.trim().toUpperCase() : null
  const cleanupCursor = typeof params.cleanupCursor === 'string' ? params.cleanupCursor : null
  const response = await keystoneClient<{ departureManifest: any }>(`query PlatformDepartureManifest($serviceDate:String!,$originCode:String,$cleanupCursor:String){departureManifest(serviceDate:$serviceDate,originCode:$originCode,cleanupCursor:$cleanupCursor)}`, { serviceDate, originCode, cleanupCursor })
  const nextCleanupCursor = response.success ? response.data.departureManifest.refundCleanup.nextCursor as string | null : null
  const nextCleanupParams = nextCleanupCursor ? new URLSearchParams({ date: serviceDate, cleanupCursor: nextCleanupCursor }) : null
  if (nextCleanupParams && originCode) nextCleanupParams.set('origin', originCode)
  const cleanupNextHref = nextCleanupParams ? `/dashboard/platform/departures?${nextCleanupParams.toString()}` : null
  return <Shell title="Departures" eyebrow="Station-scoped passenger service" description="Work the live passenger-service manifest: document evidence, check-in, bags, boarding, and offload. Flight dispatch, security, load control, safety, government clearance, and crew legality remain outside this desk.">
    <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]"><label className="text-sm font-medium">Service date<input type="date" name="date" defaultValue={serviceDate} required className="mt-2 w-full rounded-lg border bg-background px-3 py-2" /></label><label className="text-sm font-medium">Origin station <span className="font-normal text-muted-foreground">(optional)</span><input name="origin" defaultValue={originCode ?? ''} maxLength={3} placeholder="JFK" className="mt-2 w-full rounded-lg border bg-background px-3 py-2 uppercase" /></label><button className="self-end rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground">Load station manifest</button></form>
    <Boundary>Document verification records station evidence only. It does not assert government admissibility or clear a passenger for travel.</Boundary>
    {response.success ? <DepartureDesk manifest={response.data.departureManifest} detailBase="/dashboard/platform/departures" cleanupNextHref={cleanupNextHref} /> : <Failure error={response.error} />}
  </Shell>
}

export async function PlatformBookingsPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ? await searchParams : {}
  const locator = typeof params.locator === 'string' ? params.locator.trim().toUpperCase() : ''
  const locatorFilter = locator ? /^[A-Z0-9]{5,8}$/.test(locator) ? { equals: locator } : { contains: locator } : null
  const locatorWhere = locatorFilter ? { recordLocator: locatorFilter } : {}
  const cleanupWhere = {
    AND: [
      { OR: [{ paymentStatus: { equals: 'refunded' } }, { ticketingStatus: { equals: 'voided' } }] },
      ...(locatorFilter ? [locatorWhere] : []),
    ],
  }
  const bookingCursor = normalizeBookingWorklistCursor(params.bookingCursor)
  const response = await readBookingWorkspace({
    where: locatorWhere,
    cleanupWhere,
    bookingCursor: bookingCursor ? { id: bookingCursor } : null,
    bookingSkip: bookingCursor ? 1 : 0,
    // Only evidence awaiting the checker, narrowed by the locator, so the Payments queue's maker-checker link
    // reaches evidence older than the newest 100 rows.
    evidenceWhere: { status: { equals: 'submitted' }, ...(locatorFilter ? { booking: { recordLocator: locatorFilter } } : {}) },
  })
  const bookingPage = response.success ? bookingWorklistPage(response.data.bookings, response.data.bookingsCount) : null
  const bookingNextHref = bookingPage?.nextCursor
    ? bookingWorklistNextHref('/dashboard/platform/bookings', locator, bookingPage.nextCursor)
    : null
  return <Shell title="Bookings" eyebrow="Servicing and settlement control" description="Accept held offers, record only independently approved settlement evidence, issue tickets, and cancel or refund through aggregate commands.">
    <form action="/dashboard/platform/bookings" className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-medium">Record locator search<input name="locator" defaultValue={locator} placeholder="Exact or partial locator" className="mt-2 w-full rounded-lg border bg-background px-3 py-2 uppercase" /></label><button className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground">Find booking</button></form>
    <Boundary>Maker-checker remains mandatory: an imported settlement record is not a payment until a different authorized user approves the evidence. Provider and settlement success are never fabricated here.</Boundary>
    {response.success ? <BookingDesk offers={response.data.offers} bookings={bookingPage?.items ?? []} bookingCount={bookingPage?.totalCount ?? 0} bookingHasNextPage={bookingPage?.hasNextPage ?? false} bookingNextHref={bookingNextHref} refundCleanupBookings={response.data.refundCleanupBookings.slice(0, 100)} refundCleanupTruncated={response.data.refundCleanupBookingsCount > 100} evidences={response.data.manualPaymentEvidences} sectionErrors={response.sectionErrors} detailBase="/dashboard/platform/bookings" /> : <Failure error="Bookings could not be loaded" />}
  </Shell>
}

export async function PlatformPassengersPage({ searchParams }: { searchParams?: SearchParams } = {}) {
  const params = searchParams ? await searchParams : {}
  const filters = worklistSearch(params, ['active','merged','restricted','archived'])
  const passengerCursor = normalizePassengerServiceCursor(params.passengerCursor)
  const response = await keystoneClient<{ authenticatedItem: PassengerServiceActor; passengers: PassengerServiceRow[] | null; passengersCount: number | null }>(PASSENGER_SERVICE_QUERY, {
    passengerWhere: { ...(filters.q ? { OR: [{ givenName: textSearch(filters.q) }, { familyName: textSearch(filters.q) }, { passengerKey: textSearch(filters.q) }] } : {}), ...(filters.status ? { status: { equals: filters.status } } : {}) },
    passengerCursor: passengerCursor ? { id: passengerCursor } : null,
    passengerSkip: passengerCursor ? 1 : 0,
  })
  const page = response.success ? passengerServicePage(response.data.passengers, response.data.passengersCount, passengerCursor, passengerServiceScopeAuthorized(response.data.authenticatedItem)) : null
  const firstPageHref = passengerCursor ? withWorklistSearch(passengerServiceHref('/dashboard/platform/passengers'), filters) : null
  const nextPageHref = page?.state === 'ready' && page.nextCursor
    ? withWorklistSearch(passengerServiceHref('/dashboard/platform/passengers', page.nextCursor), filters)
    : null
  return <Shell title="Passengers & service" eyebrow="Customer and station context" description="Locate a passenger’s carrier-scoped service workload before entering a booking or station task.">
    <SearchFilters action="/dashboard/platform/passengers" filters={filters} label="Passenger name or reference" statuses={['active','merged','restricted','archived']} />
    <Boundary>Restricted document data is deliberately absent. Travel-document evidence and government admissibility remain authority-specific decisions.</Boundary>
    {!response.success ? <><Failure error={response.error} />{firstPageHref && <Link href={firstPageHref} className="inline-flex rounded-lg border px-3 py-2 text-sm">Retry without the saved passenger cursor</Link>}</>
      : page?.state === 'unavailable' ? <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm"><p>Authorized passenger rows or their count were denied or incomplete. No empty state is inferred; verify access and retry.</p>{firstPageHref && <Link href={firstPageHref} className="mt-2 inline-flex font-medium underline">Retry from first page</Link>}</div>
        : page?.state === 'stale' ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm"><p>This passenger continuation returned no visible rows. Its cursor may be stale or the authorized results may have changed.</p>{firstPageHref && <Link href={firstPageHref} className="mt-2 inline-flex font-medium underline">Return to first page</Link>}</div>
          : page?.state === 'empty' ? <Empty>No carrier-authorized passenger records currently match this worklist.</Empty>
            : <div className="space-y-3">
              {page?.state === 'inconsistent' && <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm"><p>{page.items.length ? 'Passenger rows and the authorized count disagree; the separate reads may have observed concurrent changes.' : `No passenger rows were returned although the authorized count is ${page.totalCount}.`}</p>{(firstPageHref || withWorklistSearch(passengerServiceHref('/dashboard/platform/passengers'), filters)) && <Link href={firstPageHref ?? withWorklistSearch(passengerServiceHref('/dashboard/platform/passengers'), filters)} className="mt-2 inline-flex font-medium underline">Reload first page</Link>}</div>}
              {page && page.items.length > 0 && <><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{page.items.length} on this page · {page.totalCount} carrier-authorized passenger records total.{page.hasNextPage ? ' Additional records are available on later pages.' : ''}</p>{nextPageHref && <Link href={nextPageHref} className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Next 100 passengers →</Link>}</div><div className="grid gap-3 lg:grid-cols-2">{page.items.map(passenger => <Link key={passenger.id} href={detailWithReturn(`/dashboard/platform/passengers/${passenger.id}`, params)} className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="font-semibold">{passenger.givenName ?? 'Name unavailable'} {passenger.familyName ?? 'Name unavailable'}</h2><p className="text-sm text-muted-foreground">{passenger.passengerKey ?? 'Passenger key unavailable'} · {passenger.status ?? 'Status unavailable'}</p></div><span className="text-xs text-muted-foreground">Open service record →</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Bookings</dt><dd className="font-medium">{passenger.bookingPassengersCount ?? '—'}</dd></div><div><dt className="text-muted-foreground">Requests</dt><dd className="font-medium">{passenger.serviceRequestsCount ?? '—'}</dd></div><div><dt className="text-muted-foreground">Check-ins / bags</dt><dd className="font-medium">{passenger.checkInsCount ?? '—'} / {passenger.bagsCount ?? '—'}</dd></div><div><dt className="text-muted-foreground">Language</dt><dd className="font-medium">{passenger.preferredLanguage || '—'}</dd></div></dl></Link>)}</div></>}
            </div>}
  </Shell>
}

export async function PlatformDisruptionsPage({ searchParams }: { searchParams?: SearchParams }) {
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
  const serviceNextHref = servicePage?.nextCursor ? recoveryCursorHref('/dashboard/platform/disruptions', cursorState, 'service', servicePage.nextCursor) : null
  const disruptionNextHref = disruptionPage?.nextCursor ? recoveryCursorHref('/dashboard/platform/disruptions', cursorState, 'disruption', disruptionPage.nextCursor) : null
  return <Shell title="Disruptions" eyebrow="Irregular operations" description="Publish passenger impact, inspect a disruption record, and explicitly protect replacement inventory before re-accommodation.">
    <Boundary>This desk does not establish operational cause, safety status, compensation eligibility, or government clearance. Apply applicable policy and verified external operational facts.</Boundary>
    {response.success ? <RecoveryDesk key={disruptionCursor ?? 'first'} flights={servicePage?.items ?? []} flightCount={servicePage?.totalCount ?? 0} flightHasNextPage={servicePage?.hasNextPage ?? false} serviceNextHref={serviceNextHref} recoveryServicesFrom={recoveryServicesFrom} disruptions={disruptionPage?.items ?? []} disruptionCount={disruptionPage?.totalCount ?? 0} disruptionHasNextPage={disruptionPage?.hasNextPage ?? false} disruptionNextHref={disruptionNextHref} detailBase="/dashboard/platform/disruptions" /> : <Failure error={response.error} />}
  </Shell>
}

async function networkDataForInventory(flightCursor: string | null, flightFrom: string) {
  return keystoneClient<NetworkDeskResponse>(PLATFORM_INVENTORY_DESK_QUERY, {
    flightWhere: futureFlightWorklistWhere(flightFrom),
    flightCursor: flightCursor ? { id: flightCursor } : null,
    flightCursorId: flightCursor ?? '',
    flightSkip: flightCursor ? 1 : 0,
  })
}

type NetworkDeskResponse = {
  authenticatedItem?: (Exclude<ScheduleWorklistActor, null | undefined> & {
    carrier?: { id: string; defaultCurrencyCode: string | null; defaultTimezone: string | null } | null
  }) | null
  flightSchedules?: any[] | null
  flightSchedulesCount?: number | null
  selectedSchedule?: any[] | null
  flightInstances: any[] | null
  flightInstancesCount: number | null
  flightCursorRecord: Array<{ id: string }> | null
}

function resolveNetworkFlightPage(rows: any[] | null, count: number | null, cursor: string | null, cursorRecords: Array<{ id: string }> | null, actor: ScheduleWorklistActor, requireInventoryBuckets = true) {
  const cursorAuthorized = !cursor || Boolean(cursorRecords?.some(record => record.id === cursor))
  const page = flightWorklistPage(rows, count, cursor, flightWorklistScopeAuthorized(actor), cursorAuthorized)
  if (requireInventoryBuckets && page.items.some(flight => !Array.isArray(flight.inventoryBuckets))) {
    return {
      page: { ...page, items: [], totalCount: null, hasNextPage: false, nextCursor: null, state: 'unavailable' as const },
      flights: [],
    }
  }
  const flights = page.items.map(flight => {
    if (!Array.isArray(flight.inventoryBuckets)) return flight
    const buckets = boundedFlightInventoryBuckets(flight.inventoryBuckets)
    return { ...flight, inventoryBuckets: buckets.items, inventoryBucketsOverflow: buckets.hasAdditional }
  })
  return { page, flights }
}

async function networkData(scheduleCursor: string | null, selectedScheduleId: string | null, flightCursor: string | null, flightFrom: string) {
  return keystoneClient<NetworkDeskResponse>(PLATFORM_NETWORK_DESK_QUERY, {
    scheduleWhere: { status: { equals: 'published' } },
    scheduleCursor: scheduleCursor ? { id: scheduleCursor } : null,
    scheduleSkip: scheduleCursor ? 1 : 0,
    selectedScheduleId: selectedScheduleId ?? '',
    flightWhere: futureFlightWorklistWhere(flightFrom),
    flightCursor: flightCursor ? { id: flightCursor } : null,
    flightCursorId: flightCursor ?? '',
    flightSkip: flightCursor ? 1 : 0,
  })
}

export async function PlatformSchedulesPage({ searchParams }: { searchParams?: SearchParams } = {}) {
  const params = searchParams ? await searchParams : {}
  const scheduleCursor = normalizeScheduleWorklistCursor(params.scheduleCursor)
  const requestedScheduleId = normalizeSelectedScheduleId(params.scheduleId)
  const requestedFlightCursor = normalizeFlightWorklistCursor(params.flightCursor)
  const requestedFlightFrom = normalizeFlightWorklistFrom(params.flightFrom)
  const flightCursor = requestedFlightCursor && requestedFlightFrom ? requestedFlightCursor : null
  const flightFrom = requestedFlightFrom ?? new Date().toISOString()
  const response = await networkData(scheduleCursor, requestedScheduleId, flightCursor, flightFrom)
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
  const flightQueue = response.success
    ? resolveNetworkFlightPage(response.data.flightInstances, response.data.flightInstancesCount, flightCursor, response.data.flightCursorRecord, response.data.authenticatedItem)
    : null
  const flightRetryHref = requestedFlightCursor
    ? flightWorklistHref('/dashboard/platform/schedules', null, flightFrom, {
      ...(scheduleCursor ? { scheduleCursor } : {}),
      ...(requestedScheduleId ? { scheduleId: requestedScheduleId } : {}),
    })
    : null
  return <Shell title="Schedules & flights" eyebrow="Network control" description="Provision sellable dated service from published schedule patterns. Every command is idempotent and preserves retained service history.">
    <Boundary>Opening or closing sales is commercial control only. Dispatch, equipment, operational movement, safety, and crew-legality authority remain external.</Boundary>
    {response.success ? <NetworkDesk schedules={schedules} flights={flightQueue?.flights ?? []} defaultCurrencyCode={response.data.authenticatedItem?.carrier?.defaultCurrencyCode ?? 'USD'} defaultTimezone={response.data.authenticatedItem?.carrier?.defaultTimezone ?? 'UTC'} mode="schedules" detailBase="/dashboard/platform/schedules" scheduleSelectionId={scheduleSelectionId} scheduleSelectionUnavailable={scheduleSelectionUnavailable} scheduleWorklist={schedulePage ? { state: schedulePage.state, totalCount: schedulePage.totalCount, pageItemCount: schedulePage.items.length, nextCursor: schedulePage.state === 'ready' ? schedulePage.nextCursor : null, cursor: scheduleCursor } : undefined} flightWorklist={flightQueue ? { state: flightQueue.page.state, totalCount: flightQueue.page.totalCount, pageItemCount: flightQueue.page.items.length, nextCursor: flightQueue.page.state === 'ready' ? flightQueue.page.nextCursor : null, cursor: flightCursor, from: flightFrom } : undefined} /> : <><Failure error={response.error} />{flightRetryHref && <Link href={flightRetryHref} className="inline-flex rounded-lg border px-3 py-2 text-sm">Return to first future-flight page</Link>}</>}
  </Shell>
}

export async function PlatformInventoryPage({ searchParams }: { searchParams?: SearchParams } = {}) {
  const params = searchParams ? await searchParams : {}
  const requestedFlightCursor = normalizeFlightWorklistCursor(params.flightCursor)
  const requestedFlightFrom = normalizeFlightWorklistFrom(params.flightFrom)
  const flightCursor = requestedFlightCursor && requestedFlightFrom ? requestedFlightCursor : null
  const flightFrom = requestedFlightFrom ?? new Date().toISOString()
  const response = await networkDataForInventory(flightCursor, flightFrom)
  const flightQueue = response.success
    ? resolveNetworkFlightPage(response.data.flightInstances, response.data.flightInstancesCount, flightCursor, response.data.flightCursorRecord, response.data.authenticatedItem, false)
    : null
  const flightRetryHref = requestedFlightCursor
    ? flightWorklistHref('/dashboard/platform/inventory', null, flightFrom)
    : null
  return <Shell title="Inventory & fares" eyebrow="Commercial control" description="Maintain dated bucket authorization and sale state without reducing authorization below retained sold, held, or blocked inventory.">
    <Boundary>Availability is a bounded commercial projection, not a seat-map, load-control, or operational availability assertion.</Boundary>
    {response.success ? <NetworkDesk schedules={[]} flights={flightQueue?.flights ?? []} defaultCurrencyCode={response.data.authenticatedItem?.carrier?.defaultCurrencyCode ?? 'USD'} defaultTimezone={response.data.authenticatedItem?.carrier?.defaultTimezone ?? 'UTC'} inventoryActorCarrierId={response.data.authenticatedItem?.carrier?.id ?? ''} mode="inventory" detailBase="/dashboard/platform/inventory" flightWorklist={flightQueue ? { state: flightQueue.page.state, totalCount: flightQueue.page.totalCount, pageItemCount: flightQueue.page.items.length, nextCursor: flightQueue.page.state === 'ready' ? flightQueue.page.nextCursor : null, cursor: flightCursor, from: flightFrom } : undefined} /> : <><Failure error={response.error} />{flightRetryHref && <Link href={flightRetryHref} className="inline-flex rounded-lg border px-3 py-2 text-sm">Return to first future-flight page</Link>}</>}
  </Shell>
}

export async function PlatformOffersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  // No demo route: inventory is searched only once the operator enters valid IATA codes and a date.
  const airport = (value: unknown) => typeof value === 'string' && /^[A-Za-z]{3}$/.test(value.trim()) ? value.trim().toUpperCase() : ''
  const origin = airport(params.origin); const destination = airport(params.destination)
  const date = typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : await carrierToday()
  const search = Boolean(origin && destination)
  const offerCursor = normalizeOfferWorklistCursor(params.offerCursor)
  const shoppingState = { origin, destination, date }
  const response = await keystoneClient<{ authenticatedItem?: { carrier?: { defaultTimezone: string } | null } | null; airlineFlightOptions: any[]; passengers: any[]; offers: any[]; offersCount: number }>(PLATFORM_OFFERS_QUERY, {
    origin,
    destination,
    date,
    offerWhere: {},
    offerCursor: offerCursor ? { id: offerCursor } : null,
    offerSkip: offerCursor ? 1 : 0,
    search,
  })
  const offerPage = response.success ? offerWorklistPage(response.data.offers, response.data.offersCount, offerCursor) : null
  const nextOffersHref = offerPage?.nextCursor ? offerWorklistHref('/dashboard/platform/offers', shoppingState, offerPage.nextCursor) : null
  const latestOffersHref = offerCursor ? offerWorklistHref('/dashboard/platform/offers', shoppingState) : null
  return <Shell title="Offers" eyebrow="Retailing queue" description="Search dated sellable inventory and place an atomic, expiring hold before accepting an offer into a booking.">
    <form action="/dashboard/platform/offers" className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-4" method="get"><label className="text-sm font-medium">From<input name="origin" defaultValue={origin} maxLength={3} required pattern="[A-Za-z]{3}" placeholder="IATA" className="mt-2 w-full rounded-lg border bg-background px-3 py-2 uppercase" /></label><label className="text-sm font-medium">To<input name="destination" defaultValue={destination} maxLength={3} required pattern="[A-Za-z]{3}" placeholder="IATA" className="mt-2 w-full rounded-lg border bg-background px-3 py-2 uppercase" /></label><label className="text-sm font-medium">Date<input name="date" type="date" defaultValue={date} required className="mt-2 w-full rounded-lg border bg-background px-3 py-2" /></label><button className="self-end rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground">Search inventory</button></form>
    <Boundary>A held offer is neither a booking, payment, ticket, nor travel entitlement. Price and availability remain the persisted offer’s own values.</Boundary>
    {!response.success ? <><Failure error={response.error} />{latestOffersHref && <Link href={latestOffersHref} className="inline-flex rounded-lg border px-3 py-2 text-sm">Retry without the saved offer cursor</Link>}</> : <>{search ? <ShoppingResults flights={response.data.airlineFlightOptions} passengers={response.data.passengers} defaultTimezone={response.data.authenticatedItem?.carrier?.defaultTimezone ?? 'UTC'} /> : <Empty>Enter an origin, destination, and date to search sellable flights.</Empty>}<section><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Recent offers</h2><p className="text-sm text-muted-foreground">{offerPage?.items.length ?? 0} on this page · {offerPage?.totalCount ?? 0} carrier-authorized offers total.</p>{offerPage?.hasNextPage && <p className="text-xs text-muted-foreground">Additional offers are available on later pages.</p>}</div>{offerPage?.hasNextPage && nextOffersHref && <Link href={nextOffersHref} className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Next 50 offers →</Link>}</div>{offerPage?.items.length ? <div className="grid gap-2">{offerPage.items.map(offer => <Link key={offer.id} href={detailWithReturn(`/dashboard/platform/offers/${offer.id}`, params)} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 hover:bg-muted/40"><div><p className="font-medium">{offer.offerNumber}</p><p className="text-sm text-muted-foreground">{offer.source} · {offer.passengersCount} passenger(s) · expires <DateText value={offer.expiresAt} /></p></div><div className="text-right"><p className="font-medium"><Money amount={offer.totalAmount} currency={offer.currencyCode} /></p><p className="text-xs text-muted-foreground">{offer.status} · Open offer →</p></div></Link>)}</div> : offerPage?.state === 'stale' ? <div role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm"><p>This offers continuation returned no rows. Its cursor may be stale, or matching access/data may have changed.</p>{latestOffersHref && <Link href={latestOffersHref} className="mt-2 inline-flex font-medium underline">Return to latest offers</Link>}</div> : offerPage?.state === 'inconsistent' ? <div role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm"><p>No offer rows were returned although the authorized count is {offerPage.totalCount}. The separate reads may have observed concurrent changes.</p><Link href={offerWorklistHref('/dashboard/platform/offers', shoppingState)} className="mt-2 inline-flex font-medium underline">Reload latest offers</Link></div> : <Empty>No carrier-authorized offers currently match this worklist.</Empty>}</section></>}
  </Shell>
}

export async function PlatformPaymentsPage({ searchParams }: { searchParams?: SearchParams } = {}) {
  const params = searchParams ? await searchParams : {}
  const paymentCursor = normalizePaymentRecordCursor(params.paymentCursor)
  const evidenceCursor = normalizePaymentEvidenceCursor(params.evidenceCursor)
  const response = await keystoneClient<{
    authenticatedItem: PaymentEvidenceWorklistActor & PaymentRecordWorklistActor
    payments: any[] | null
    paymentsCount: number | null
    paymentCursorRecord: Array<{ id: string }> | null
    manualPaymentEvidences: any[] | null
    manualPaymentEvidencesCount: number | null
    evidenceCursorRecord: Array<{ id: string }> | null
  }>(PLATFORM_PAYMENTS_DESK_QUERY, {
    paymentWhere: PAYMENT_RECORD_WORKLIST_WHERE,
    paymentCursor: paymentCursor ? { id: paymentCursor } : null,
    paymentSkip: paymentCursor ? 1 : 0,
    paymentCursorId: paymentCursor ?? '',
    evidenceWhere: PAYMENT_EVIDENCE_WORKLIST_WHERE,
    evidenceCursor: evidenceCursor ? { id: evidenceCursor } : null,
    evidenceSkip: evidenceCursor ? 1 : 0,
    evidenceCursorId: evidenceCursor ?? '',
  })
  const paymentCursorAuthorized = !paymentCursor || Boolean(response.success && response.data.paymentCursorRecord?.some(record => record.id === paymentCursor))
  const evidenceCursorAuthorized = !evidenceCursor || Boolean(response.success && response.data.evidenceCursorRecord?.some(record => record.id === evidenceCursor))
  const paymentPage = response.success
    ? paymentRecordWorklistPage(
      response.data.payments,
      response.data.paymentsCount,
      paymentCursor,
      paymentRecordWorklistScopeAuthorized(response.data.authenticatedItem),
      paymentCursorAuthorized,
    )
    : null
  const evidencePage = response.success
    ? paymentEvidenceWorklistPage(
      response.data.manualPaymentEvidences,
      response.data.manualPaymentEvidencesCount,
      evidenceCursor,
      paymentEvidenceWorklistScopeAuthorized(response.data.authenticatedItem),
      evidenceCursorAuthorized,
    )
    : null
  const firstPaymentPageHref = paymentCursor ? paymentDeskWorklistHref('/dashboard/platform/payments', { evidenceCursor }) : null
  const nextPaymentPageHref = paymentPage?.state === 'ready' && paymentPage.hasNextPage
    ? paymentDeskWorklistHref('/dashboard/platform/payments', { paymentCursor: paymentPage.nextCursor, evidenceCursor })
    : null
  const firstEvidencePageHref = evidenceCursor ? paymentDeskWorklistHref('/dashboard/platform/payments', { paymentCursor }) : null
  const nextEvidencePageHref = evidencePage?.state === 'ready' && evidencePage.hasNextPage
    ? paymentDeskWorklistHref('/dashboard/platform/payments', { paymentCursor, evidenceCursor: evidencePage.nextCursor })
    : null
  const latestPaymentPageHref = paymentDeskWorklistHref('/dashboard/platform/payments', { evidenceCursor })
  const latestEvidencePageHref = paymentDeskWorklistHref('/dashboard/platform/payments', { paymentCursor })

  return <Shell title="Payments & refunds" eyebrow="Financial operations" description="Review captured and refunded value, then enter the booking desk to submit or independently approve external settlement evidence.">
    <Boundary>Amounts are persisted minor-unit records. Provider acceptance, bank settlement, and refund completion require external evidence; this desk never represents configuration or an operator click as provider success.</Boundary>
    {!response.success ? <><Failure error={response.error} />{firstPaymentPageHref && <Link href={firstPaymentPageHref} className="mr-2 inline-flex rounded-lg border px-3 py-2 text-sm">Retry payment list from first page</Link>}{firstEvidencePageHref && <Link href={firstEvidencePageHref} className="inline-flex rounded-lg border px-3 py-2 text-sm">Retry evidence queue from first page</Link>}</> : <div className="space-y-6">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">Independent approval queue</h2><p className="text-sm text-muted-foreground">Submitted is an internal evidence-review status, not proof of provider acceptance, bank settlement, or refund completion.</p></div>
          {evidencePage?.state === 'ready' && evidencePage.hasNextPage && nextEvidencePageHref && <Link href={nextEvidencePageHref} className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Next 100 evidence records →</Link>}
        </div>
        {evidencePage?.state === 'unavailable' ? <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm"><p>Submitted evidence rows, their count, or carrier payment-read scope were denied or incomplete. No empty state is inferred.</p>{firstEvidencePageHref && <Link href={firstEvidencePageHref} className="mt-2 inline-flex font-medium underline">Retry from first evidence page</Link>}</div>
          : evidencePage?.state === 'empty' ? <Empty>No submitted evidence is currently in the carrier-authorized review queue.</Empty>
            : evidencePage?.state === 'stale' ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm"><p>This evidence continuation is no longer present in the current authorized submitted set.</p>{firstEvidencePageHref && <Link href={firstEvidencePageHref} className="mt-2 inline-flex font-medium underline">Return to first evidence page</Link>}</div>
              : evidencePage?.state === 'inconsistent' ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm"><p>Submitted evidence rows and their carrier-authorized count disagree; the separate reads may have observed concurrent changes. No rows are presented.</p><Link href={latestEvidencePageHref} className="mt-2 inline-flex font-medium underline">Reload first evidence page</Link></div>
                : evidencePage?.state === 'ready' ? <>
                  <p className="mb-3 text-sm text-muted-foreground">{evidencePage.items.length} records on this page · {evidencePage.totalCount} carrier-authorized submitted evidence records total.</p>
                  {firstEvidencePageHref && <Link href={firstEvidencePageHref} className="mb-3 inline-flex font-medium underline">First evidence page</Link>}
                  <div className="space-y-2">{evidencePage.items.map(evidence => <Link key={evidence.id} href={evidence.booking?.recordLocator ? `/dashboard/platform/bookings?locator=${encodeURIComponent(evidence.booking.recordLocator)}` : `/dashboard/platform/payments`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 hover:bg-amber-500/10"><div><p className="font-medium">{evidence.booking?.recordLocator ?? 'Booking unavailable under current access'} · {evidence.purpose}</p><p className="text-sm text-muted-foreground">{evidence.externalReference} · submitted by {evidence.submittedBy?.name ?? 'an operator not visible under current access'}</p></div><span className="text-sm">{evidence.booking?.recordLocator ? 'Open evidence approval →' : 'Booking task unavailable'}</span></Link>)}</div>
                </>
                  : <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">The evidence queue result is unavailable; no empty state is inferred.</div>}
      </section>
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">Payment records</h2>{paymentPage?.state === 'ready' && <p className="text-sm text-muted-foreground">{paymentPage.items.length} records on this page · {paymentPage.totalCount} carrier-authorized payment records total.</p>}</div>
          {paymentPage?.state === 'ready' && paymentPage.hasNextPage && nextPaymentPageHref && <Link href={nextPaymentPageHref} className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Next 100 payment records →</Link>}
        </div>
        {paymentPage?.state === 'unavailable' ? <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm"><p>Payment rows, their count, or carrier payment-read scope were denied or incomplete. No empty state is inferred.</p>{firstPaymentPageHref && <Link href={firstPaymentPageHref} className="mt-2 inline-flex font-medium underline">Retry payment list from first page</Link>}</div>
          : paymentPage?.state === 'empty' ? <Empty>No carrier-authorized payment records currently match this worklist.</Empty>
            : paymentPage?.state === 'stale' ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm"><p>This payment-list continuation could not be verified against the current authorized result. Its cursor may be stale or out of scope, or matching records/access may have changed. No rows are presented.</p>{firstPaymentPageHref && <Link href={firstPaymentPageHref} className="mt-2 inline-flex font-medium underline">Return to first payment page</Link>}</div>
              : paymentPage?.state === 'inconsistent' ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm"><p>Payment rows and their carrier-authorized count disagree; the separate reads may have observed concurrent changes. No rows are presented.</p><Link href={latestPaymentPageHref} className="mt-2 inline-flex font-medium underline">Reload first payment page</Link></div>
                : paymentPage?.state === 'ready' ? <>
                  {firstPaymentPageHref && <Link href={firstPaymentPageHref} className="mb-3 inline-flex font-medium underline">First payment page</Link>}
                  <div className="grid gap-2">{paymentPage.items.map(payment => <Link key={payment.id} href={detailWithReturn(`/dashboard/platform/payments/${payment.id}`, params)} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 hover:bg-muted/40"><div><p className="font-medium">{payment.booking?.recordLocator ?? payment.paymentKey}</p><p className="text-sm text-muted-foreground">{payment.provider?.name ?? 'Provider unavailable'} · {payment.instrumentBrand ?? 'instrument'} {payment.instrumentLast4 ? `••${payment.instrumentLast4}` : ''}</p></div><div className="text-right"><p className="font-medium"><Money amount={payment.capturedAmount} currency={payment.currencyCode} /></p><p className="text-xs text-muted-foreground">{payment.status} · <Money amount={payment.refundedAmount} currency={payment.currencyCode} /> refunded · Open record →</p></div></Link>)}</div>
                </>
                  : <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">The payment-list result is unavailable; no empty state is inferred.</div>}
      </section>
    </div>}
  </Shell>
}

export async function PlatformManifestsPage({ searchParams }: { searchParams?: SearchParams } = {}) {
  const params = searchParams ? await searchParams : {}
  const filters = worklistSearch(params, [])
  const auditEventCursor = normalizeAuditEventCursor(params.auditEventCursor)
  const actorResponse = await keystoneClient<{ authenticatedItem: AuditEventWorklistActor }>(PLATFORM_AUDIT_ACTOR_SCOPE_QUERY)
  const actor = actorResponse.success ? actorResponse.data.authenticatedItem : null
  const scope = actorResponse.success ? auditEventWorklistScope(actor) : 'unavailable'
  const response = scope === 'authorized'
    ? await keystoneClient<{
      auditEvents: any[] | null
      auditEventsCount: number | null
      auditEventCursorRecord: Array<{ id: string }> | null
    }>(PLATFORM_AUDIT_EVENTS_QUERY, {
      auditEventWhere: { AND: [AUDIT_EVENT_WORKLIST_WHERE, ...(filters.q ? [{ OR: [{ eventKey: textSearch(filters.q) }, { action: textSearch(filters.q) }, { aggregateId: textSearch(filters.q) }, { correlationId: textSearch(filters.q) }] }] : []), ...(filters.status ? [{ status: { equals: filters.status } }] : [])] },
      auditEventCursor: auditEventCursor ? { id: auditEventCursor } : null,
      auditEventSkip: auditEventCursor ? 1 : 0,
      auditEventCursorId: auditEventCursor ?? '',
    })
    : null
  const cursorAuthorized = !auditEventCursor || Boolean(response?.success && response.data.auditEventCursorRecord?.some(record => record.id === auditEventCursor))
  const auditPage = response?.success
    ? auditEventWorklistPage(
      response.data.auditEvents,
      response.data.auditEventsCount,
      auditEventCursor,
      scope === 'authorized',
      cursorAuthorized,
    )
    : null
  const firstAuditPageHref = auditEventCursor ? withWorklistSearch(auditEventWorklistHref('/dashboard/platform/manifests'), filters) : null
  const nextAuditPageHref = auditPage?.state === 'ready' && auditPage.hasNextPage
    ? withWorklistSearch(auditEventWorklistHref('/dashboard/platform/manifests', auditPage.nextCursor), filters)
    : null

  return <Shell title="Manifest entry & audit" eyebrow="Passenger service evidence ledger" description="Enter the live passenger-service desk or trace carrier-authorized command evidence by actor, source, aggregate, and correlation.">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"><div><h2 className="font-semibold">Passenger manifest</h2><p className="text-sm text-muted-foreground">Station-scoped check-in, bag, boarding, and offload operations.</p></div><Link href="/dashboard/platform/departures" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Open departure control</Link></div>
    <SearchFilters action="/dashboard/platform/manifests" filters={filters} label="Action or resource reference" statuses={[]} />
    <Boundary>This evidence index is not a government submission, safety manifest, certified load document, or regulatory export.</Boundary>
    {!actorResponse.success ? <Failure error={actorResponse.error} /> : <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Recent command evidence</h2>{auditPage?.state === 'ready' && <p className="text-sm text-muted-foreground">{auditPage.items.length} events on this page · {auditPage.totalCount} authorized audit events total.</p>}</div>{auditPage?.state === 'ready' && auditPage.hasNextPage && nextAuditPageHref && <Link href={nextAuditPageHref} className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Next 100 audit events →</Link>}</div>
      {scope === 'denied' ? <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">The current role lacks audit-read permission; no audit rows were requested and no empty state is inferred.</p>
        : scope === 'unavailable' ? <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">The actor role or carrier scope is incomplete; no audit rows were requested and no empty state is inferred.</p>
          : !response?.success ? <Failure error={response?.error ?? 'Audit rows, count, or cursor membership were unavailable'} />
            : auditPage?.state === 'unavailable' ? <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">Audit rows, count, or audit-read scope were denied or incomplete. No empty state is inferred.</p>
              : auditPage?.state === 'empty' ? <Empty>No authorized audit events were returned.</Empty>
                : auditPage?.state === 'stale' ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm"><p>This audit continuation could not be verified against the current authorized result. Its cursor may be stale or out of scope, or matching data/access may have changed. No rows are presented.</p>{firstAuditPageHref && <Link href={firstAuditPageHref} className="mt-2 inline-flex font-medium underline">Return to first audit page</Link>}</div>
                  : auditPage?.state === 'inconsistent' ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm"><p>Audit rows and their authorized count disagree; the separate reads may have observed concurrent changes. No rows are presented.</p><Link href={withWorklistSearch(auditEventWorklistHref('/dashboard/platform/manifests'), filters)} className="mt-2 inline-flex font-medium underline">Reload first audit page</Link></div>
                    : auditPage?.state === 'ready' ? <>{firstAuditPageHref && <Link href={firstAuditPageHref} className="mb-3 inline-flex font-medium underline">First audit page</Link>}<div className="space-y-2">{auditPage.items.map(event => <Link key={event.id} href={detailWithReturn(`/dashboard/platform/manifests/${event.id}`, params)} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 hover:bg-muted/40"><div><p className="font-medium">{event.action}</p><p className="text-sm text-muted-foreground">{event.aggregateType} · {event.aggregateId} · {event.actor?.name ?? event.approvedAgent?.legalName ?? 'Actor unavailable under current access'}</p></div><div className="text-right text-sm"><p>{event.source}</p><p className="text-xs text-muted-foreground"><DateText value={event.occurredAt} /> · Open evidence →</p></div></Link>)}</div></>
                      : <Failure error="Audit worklist state is unavailable" />}
    </section>}
  </Shell>
}

export async function PlatformSettingsPage({ searchParams }: { searchParams?: SearchParams } = {}) {
  const params = searchParams ? await searchParams : {}
  const filters = worklistSearch(params, ['pending', 'active', 'paused', 'failed', 'revoked'])
  const providerConnectionCursor = normalizeProviderConnectionCursor(params.providerConnectionCursor)
  const actorResponse = await keystoneClient<{ authenticatedItem: ProviderConnectionWorklistActor }>(PLATFORM_SETTINGS_ACTOR_SCOPE_QUERY)
  const actor = actorResponse.success ? actorResponse.data.authenticatedItem : null
  const scope = actorResponse.success ? providerConnectionScope(actor) : 'unavailable'
  const response = scope === 'authorized'
    ? await keystoneClient<{
      providerConnections: any[] | null
      providerConnectionsCount: number | null
      providerConnectionCursorRecord: Array<{ id: string }> | null
    }>(PLATFORM_SETTINGS_CONNECTIONS_QUERY, {
      providerConnectionWhere: { AND: [PROVIDER_CONNECTION_WORKLIST_WHERE, ...(filters.q ? [{ OR: [{ name: textSearch(filters.q) }, { connectionKey: textSearch(filters.q) }, { externalAccountId: textSearch(filters.q) }] }] : []), ...(filters.status ? [{ status: { equals: filters.status } }] : [])] },
      providerConnectionCursor: providerConnectionCursor ? { id: providerConnectionCursor } : null,
      providerConnectionSkip: providerConnectionCursor ? 1 : 0,
      providerConnectionCursorId: providerConnectionCursor ?? '',
    })
    : null
  const cursorAuthorized = !providerConnectionCursor || Boolean(response?.success && response.data.providerConnectionCursorRecord?.some(record => record.id === providerConnectionCursor))
  const connectionPage = response?.success
    ? providerConnectionWorklistPage(
      response.data.providerConnections,
      response.data.providerConnectionsCount,
      providerConnectionCursor,
      scope === 'authorized',
      cursorAuthorized,
    )
    : null
  const firstConnectionPageHref = providerConnectionCursor ? withWorklistSearch(providerConnectionWorklistHref('/dashboard/platform/settings'), filters) : null
  const nextConnectionPageHref = connectionPage?.state === 'ready' && connectionPage.hasNextPage
    ? withWorklistSearch(providerConnectionWorklistHref('/dashboard/platform/settings', connectionPage.nextCursor), filters)
    : null

  return <Shell title="Settings & readiness" eyebrow="Carrier configuration evidence" description="Review local carrier posture and persisted connection evidence without treating configured state as a live integration or certification claim.">
    <SearchFilters action="/dashboard/platform/settings" filters={filters} label="Connection name or reference" statuses={['pending', 'active', 'paused', 'failed', 'revoked']} />
    <Boundary>PSS, DCS, payment, baggage, government, safety, regulatory, and certification readiness require external validation. “Active” means only the persisted local lifecycle value.</Boundary>
    {!actorResponse.success ? <Failure error={actorResponse.error} /> : <div className="space-y-6">
      <section className="rounded-xl border bg-card p-4"><h2 className="font-semibold">Carrier commercial posture</h2><p className="mt-2 text-sm text-muted-foreground">{actor?.carrier ? `${actor.carrier.name ?? 'Carrier name unavailable'} · ${actor.carrier.code ?? 'Code unavailable'} · ${actor.carrier.defaultCurrencyCode ?? 'Currency unavailable'} · ${actor.carrier.defaultTimezone ?? 'Timezone unavailable'}` : 'No carrier identity was returned.'}</p><p className="mt-1 text-sm">Direct sales: <strong>{actor?.carrier?.directSalesEnabled === true ? 'explicitly enabled' : actor?.carrier?.directSalesEnabled === false ? 'disabled' : 'not returned'}</strong></p></section>
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Connection evidence</h2>{connectionPage?.state === 'ready' && <p className="text-sm text-muted-foreground">{connectionPage.items.length} connections on this page · {connectionPage.totalCount} carrier-authorized connections total.</p>}</div>{connectionPage?.state === 'ready' && connectionPage.hasNextPage && nextConnectionPageHref && <Link href={nextConnectionPageHref} className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Next 100 connections →</Link>}</div>
        {scope === 'denied' ? <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">The current role lacks carrier integration-read permission; no connection list was requested and no empty state is inferred.</p>
          : scope === 'unavailable' ? <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">The actor role or carrier scope is incomplete; no connection list was requested and no empty state is inferred.</p>
            : !response?.success ? <Failure error={response?.error ?? 'Provider connection rows, count, or cursor membership were unavailable'} />
              : connectionPage?.state === 'unavailable' ? <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">Provider connection rows, count, or integration-read scope were denied or incomplete. No empty state is inferred.</p>
                : connectionPage?.state === 'empty' ? <Empty>No carrier-authorized provider connection records were returned.</Empty>
                  : connectionPage?.state === 'stale' ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm"><p>This connection continuation could not be verified against the current authorized result. Its cursor may be stale or out of scope, or matching records/access may have changed. No rows are presented.</p>{firstConnectionPageHref && <Link href={firstConnectionPageHref} className="mt-2 inline-flex font-medium underline">Return to first connections page</Link>}</div>
                    : connectionPage?.state === 'inconsistent' ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm"><p>Connection rows and their carrier-authorized count disagree; the separate reads may have observed concurrent changes. No rows are presented.</p><Link href={withWorklistSearch(providerConnectionWorklistHref('/dashboard/platform/settings'), filters)} className="mt-2 inline-flex font-medium underline">Reload first connections page</Link></div>
                      : connectionPage?.state === 'ready' ? <>{firstConnectionPageHref && <Link href={firstConnectionPageHref} className="mb-3 inline-flex font-medium underline">First connections page</Link>}<div className="grid gap-3 lg:grid-cols-2">{connectionPage.items.map(connection => <Link key={connection.id} href={detailWithReturn(`/dashboard/platform/settings/${connection.id}`, params)} className="rounded-xl border bg-card p-4 hover:bg-muted/40"><div className="flex min-w-0 flex-wrap justify-between gap-3"><div className="min-w-0 flex-1"><h3 className="font-medium">{connection.name}</h3><p className="text-sm text-muted-foreground">{connection.provider?.name ?? 'Provider unavailable'} · {connection.connectionKey}</p></div><span className="text-xs">{connection.status} →</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Last local success evidence</dt><dd><DateText value={connection.lastSucceededAt} /></dd></div><div><dt className="text-muted-foreground">Last attempt</dt><dd><DateText value={connection.lastAttemptedAt} /></dd></div></dl>{connection.lastErrorCode && <p className="mt-3 text-sm text-destructive">{connection.lastErrorCode}: {connection.lastErrorMessage ?? 'No message'}</p>}</Link>)}</div></>
                        : <Failure error="Provider connection worklist state is unavailable" />}
      </section>
    </div>}
  </Shell>
}
