import { safeDeskReturn } from '@/features/platform/lib/desk-return'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { Shell } from './PlatformDeskPages'
import type { BookingReceipt } from '@/features/airline/lib/booking-receipt'
import { formatMinorUnits } from '@/features/keystone/lib/money'
import { formatAirportTime } from '@/features/airline/lib/time'
import { Code, DeskSection, Facts, Notice, Panel, Pill, Route, RowLink, StatusLabel, TitleLine, Track, Well, statusTone } from '@/features/platform/components/desk'

type Desk = 'schedules' | 'inventory' | 'offers' | 'bookings' | 'passengers' | 'departures' | 'disruptions' | 'payments' | 'manifests' | 'settings'

type DetailDefinition = { title: string; backLabel: string; query: string; actionHref?: (data: RecordData) => string | null; actionLabel?: string }

const detail: Record<Desk, DetailDefinition> = {
  schedules: { title: 'Flight', backLabel: 'Schedules & flights', query: `query PlatformScheduleDetail($id:ID!){flightInstance(where:{id:$id}){id flightNumber serviceDate status scheduledDepartureAt scheduledArrivalAt departureGate departureTerminal origin{iataCode city} destination{iataCode city} inventoryBuckets(take:51,orderBy:[{id:asc}]){id bookingClassCode status capacity authorized sold held blocked} inventoryBucketsCount}}` },
  inventory: { title: 'Inventory bucket', backLabel: 'Inventory & fares', query: `query PlatformInventoryDetail($id:ID!){inventoryBucket(where:{id:$id}){id bucketKey status bookingClassCode capacity authorized sold held blocked baseAmount taxAmount currencyCode cabin{code name} fareBrand{code name} flightInstance{id flightNumber serviceDate origin{iataCode} destination{iataCode}}}}` },
  offers: { title: 'Offer', backLabel: 'Offers', query: `query PlatformOfferDetail($id:ID!){offer(where:{id:$id}){id offerNumber status source expiresAt baseAmount taxAmount feeAmount discountAmount totalAmount currencyCode passengersCount itemsCount booking{id recordLocator}}}` },
  bookings: { title: 'Booking', backLabel: 'Bookings', query: `query PlatformBookingDetail($id:ID!){booking(where:{id:$id}){id recordLocator orderNumber status paymentStatus ticketingStatus source totalAmount currencyCode passengersCount segmentsCount ticketsCount refundsCount checkInsCount bagsCount createdAt contactEmail contactPhone metadata passengers(take:9,orderBy:[{id:asc}]){id passengerType isPrimaryContact passenger{id givenName familyName}} segments(take:10,orderBy:[{sequence:asc},{id:asc}]){id sequence status marketingFlightNumber originCode destinationCode scheduledDepartureAt cabinCode fareBrandCode flightInstance{id origin{timezone}}}}}`, actionHref: data => data.recordLocator ? `/dashboard/platform/bookings?locator=${encodeURIComponent(data.recordLocator)}` : null, actionLabel: 'Booking commands' },
  passengers: { title: 'Passenger', backLabel: 'Passengers & service', query: `query PlatformPassengerDetail($id:ID!){passenger(where:{id:$id}){id passengerKey givenName middleNames familyName status preferredLanguage bookingPassengersCount serviceRequestsCount checkInsCount bagsCount ticketsCount reaccommodationsCount updatedAt bookingPassengers(take:21,orderBy:[{id:asc}]){id booking{id recordLocator segments(take:21,orderBy:[{sequence:asc},{id:asc}]){id originCode destinationCode flightInstance{id serviceDate}}}}}}` },
  departures: { title: 'Departure', backLabel: 'Departures', query: `query PlatformDepartureDetail($id:ID!){flightInstance(where:{id:$id}){id flightNumber serviceDate status scheduledDepartureAt scheduledArrivalAt departureGate departureTerminal origin{iataCode city} destination{iataCode city} checkInsCount}}`, actionHref: data => `/dashboard/platform/departures?date=${encodeURIComponent(data.serviceDate?.slice(0,10) ?? '')}&origin=${encodeURIComponent(data.origin?.iataCode ?? '')}`, actionLabel: 'Station manifest' },
  disruptions: { title: 'Disruption', backLabel: 'Disruptions', query: `query PlatformDisruptionDetail($id:ID!){disruption(where:{id:$id}){id disruptionKey type severity status publicSummary providerReference detectedAt publishedAt resolvedAt affectedSegmentsCount reaccommodationsCount flightInstance{id flightNumber serviceDate origin{iataCode} destination{iataCode}}}}`, actionHref: () => '/dashboard/platform/disruptions', actionLabel: 'Recovery commands' },
  payments: { title: 'Payment', backLabel: 'Payments & refunds', query: `query PlatformPaymentDetail($id:ID!){payment(where:{id:$id}){id paymentKey status amount authorizedAmount capturedAmount refundedAmount currencyCode providerPaymentId providerCaptureId instrumentBrand instrumentLast4 failureCode failureMessage createdAt booking{id recordLocator} provider{name adapterType status} refundsCount manualPaymentEvidenceCount}}`, actionHref: data => data.booking?.recordLocator ? `/dashboard/platform/bookings?locator=${encodeURIComponent(data.booking.recordLocator)}` : null, actionLabel: 'Settlement workflow' },
  manifests: { title: 'Audit event', backLabel: 'Manifest entry & audit', query: `query PlatformAuditDetail($id:ID!){auditEvent(where:{id:$id}){id eventKey action aggregateType aggregateId source correlationId idempotencyKey occurredAt actor{name} approvedAgent{legalName}}}` },
  settings: { title: 'Provider connection', backLabel: 'Settings & readiness', query: `query PlatformConnectionDetail($id:ID!){providerConnection(where:{id:$id}){id connectionKey name status capabilities externalAccountId lastAttemptedAt lastSucceededAt lastErrorCode lastErrorMessage provider{name code type status} webhookEndpointsCount webhookEventsCount}}` },
}

