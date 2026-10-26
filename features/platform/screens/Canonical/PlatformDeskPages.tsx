import { readBookingWorkspace } from '@/features/platform/lib/booking-workspace'
import { NO_RECORD_ID } from '@/features/platform/lib/no-cursor'
import { detailWithReturn } from '@/features/platform/lib/desk-return'
import { worklistSearch, withWorklistSearch, textSearch } from '@/features/platform/lib/worklist-search'
import Link from 'next/link'
import { ChevronRight, Search } from 'lucide-react'

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
import { Code, DeskSection, DeskTone, Field, FilterBar, Notice, Panel, Pill, Readout, ReadoutStrip, RowLink, StatusLabel, TitleLine, Track, Well, deskInput, statusTone, DeskHeader } from '@/features/platform/components/desk'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export function Shell({ title, eyebrow, children, parent, tone, status, meta, actions }: { title: string; eyebrow: string; description?: string; children: React.ReactNode; parent?: { title: string; href: string }; tone?: DeskTone; status?: string; meta?: React.ReactNode; actions?: React.ReactNode }) {
  return <PageContainer title={title} header={<DeskHeader eyebrow={eyebrow} title={title} tone={tone} status={status} meta={meta} actions={actions} />} breadcrumbs={[{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'page' as const, label: 'Platform' }, ...(parent ? [{ type: 'link' as const, label: parent.title, href: parent.href }] : []), { type: 'page' as const, label: title }]}><div className="min-w-0 space-y-6 p-4 [overflow-wrap:anywhere] md:p-6">{children}</div></PageContainer>
}