type Related = { id?: string; recordLocator?: string; code?: string; name?: string; legalName?: string; iataCode?: string; city?: string; flightNumber?: string; serviceDate?: string; adapterType?: string; status?: string; type?: string }
type Bucket = { id: string; bookingClassCode?: string; status?: string; capacity?: number; authorized?: number; sold?: number; held?: number; blocked?: number }
type BookingTravelerRow = { id: string; passengerType?: string; isPrimaryContact?: boolean; passenger?: { id: string; givenName: string; familyName: string } | null }
type BookingSegmentRow = { id: string; sequence: number; status: string; marketingFlightNumber: string; originCode: string; destinationCode: string; scheduledDepartureAt: string; cabinCode?: string; fareBrandCode?: string; flightInstance?: { id: string; origin?: { timezone?: string } | null } | null }
type RecordData = Related & {
  contactEmail?: string; contactPhone?: string; metadata?: { paymentDueAt?: string } | null;
  passengers?: BookingTravelerRow[]; segments?: BookingSegmentRow[];
  id: string; offerNumber?: string; orderNumber?: string; passengerKey?: string; givenName?: string; middleNames?: string; familyName?: string;
  disruptionKey?: string; connectionKey?: string; paymentKey?: string; eventKey?: string; bucketKey?: string;
  source?: string; paymentStatus?: string; ticketingStatus?: string; preferredLanguage?: string; currencyCode?: string;
  bookingClassCode?: string; publicSummary?: string; severity?: string; providerReference?: string;
  action?: string; aggregateType?: string; aggregateId?: string; correlationId?: string; idempotencyKey?: string;
  departureGate?: string; departureTerminal?: string; externalAccountId?: string; lastErrorCode?: string; lastErrorMessage?: string;
  providerPaymentId?: string; providerCaptureId?: string; instrumentBrand?: string; instrumentLast4?: string; failureCode?: string; failureMessage?: string;
  scheduledDepartureAt?: string; scheduledArrivalAt?: string; expiresAt?: string; createdAt?: string; updatedAt?: string; detectedAt?: string; publishedAt?: string; resolvedAt?: string; occurredAt?: string; lastAttemptedAt?: string; lastSucceededAt?: string;
  totalAmount?: number; baseAmount?: number; taxAmount?: number; feeAmount?: number; discountAmount?: number; amount?: number; authorizedAmount?: number; capturedAmount?: number; refundedAmount?: number;
  capacity?: number; authorized?: number; sold?: number; held?: number; blocked?: number;
  passengersCount?: number; segmentsCount?: number; ticketsCount?: number; refundsCount?: number; checkInsCount?: number; bagsCount?: number; itemsCount?: number; bookingPassengersCount?: number; serviceRequestsCount?: number; reaccommodationsCount?: number; affectedSegmentsCount?: number; webhookEndpointsCount?: number; webhookEventsCount?: number; manualPaymentEvidenceCount?: number;
  origin?: Related | null; destination?: Related | null; cabin?: Related | null; fareBrand?: Related | null; flightInstance?: Related | null; booking?: Related | null; provider?: Related | null; actor?: Related | null; approvedAgent?: Related | null;
  inventoryBuckets?: Bucket[]; inventoryBucketsCount?: number; capabilities?: string[];
  bookingPassengers?: Array<{ id: string; booking?: (Related & { segments?: Array<{ id: string; originCode: string; destinationCode: string; flightInstance?: Related | null }> }) | null }>;
}


type Fact = { label: string; value: React.ReactNode; mono?: boolean }
type FactGroup = { title: string; items: Fact[] }

function readable(value?: string | number | null) { return value === undefined || value === null || value === '' ? 'Unavailable' : String(value).replaceAll('_', ' ') }
function date(value?: string) { return value && Number.isFinite(Date.parse(value)) ? `${new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))} UTC` : 'Unavailable' }
function bookingHref(locator: string) { return `/dashboard/platform/bookings?locator=${encodeURIComponent(locator)}` }

function recordIdentity(desk: Desk, record: RecordData) {
  switch (desk) {
    case 'bookings': return record.recordLocator
    case 'offers': return record.offerNumber
    case 'schedules': case 'departures': return record.flightNumber ? `${record.flightNumber} · ${record.serviceDate?.slice(0,10) ?? 'Date unavailable'}` : undefined
    case 'inventory': return record.bucketKey
    case 'passengers': return [record.givenName, record.middleNames, record.familyName].filter(Boolean).join(' ') || record.passengerKey
    case 'disruptions': return record.disruptionKey
    case 'payments': return record.providerPaymentId || record.paymentKey
    case 'manifests': return record.eventKey
    case 'settings': return record.name || record.connectionKey
  }
}

function recordFacts(desk: Desk, data: RecordData): FactGroup[] {
  const text = (label: string, value?: string | number | null): Fact => ({ label, value: readable(value) })
  const code = (label: string, value?: string | number | null): Fact => ({ label, value: readable(value), mono: true })
  const count = (label: string, value?: number | null): Fact => ({ label, value: readable(value), mono: true })
  const money = (label: string, amount?: number): Fact => ({ label, value: formatMinorUnits(amount, data.currencyCode), mono: true })
  const at = (label: string, value?: string): Fact => ({ label, value: date(value), mono: true })
  const state = (label: string, value?: string | null): Fact => ({ label, value: <StatusLabel status={value} /> })
  const place = (value?: Related | null) => [value?.iataCode, value?.city].filter(Boolean).join(' · ')
  switch (desk) {
    case 'schedules': case 'departures':
      return [
        { title: 'Route', items: [code('Origin', place(data.origin)), code('Destination', place(data.destination)), code('Terminal', data.departureTerminal), code('Gate', data.departureGate)] },
        { title: 'Times', items: [at('Scheduled departure', data.scheduledDepartureAt), at('Scheduled arrival', data.scheduledArrivalAt), count('Check-ins', data.checkInsCount)] },
      ]
    case 'inventory':
      return [
        { title: 'Bucket', items: [code('Booking class', data.bookingClassCode), text('Cabin', data.cabin?.name), text('Fare', data.fareBrand?.name), money('Base fare', data.baseAmount), money('Tax', data.taxAmount)] },
        { title: 'Counts', items: [count('Capacity', data.capacity), count('Authorized', data.authorized), count('Sold', data.sold), count('Held', data.held), count('Blocked', data.blocked)] },
      ]
    case 'bookings':
      return [
        { title: 'Booking', items: [code('Order number', data.orderNumber), state('Payment', data.paymentStatus), state('Ticketing', data.ticketingStatus), money('Total', data.totalAmount), at('Created', data.createdAt), ...(data.paymentStatus === 'unpaid' && data.metadata?.paymentDueAt ? [at('Pay by', data.metadata.paymentDueAt)] : [])] },
        { title: 'Contact', items: [text('Email', data.contactEmail), text('Phone', data.contactPhone)] },
        { title: 'Counts', items: [count('Travelers', data.passengersCount), count('Segments', data.segmentsCount), count('Tickets', data.ticketsCount), count('Refunds', data.refundsCount)] },
      ]
    case 'offers':
      return [
        { title: 'Offer', items: [text('Source', data.source), count('Travelers', data.passengersCount), at('Hold expires', data.expiresAt)] },
        { title: 'Price', items: [money('Base fare', data.baseAmount), money('Tax', data.taxAmount), money('Fees', data.feeAmount), money('Discount', data.discountAmount), money('Total', data.totalAmount)] },
      ]
    case 'passengers':
      return [
        { title: 'Passenger', items: [code('Passenger reference', data.passengerKey), text('Language', data.preferredLanguage), at('Updated', data.updatedAt)] },
        { title: 'Workload', items: [count('Bookings', data.bookingPassengersCount), count('Service requests', data.serviceRequestsCount), count('Check-ins', data.checkInsCount), count('Bags', data.bagsCount)] },
      ]
    case 'disruptions':
      return [
        { title: 'Disruption', items: [text('Impact', data.type), state('Severity', data.severity), text('Passenger summary', data.publicSummary), code('Provider reference', data.providerReference), count('Affected segments', data.affectedSegmentsCount), count('Replacements', data.reaccommodationsCount)] },
        { title: 'Timeline', items: [at('Detected', data.detectedAt), at('Published', data.publishedAt), at('Resolved', data.resolvedAt)] },
      ]
    case 'payments':
      return [
        { title: 'Amounts', items: [money('Amount', data.amount), money('Authorized', data.authorizedAmount), money('Captured', data.capturedAmount), money('Refunded', data.refundedAmount), at('Created', data.createdAt)] },
        { title: 'Provider', items: [text('Provider', data.provider?.name), text('Provider type', data.provider?.adapterType), code('Payment reference', data.providerPaymentId), code('Capture reference', data.providerCaptureId), code('Instrument', [data.instrumentBrand, data.instrumentLast4].filter(Boolean).join(' · ')), code('Failure code', data.failureCode)] },
      ]
    case 'manifests':
      return [
        { title: 'Event', items: [text('Action', data.action), text('Resource type', data.aggregateType), code('Resource reference', data.aggregateId), text('Actor', data.actor?.name || data.approvedAgent?.legalName), text('Source', data.source), code('Correlation reference', data.correlationId), at('Occurred', data.occurredAt)] },
      ]
    case 'settings':
      return [
        { title: 'Connection', items: [code('Connection reference', data.connectionKey), text('Provider', data.provider?.name), state('Provider status', data.provider?.status), code('External account', data.externalAccountId), text('Capabilities', data.capabilities?.join(', '))] },
        { title: 'Attempts', items: [at('Last attempt', data.lastAttemptedAt), at('Last recorded success', data.lastSucceededAt), code('Last error code', data.lastErrorCode)] },
      ]
  }
}