function SearchFilters({ action, filters, label, statuses = [], hidden = {} }: { action: string; filters: { q: string; status: string }; label: string; statuses?: string[]; hidden?: Record<string,string> }) {
  return <FilterBar action={action}>
    {Object.entries(hidden).map(([name,value]) => <input type="hidden" key={name} name={name} value={value} />)}
    <Field label={label} className="sm:flex-1"><span className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input type="search" name="q" defaultValue={filters.q} maxLength={120} className={`${deskInput} pl-9`} /></span></Field>
    {statuses.length > 0 && <Field label="Status" className="sm:w-44"><select name="status" defaultValue={filters.status} className={`${deskInput} capitalize`}><option value="">All</option>{statuses.map(status => <option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></Field>}
    <Track><Pill type="submit">Search</Pill><Pill asChild><Link href={action}>Clear</Link></Pill></Track>
  </FilterBar>
}

function Failure({ error: _error }: { error: string }) { return <Notice tone="bad">This section could not be loaded. Check your access and try again.</Notice> }
function Empty({ children }: { children: React.ReactNode }) { return <Well>{children}</Well> }
function DateText({ value }: { value?: string | null }) { return <>{value ? new Date(value).toLocaleString() : '—'}</> }
function Money({ amount, currency }: { amount?: number | null; currency?: string | null }) { return <>{formatMinorUnits(amount, currency)}</> }
// Worklist states that are not plain rows: denied, stale, or inconsistent reads, each with a way back.
function StateNotice({ tone = 'warn', role = 'status', children, href, label }: { tone?: DeskTone; role?: 'alert' | 'status'; children: React.ReactNode; href?: string | null; label?: string }) {
  return <Notice tone={tone} role={role}><span>{children}</span>{href && label && <Link href={href} className="ml-2 font-medium underline underline-offset-4">{label}</Link>}</Notice>
}
function PageLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Track><Pill asChild size="sm"><Link href={href}>{children}<ChevronRight aria-hidden="true" /></Link></Pill></Track>
}

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

// The station's working day: today, or the next service date with a dated flight when today has none.
async function nextOperatingDate(today: string) {
  const response = await keystoneClient<{ flightInstances: Array<{ serviceDate: string | null }> | null }>(`query DeparturesNextOperatingDate($from: DateTime!) { flightInstances(where: { serviceDate: { gte: $from }, status: { notIn: [cancelled] } }, orderBy: [{ serviceDate: asc }], take: 1) { serviceDate } }`, { from: `${today}T00:00:00.000Z` })
  const next = response.success ? response.data.flightInstances?.[0]?.serviceDate?.slice(0, 10) : null
  return next && next > today ? next : today
}

export async function PlatformDeparturesPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ? await searchParams : {}
  const today = typeof params.date === 'string' ? null : await carrierToday()
  const serviceDate = typeof params.date === 'string' ? params.date : await nextOperatingDate(today!)
  const originCode = typeof params.origin === 'string' && params.origin.trim() ? params.origin.trim().toUpperCase() : null
  const cleanupCursor = typeof params.cleanupCursor === 'string' ? params.cleanupCursor : null
  const response = await keystoneClient<{ departureManifest: any }>(`query PlatformDepartureManifest($serviceDate:String!,$originCode:String,$cleanupCursor:String){departureManifest(serviceDate:$serviceDate,originCode:$originCode,cleanupCursor:$cleanupCursor)}`, { serviceDate, originCode, cleanupCursor })
  const nextCleanupCursor = response.success ? response.data.departureManifest.refundCleanup.nextCursor as string | null : null
  const nextCleanupParams = nextCleanupCursor ? new URLSearchParams({ date: serviceDate, cleanupCursor: nextCleanupCursor }) : null
  if (nextCleanupParams && originCode) nextCleanupParams.set('origin', originCode)
  const cleanupNextHref = nextCleanupParams ? `/dashboard/platform/departures?${nextCleanupParams.toString()}` : null
  return <Shell title="Departures" eyebrow="Station" meta={<span className="tabular-nums">{today && serviceDate !== today ? `Next operating day ${serviceDate} (none today)` : serviceDate}{originCode ? ` · ${originCode}` : ' · All stations'}</span>}>
    <FilterBar><Field label="Service date" className="sm:w-48"><input type="date" name="date" defaultValue={serviceDate} required className={deskInput} /></Field><Field label="Station" className="sm:w-32"><input name="origin" defaultValue={originCode ?? ''} maxLength={3} placeholder="JFK" className={`${deskInput} tabular-nums uppercase`} /></Field><Track><Pill type="submit">Load manifest</Pill></Track></FilterBar>
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
  return <Shell title="Bookings" eyebrow="Reservations" meta={bookingPage ? <span className="tabular-nums ">{bookingPage.totalCount} bookings</span> : undefined}>
    <FilterBar action="/dashboard/platform/bookings"><Field label="Record locator" className="sm:flex-1"><span className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input name="locator" defaultValue={locator} placeholder="ABC123" className={`${deskInput} pl-9 tabular-nums uppercase tracking-wider`} /></span></Field><Track><Pill type="submit">Find booking</Pill>{locator && <Pill asChild><Link href="/dashboard/platform/bookings">Clear</Link></Pill>}</Track></FilterBar>
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
  return <Shell title="Passengers & service" eyebrow="Customers" meta={page?.state === 'ready' ? <span className="tabular-nums ">{page.totalCount} passengers</span> : undefined}>
    <SearchFilters action="/dashboard/platform/passengers" filters={filters} label="Passenger name or reference" statuses={['active','merged','restricted','archived']} />
    {!response.success ? <><Failure error={response.error} />{firstPageHref && <PageLink href={firstPageHref}>Retry from first page</PageLink>}</>
      : page?.state === 'unavailable' ? <StateNotice role="alert" href={firstPageHref} label="Retry from first page">Passenger records are unavailable under your current access.</StateNotice>
        : page?.state === 'stale' ? <StateNotice href={firstPageHref} label="First page">This page is out of date.</StateNotice>
          : page?.state === 'empty' ? <Empty>No passengers match.</Empty>
            : <div className="space-y-3">
              {page?.state === 'inconsistent' && <StateNotice href={firstPageHref ?? withWorklistSearch(passengerServiceHref('/dashboard/platform/passengers'), filters)} label="Reload first page">{page.items.length ? 'Passenger rows and their count disagree.' : `No rows returned for ${page.totalCount} passengers.`}</StateNotice>}
              {page && page.items.length > 0 && <DeskSection title="Passengers" count={page.totalCount ?? undefined} actions={nextPageHref ? <PageLink href={nextPageHref}>Next 100</PageLink> : undefined}><Panel className="divide-y">{page.items.map(passenger => <RowLink key={passenger.id} href={detailWithReturn(`/dashboard/platform/passengers/${passenger.id}`, params)}><div className="min-w-0 flex-1"><TitleLine as="h3" tone={statusTone(passenger.status)} status={passenger.status ?? undefined} className="font-medium">{passenger.givenName ?? 'Name unavailable'} {passenger.familyName ?? ''}</TitleLine><p className="mt-0.5 pl-4"><Code>{passenger.passengerKey ?? 'No key'}</Code>{passenger.preferredLanguage ? <span className="ml-2 text-xs text-muted-foreground">{passenger.preferredLanguage}</span> : null}</p></div><dl className="grid grid-cols-4 gap-4 text-right tabular-nums text-xs "><div><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Bkg</dt><dd>{passenger.bookingPassengersCount ?? '—'}</dd></div><div><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Req</dt><dd>{passenger.serviceRequestsCount ?? '—'}</dd></div><div><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Chk</dt><dd>{passenger.checkInsCount ?? '—'}</dd></div><div><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Bags</dt><dd>{passenger.bagsCount ?? '—'}</dd></div></dl></RowLink>)}</Panel></DeskSection>}
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
  return <Shell title="Disruptions" eyebrow="Irregular operations" tone={disruptionPage && (disruptionPage.totalCount ?? 0) > 0 ? 'warn' : undefined} meta={disruptionPage ? <span className="tabular-nums ">{disruptionPage.totalCount ?? 0} disruptions · {servicePage?.totalCount ?? 0} flights</span> : undefined}>
    {response.success ? <RecoveryDesk key={disruptionCursor ?? 'first'} flights={servicePage?.items ?? []} flightCount={servicePage?.totalCount ?? 0} flightHasNextPage={servicePage?.hasNextPage ?? false} serviceNextHref={serviceNextHref} recoveryServicesFrom={recoveryServicesFrom} disruptions={disruptionPage?.items ?? []} disruptionCount={disruptionPage?.totalCount ?? 0} disruptionHasNextPage={disruptionPage?.hasNextPage ?? false} disruptionNextHref={disruptionNextHref} detailBase="/dashboard/platform/disruptions" /> : <Failure error={response.error} />}
  </Shell>
}

async function networkDataForInventory(flightCursor: string | null, flightFrom: string) {
  return keystoneClient<NetworkDeskResponse>(PLATFORM_INVENTORY_DESK_QUERY, {
    flightWhere: futureFlightWorklistWhere(flightFrom),
    flightCursor: flightCursor ? { id: flightCursor } : null,
    flightCursorId: flightCursor ?? NO_RECORD_ID,
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
    selectedScheduleId: selectedScheduleId ?? NO_RECORD_ID,
    flightWhere: futureFlightWorklistWhere(flightFrom),
    flightCursor: flightCursor ? { id: flightCursor } : null,
    flightCursorId: flightCursor ?? NO_RECORD_ID,
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
  return <Shell title="Schedules & flights" eyebrow="Network">
    {response.success ? <NetworkDesk schedules={schedules} flights={flightQueue?.flights ?? []} defaultCurrencyCode={response.data.authenticatedItem?.carrier?.defaultCurrencyCode ?? 'USD'} defaultTimezone={response.data.authenticatedItem?.carrier?.defaultTimezone ?? 'UTC'} mode="schedules" detailBase="/dashboard/platform/schedules" scheduleSelectionId={scheduleSelectionId} scheduleSelectionUnavailable={scheduleSelectionUnavailable} scheduleWorklist={schedulePage ? { state: schedulePage.state, totalCount: schedulePage.totalCount, pageItemCount: schedulePage.items.length, nextCursor: schedulePage.state === 'ready' ? schedulePage.nextCursor : null, cursor: scheduleCursor } : undefined} flightWorklist={flightQueue ? { state: flightQueue.page.state, totalCount: flightQueue.page.totalCount, pageItemCount: flightQueue.page.items.length, nextCursor: flightQueue.page.state === 'ready' ? flightQueue.page.nextCursor : null, cursor: flightCursor, from: flightFrom } : undefined} /> : <><Failure error={response.error} />{flightRetryHref && <PageLink href={flightRetryHref}>First page</PageLink>}</>}
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
  return <Shell title="Inventory & fares" eyebrow="Revenue">
    {response.success ? <NetworkDesk schedules={[]} flights={flightQueue?.flights ?? []} defaultCurrencyCode={response.data.authenticatedItem?.carrier?.defaultCurrencyCode ?? 'USD'} defaultTimezone={response.data.authenticatedItem?.carrier?.defaultTimezone ?? 'UTC'} inventoryActorCarrierId={response.data.authenticatedItem?.carrier?.id ?? ''} mode="inventory" detailBase="/dashboard/platform/inventory" flightWorklist={flightQueue ? { state: flightQueue.page.state, totalCount: flightQueue.page.totalCount, pageItemCount: flightQueue.page.items.length, nextCursor: flightQueue.page.state === 'ready' ? flightQueue.page.nextCursor : null, cursor: flightCursor, from: flightFrom } : undefined} /> : <><Failure error={response.error} />{flightRetryHref && <PageLink href={flightRetryHref}>First page</PageLink>}</>}
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
  return <Shell title="Offers" eyebrow="Retailing" meta={offerPage ? <span className="tabular-nums ">{offerPage.totalCount} offers</span> : undefined}>
    <FilterBar action="/dashboard/platform/offers" method="get"><Field label="From" className="sm:w-28"><input name="origin" defaultValue={origin} maxLength={3} required pattern="[A-Za-z]{3}" placeholder="JFK" className={`${deskInput} tabular-nums uppercase`} /></Field><Field label="To" className="sm:w-28"><input name="destination" defaultValue={destination} maxLength={3} required pattern="[A-Za-z]{3}" placeholder="BOS" className={`${deskInput} tabular-nums uppercase`} /></Field><Field label="Date" className="sm:w-44"><input name="date" type="date" defaultValue={date} required className={deskInput} /></Field><Track><Pill type="submit" variant="primary">Search inventory</Pill></Track></FilterBar>
    {!response.success ? <><Failure error={response.error} />{latestOffersHref && <PageLink href={latestOffersHref}>Latest offers</PageLink>}</> : <>
      {search ? <ShoppingResults flights={response.data.airlineFlightOptions} passengers={response.data.passengers} defaultTimezone={response.data.authenticatedItem?.carrier?.defaultTimezone ?? 'UTC'} /> : <Empty>Enter a route and date.</Empty>}
      <DeskSection title="Recent offers" count={offerPage?.totalCount ?? 0} actions={offerPage?.hasNextPage && nextOffersHref ? <PageLink href={nextOffersHref}>Next 50</PageLink> : undefined}>
        {offerPage?.items.length ? <Panel className="divide-y">{offerPage.items.map(offer => <RowLink key={offer.id} href={detailWithReturn(`/dashboard/platform/offers/${offer.id}`, params)}><div className="min-w-0"><TitleLine as="h3" tone={statusTone(offer.status)} status={offer.status} className="tabular-nums text-sm font-semibold tracking-wide">{offer.offerNumber}</TitleLine><p className="mt-0.5 pl-4 text-xs text-muted-foreground">{offer.source} · {offer.passengersCount} pax · expires <DateText value={offer.expiresAt} /></p></div><div className="text-right"><p className="tabular-nums text-sm font-semibold "><Money amount={offer.totalAmount} currency={offer.currencyCode} /></p><StatusLabel status={offer.status} /></div></RowLink>)}</Panel>
          : offerPage?.state === 'stale' ? <StateNotice href={latestOffersHref} label="Latest offers">This page is out of date.</StateNotice>
            : offerPage?.state === 'inconsistent' ? <StateNotice href={offerWorklistHref('/dashboard/platform/offers', shoppingState)} label="Reload">No rows returned for {offerPage.totalCount} offers.</StateNotice>
              : <Empty>No offers yet.</Empty>}
      </DeskSection>
    </>}
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
    paymentCursorId: paymentCursor ?? NO_RECORD_ID,
    evidenceWhere: PAYMENT_EVIDENCE_WORKLIST_WHERE,
    evidenceCursor: evidenceCursor ? { id: evidenceCursor } : null,
    evidenceSkip: evidenceCursor ? 1 : 0,
    evidenceCursorId: evidenceCursor ?? NO_RECORD_ID,
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

  const evidenceCount = evidencePage?.state === 'ready' ? evidencePage.totalCount : null
  return <Shell title="Payments & refunds" eyebrow="Settlement" tone={evidenceCount ? 'warn' : undefined} meta={evidenceCount ? <span className="tabular-nums ">{evidenceCount} awaiting approval</span> : undefined}>
    {!response.success ? <><Failure error={response.error} /><Track>{firstPaymentPageHref && <Pill asChild size="sm"><Link href={firstPaymentPageHref}>Retry payments</Link></Pill>}{firstEvidencePageHref && <Pill asChild size="sm"><Link href={firstEvidencePageHref}>Retry approvals</Link></Pill>}</Track></> : <div className="space-y-8">
      <DeskSection title="Awaiting approval" count={evidencePage?.state === 'ready' ? evidencePage.totalCount ?? undefined : undefined} actions={evidencePage?.state === 'ready' && evidencePage.hasNextPage && nextEvidencePageHref ? <PageLink href={nextEvidencePageHref}>Next 100</PageLink> : undefined}>
        {evidencePage?.state === 'unavailable' ? <StateNotice role="alert" href={firstEvidencePageHref} label="Retry from first page">Approval queue is unavailable under your current access.</StateNotice>
          : evidencePage?.state === 'empty' ? <Empty>Nothing awaiting approval.</Empty>
            : evidencePage?.state === 'stale' ? <StateNotice href={firstEvidencePageHref} label="First page">This page is out of date.</StateNotice>
              : evidencePage?.state === 'inconsistent' ? <StateNotice href={latestEvidencePageHref} label="Reload">Approval rows and their count disagree.</StateNotice>
                : evidencePage?.state === 'ready' ? <div className="space-y-3">
                  {firstEvidencePageHref && <PageLink href={firstEvidencePageHref}>First page</PageLink>}
                  <Panel className="divide-y">{evidencePage.items.map(evidence => <RowLink key={evidence.id} href={evidence.booking?.recordLocator ? `/dashboard/platform/bookings?locator=${encodeURIComponent(evidence.booking.recordLocator)}` : `/dashboard/platform/payments`}><div className="min-w-0"><TitleLine as="h3" tone="warn" status="Submitted" className="text-sm font-medium"><span className="tabular-nums font-semibold tracking-wider">{evidence.booking?.recordLocator ?? 'Booking unavailable'}</span><span className="ml-2 text-muted-foreground">{evidence.purpose}</span></TitleLine><p className="mt-0.5 pl-4 text-xs text-muted-foreground"><Code>{evidence.externalReference}</Code> · {evidence.submittedBy?.name ?? 'Unknown operator'}</p></div>{evidence.booking?.recordLocator ? <span className="inline-flex items-center gap-1 text-xs font-medium">Review<ChevronRight aria-hidden="true" className="size-4" /></span> : <span className="text-xs text-muted-foreground">Unavailable</span>}</RowLink>)}</Panel>
                </div>
                  : <StateNotice role="alert">Approval queue is unavailable.</StateNotice>}
      </DeskSection>
      <DeskSection title="Payment records" count={paymentPage?.state === 'ready' ? paymentPage.totalCount ?? undefined : undefined} actions={paymentPage?.state === 'ready' && paymentPage.hasNextPage && nextPaymentPageHref ? <PageLink href={nextPaymentPageHref}>Next 100</PageLink> : undefined}>
        {paymentPage?.state === 'unavailable' ? <StateNotice role="alert" href={firstPaymentPageHref} label="Retry from first page">Payment records are unavailable under your current access.</StateNotice>
          : paymentPage?.state === 'empty' ? <Empty>No payments yet.</Empty>
            : paymentPage?.state === 'stale' ? <StateNotice href={firstPaymentPageHref} label="First page">This page is out of date.</StateNotice>
              : paymentPage?.state === 'inconsistent' ? <StateNotice href={latestPaymentPageHref} label="Reload">Payment rows and their count disagree.</StateNotice>
                : paymentPage?.state === 'ready' ? <div className="space-y-3">
                  {firstPaymentPageHref && <PageLink href={firstPaymentPageHref}>First page</PageLink>}
                  <Panel className="divide-y">{paymentPage.items.map(payment => <RowLink key={payment.id} href={detailWithReturn(`/dashboard/platform/payments/${payment.id}`, params)}><div className="min-w-0"><TitleLine as="h3" tone={statusTone(payment.status)} status={payment.status} className="tabular-nums text-sm font-semibold tracking-wider">{payment.booking?.recordLocator ?? payment.paymentKey}</TitleLine><p className="mt-0.5 pl-4 text-xs text-muted-foreground">{payment.provider?.name ?? 'Provider unavailable'} · {payment.instrumentBrand ?? 'Instrument'}{payment.instrumentLast4 ? ` ••${payment.instrumentLast4}` : ''}</p></div><div className="text-right tabular-nums "><p className="text-sm font-semibold"><Money amount={payment.capturedAmount} currency={payment.currencyCode} /></p>{payment.refundedAmount ? <p className="text-xs text-muted-foreground">−<Money amount={payment.refundedAmount} currency={payment.currencyCode} /> refunded</p> : <StatusLabel status={payment.status} />}</div></RowLink>)}</Panel>
                </div>
                  : <StateNotice role="alert">Payment records are unavailable.</StateNotice>}
      </DeskSection>
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
      auditEventCursorId: auditEventCursor ?? NO_RECORD_ID,
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

  return <Shell title="Manifest entry & audit" eyebrow="Audit" actions={<Track><Pill asChild variant="primary"><Link href="/dashboard/platform/departures">Departure manifest<ChevronRight aria-hidden="true" /></Link></Pill></Track>}>
    <SearchFilters action="/dashboard/platform/manifests" filters={filters} label="Action or reference" statuses={[]} />
    {!actorResponse.success ? <Failure error={actorResponse.error} /> : <DeskSection title="Command log" count={auditPage?.state === 'ready' ? auditPage.totalCount ?? undefined : undefined} actions={auditPage?.state === 'ready' && auditPage.hasNextPage && nextAuditPageHref ? <PageLink href={nextAuditPageHref}>Next 100</PageLink> : undefined}>
      {scope === 'denied' ? <StateNotice role="alert">Your role can’t read the audit log.</StateNotice>
        : scope === 'unavailable' ? <StateNotice role="alert">Your role or carrier is incomplete.</StateNotice>
          : !response?.success ? <Failure error={response?.error ?? 'Audit rows, count, or cursor membership were unavailable'} />
            : auditPage?.state === 'unavailable' ? <StateNotice role="alert">The audit log is unavailable under your current access.</StateNotice>
              : auditPage?.state === 'empty' ? <Empty>No audit events.</Empty>
                : auditPage?.state === 'stale' ? <StateNotice href={firstAuditPageHref} label="First page">This page is out of date.</StateNotice>
                  : auditPage?.state === 'inconsistent' ? <StateNotice href={withWorklistSearch(auditEventWorklistHref('/dashboard/platform/manifests'), filters)} label="Reload">Audit rows and their count disagree.</StateNotice>
                    : auditPage?.state === 'ready' ? <div className="space-y-3">{firstAuditPageHref && <PageLink href={firstAuditPageHref}>First page</PageLink>}<Panel className="divide-y">{auditPage.items.map(event => <RowLink key={event.id} href={detailWithReturn(`/dashboard/platform/manifests/${event.id}`, params)}><div className="min-w-0"><h3 className="tabular-nums text-sm font-medium">{event.action}</h3><p className="mt-0.5 text-xs text-muted-foreground">{event.aggregateType} · <Code>{event.aggregateId}</Code> · {event.actor?.name ?? event.approvedAgent?.legalName ?? 'Unknown actor'}</p></div><div className="text-right text-xs"><p className="font-medium">{event.source}</p><p className="tabular-nums  text-muted-foreground"><DateText value={event.occurredAt} /></p></div></RowLink>)}</Panel></div>
                      : <Failure error="Audit worklist state is unavailable" />}
    </DeskSection>}
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
      providerConnectionCursorId: providerConnectionCursor ?? NO_RECORD_ID,
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

  const carrier = actor?.carrier
  return <Shell title="Settings & readiness" eyebrow="Carrier" tone={carrier ? carrier.directSalesEnabled === true ? 'ok' : 'idle' : undefined} status={carrier ? carrier.directSalesEnabled === true ? 'Direct sales on' : 'Direct sales off' : undefined} meta={carrier ? <span><span className="tabular-nums">{carrier.code ?? '—'}</span> · {carrier.name ?? 'Carrier'}</span> : undefined}>
    {!actorResponse.success ? <Failure error={actorResponse.error} /> : <div className="space-y-8">
      {carrier ? <ReadoutStrip><Readout label="Carrier" value={<span className="tabular-nums">{carrier.code ?? '—'}</span>} sub={carrier.name ?? undefined} /><Readout label="Currency" value={<span className="tabular-nums">{carrier.defaultCurrencyCode ?? '—'}</span>} /><Readout label="Timezone" value={<span className="text-base">{carrier.defaultTimezone ?? '—'}</span>} /><Readout label="Direct sales" tone={carrier.directSalesEnabled === true ? 'ok' : 'idle'} value={carrier.directSalesEnabled === true ? 'On' : carrier.directSalesEnabled === false ? 'Off' : '—'} /></ReadoutStrip> : <StateNotice>No carrier identity returned.</StateNotice>}
      <SearchFilters action="/dashboard/platform/settings" filters={filters} label="Connection name or reference" statuses={['pending', 'active', 'paused', 'failed', 'revoked']} />
      <DeskSection title="Connections" count={connectionPage?.state === 'ready' ? connectionPage.totalCount ?? undefined : undefined} actions={connectionPage?.state === 'ready' && connectionPage.hasNextPage && nextConnectionPageHref ? <PageLink href={nextConnectionPageHref}>Next 100</PageLink> : undefined}>
        {scope === 'denied' ? <StateNotice role="alert">Your role can’t read integrations.</StateNotice>
          : scope === 'unavailable' ? <StateNotice role="alert">Your role or carrier is incomplete.</StateNotice>
            : !response?.success ? <Failure error={response?.error ?? 'Provider connection rows, count, or cursor membership were unavailable'} />
              : connectionPage?.state === 'unavailable' ? <StateNotice role="alert">Connections are unavailable under your current access.</StateNotice>
                : connectionPage?.state === 'empty' ? <Empty>No connections.</Empty>
                  : connectionPage?.state === 'stale' ? <StateNotice href={firstConnectionPageHref} label="First page">This page is out of date.</StateNotice>
                    : connectionPage?.state === 'inconsistent' ? <StateNotice href={withWorklistSearch(providerConnectionWorklistHref('/dashboard/platform/settings'), filters)} label="Reload">Connection rows and their count disagree.</StateNotice>
                      : connectionPage?.state === 'ready' ? <div className="space-y-3">{firstConnectionPageHref && <PageLink href={firstConnectionPageHref}>First page</PageLink>}<Panel className="divide-y">{connectionPage.items.map(connection => <RowLink key={connection.id} href={detailWithReturn(`/dashboard/platform/settings/${connection.id}`, params)}><div className="min-w-0 flex-1"><TitleLine as="h3" tone={statusTone(connection.status)} status={connection.status} className="font-medium">{connection.name}</TitleLine><p className="mt-0.5 pl-4 text-xs text-muted-foreground">{connection.provider?.name ?? 'Provider unavailable'} · <Code>{connection.connectionKey}</Code></p>{connection.lastErrorCode && <p className="mt-1 pl-4 text-xs text-red-600 dark:text-red-400">{connection.lastErrorCode}: {connection.lastErrorMessage ?? 'No message'}</p>}</div><dl className="grid grid-cols-2 gap-4 text-right text-xs"><div><dt className="text-muted-foreground">Last success</dt><dd className="tabular-nums "><DateText value={connection.lastSucceededAt} /></dd></div><div><dt className="text-muted-foreground">Last attempt</dt><dd className="tabular-nums "><DateText value={connection.lastAttemptedAt} /></dd></div></dl></RowLink>)}</Panel></div>
                        : <Failure error="Provider connection worklist state is unavailable" />}
      </DeskSection>
    </div>}
  </Shell>
}