function RelatedLinks({ desk, data }: { desk: Desk; data: RecordData }) {
  const booking = (desk === 'offers' || desk === 'payments') ? data.booking : null
  const flight = (desk === 'inventory' || desk === 'disruptions') ? data.flightInstance as (RecordData | null | undefined) : null
  if (desk !== 'offers' && desk !== 'payments' && desk !== 'inventory' && desk !== 'disruptions') return null
  return <DeskSection title="Related">
    <Panel className="divide-y overflow-hidden">
      {(desk === 'offers' || desk === 'payments') && (booking?.recordLocator
        ? <RowLink href={bookingHref(booking.recordLocator)}><span className="text-sm font-medium">Booking</span><Code className="text-foreground">{booking.recordLocator}</Code></RowLink>
        : <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm"><span className="font-medium">Booking</span><span className="text-muted-foreground">Unavailable</span></div>)}
      {(desk === 'inventory' || desk === 'disruptions') && (flight?.id
        ? <RowLink href={`/dashboard/platform/schedules/${encodeURIComponent(flight.id)}`}><span className="flex items-center gap-3 text-sm font-medium">Flight <Code className="text-foreground">{flight.flightNumber ?? 'Unavailable'}</Code></span><span className="flex items-center gap-3"><Route from={flight.origin?.iataCode} to={flight.destination?.iataCode} /><Code>{flight.serviceDate?.slice(0,10) ?? 'Date unavailable'}</Code></span></RowLink>
        : <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm"><span className="font-medium">Flight</span><span className="text-muted-foreground">Unavailable</span></div>)}
    </Panel>
  </DeskSection>
}

export async function PlatformRecordDetail({ desk, id, returnTo }: { desk: Desk; id: string; returnTo?: unknown }) {
  const definition = detail[desk]
  const response = await keystoneClient<Record<string, RecordData | null>>(definition.query, { id })
  const backHref = safeDeskReturn(desk,returnTo)
  if (!response.success) return <Shell title={definition.title} eyebrow={definition.backLabel} tone="bad" status="Unavailable" parent={{ title: definition.backLabel, href: backHref }} actions={<Track><Pill asChild><Link href={backHref}>{definition.backLabel}</Link></Pill></Track>}>
    <Notice tone="bad">Record unavailable. Check your access and try again.</Notice>
  </Shell>
  const data = Object.values(response.data)[0]
  if (!data) notFound()
  const identity = recordIdentity(desk, data) || 'Identity unavailable'
  const actionHref = definition.actionHref?.(data)
  // Receipt access is independent of the basic booking record; a denied receipt must not erase a readable booking.
  const receiptResponse = desk === 'bookings' ? await keystoneClient<{ operatorBookingReceipt?: BookingReceipt }>(`query PlatformAcceptedBooking($id:ID!){operatorBookingReceipt(bookingId:$id)}`, { id }) : null
  const receipt = receiptResponse?.success ? receiptResponse.data.operatorBookingReceipt : undefined
  const named = desk === 'passengers' || desk === 'settings'
  const groups = recordFacts(desk, data)
  return <Shell
    title={definition.title}
    eyebrow={definition.backLabel}
    tone={statusTone(data.status)}
    status={readable(data.status)}
    parent={{ title: definition.backLabel, href: backHref }}
    meta={<span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">{named ? <span className="font-medium text-foreground">{identity}</span> : <Code className="text-sm text-foreground">{identity}</Code>}<StatusLabel status={data.status} /></span>}
    actions={<Track><Pill asChild><Link href={backHref}>{definition.backLabel}</Link></Pill>{actionHref && <Pill asChild variant="primary"><Link href={actionHref}>{definition.actionLabel}</Link></Pill>}</Track>}
  >
    <div className="grid min-w-0 gap-6 md:grid-cols-2">
      {groups.map(group => <DeskSection key={group.title} title={group.title}><Facts items={group.items} /></DeskSection>)}
    </div>
    <RelatedLinks desk={desk} data={data} />
    {desk === 'bookings' && <div className="grid min-w-0 gap-6 md:grid-cols-2">
      <DeskSection title="Travelers" count={data.passengersCount ?? undefined}>
        {data.passengers?.length ? <Panel className="divide-y overflow-hidden">{data.passengers.map(entry => <div key={entry.id} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
          {entry.passenger?.id ? <Link href={`/dashboard/platform/passengers/${encodeURIComponent(entry.passenger.id)}`} className="min-w-0 break-words font-medium hover:underline">{entry.passenger.givenName} {entry.passenger.familyName}</Link> : <span className="text-muted-foreground">Traveler restricted</span>}
          <span className="tabular-nums text-xs uppercase tracking-wide text-muted-foreground">{readable(entry.passengerType ?? 'adult')}{entry.isPrimaryContact ? ' · lead' : ''}</span>
        </div>)}</Panel> : <Well>Travelers unavailable</Well>}
      </DeskSection>
      <DeskSection title="Flights" count={data.segmentsCount ?? undefined}>
        {data.segments?.length ? <Panel className="divide-y overflow-hidden">{data.segments.map(segment => <div key={segment.id} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
          <TitleLine as="span" tone={statusTone(segment.status)} status={readable(segment.status)} className="tabular-nums font-semibold">{segment.marketingFlightNumber} {segment.originCode}–{segment.destinationCode}</TitleLine>
          <span className="tabular-nums text-xs  text-muted-foreground">{formatAirportTime(segment.scheduledDepartureAt, segment.flightInstance?.origin?.timezone)} · {segment.cabinCode ?? ''} {segment.fareBrandCode ?? ''}</span>
        </div>)}</Panel> : <Well>Flights unavailable</Well>}
      </DeskSection>
    </div>}
    {desk === 'bookings' && <DeskSection title="Original accepted terms">
      {receipt?.accepted ? <div className="space-y-3">
        <Facts items={[{ label: 'Offer', value: receipt.accepted.offerNumber, mono: true }, { label: 'Total', value: formatMinorUnits(receipt.accepted.totalAmount, receipt.accepted.currencyCode), mono: true }]} />
        <Panel className="divide-y overflow-hidden">
          {receipt.accepted.items.map((item,index) => <div key={index} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
            <span className="min-w-0 break-words font-medium">{item.description}</span>
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-muted-foreground">
              <span>{item.fareName ?? 'Fare unavailable'}</span>
              <span className="tabular-nums ">{item.quantity} travelers</span>
              {item.includedBaggage && <span className="tabular-nums ">{item.includedBaggage.pieces} bag(s) · {item.includedBaggage.maxWeightGrams / 1000} kg</span>}
              <span className="tabular-nums  text-foreground">{formatMinorUnits(item.totalAmount,item.currencyCode)}</span>
            </span>
          </div>)}
        </Panel>
      </div> : <Well>Original terms unavailable.</Well>}
    </DeskSection>}
    {desk === 'schedules' && <DeskSection title="Inventory" count={data.inventoryBucketsCount ?? undefined}>
      {data.inventoryBuckets?.length ? <Panel className="divide-y overflow-hidden">
        {data.inventoryBuckets.slice(0,50).map(bucket => <RowLink key={bucket.id} href={`/dashboard/platform/inventory/${encodeURIComponent(bucket.id)}`}>
          <TitleLine as="span" tone={statusTone(bucket.status)} status={readable(bucket.status)} className="tabular-nums text-sm font-semibold">{bucket.bookingClassCode ?? 'Class unavailable'}</TitleLine>
          <span className="flex flex-wrap gap-x-3 gap-y-1 tabular-nums text-xs  text-muted-foreground"><span>auth {readable(bucket.authorized)}</span><span>sold {readable(bucket.sold)}</span><span>held {readable(bucket.held)}</span><span>blocked {readable(bucket.blocked)}</span></span>
        </RowLink>)}
        {data.inventoryBuckets.length > 50 && <RowLink href="/dashboard/platform/inventory"><span className="text-sm text-muted-foreground">Showing the first 50 buckets</span><span className="text-sm font-medium">Inventory & fares</span></RowLink>}
      </Panel> : <Well>{data.inventoryBucketsCount === undefined || data.inventoryBucketsCount === null ? 'Count unavailable' : 'No inventory buckets'}</Well>}
    </DeskSection>}
    {desk === 'passengers' && <DeskSection title="Bookings and stations" count={data.bookingPassengers?.length}>
      {data.bookingPassengers?.length ? <Panel className="divide-y overflow-hidden">
        {data.bookingPassengers.slice(0,20).map(link => <div key={link.id} className="min-w-0">
          {link.booking?.recordLocator
            ? <RowLink href={bookingHref(link.booking.recordLocator)}><Code className="text-sm font-semibold text-foreground">{link.booking.recordLocator}</Code><span className="tabular-nums text-xs  text-muted-foreground">{link.booking.segments?.length ?? 0} segments</span></RowLink>
            : <div className="px-4 py-3 text-sm text-muted-foreground">Booking unavailable</div>}
          {link.booking?.segments?.slice(0,20).map(segment => segment.flightInstance?.serviceDate
            ? <RowLink key={segment.id} className="py-2 pl-8" href={`/dashboard/platform/departures?date=${encodeURIComponent(segment.flightInstance.serviceDate.slice(0,10))}&origin=${encodeURIComponent(segment.originCode)}`}><span className="flex items-center gap-3"><Route from={segment.originCode} to={segment.destinationCode} /><Code>{segment.flightInstance.serviceDate.slice(0,10)}</Code></span><span className="text-xs font-medium">Station manifest</span></RowLink>
            : <div key={segment.id} className="flex items-center gap-3 px-4 py-2 pl-8"><Route from={segment.originCode} to={segment.destinationCode} /><Code>Date unavailable</Code></div>)}
          {(link.booking?.segments?.length ?? 0) > 20 && <p className="px-4 py-2 pl-8 text-xs text-muted-foreground">More segments in the linked booking</p>}
        </div>)}
        {data.bookingPassengers.length > 20 && <p className="px-4 py-2 text-xs text-muted-foreground">Showing 20 linked bookings</p>}
      </Panel> : <Well>No linked bookings visible under your current access.</Well>}
    </DeskSection>}
  </Shell>
}
