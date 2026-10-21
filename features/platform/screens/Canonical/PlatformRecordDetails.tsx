import { safeDeskReturn } from '@/features/platform/lib/desk-return'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { Shell } from './PlatformDeskPages'
import type { BookingReceipt } from '@/features/airline/lib/booking-receipt'
import { formatMinorUnits } from '@/features/keystone/lib/money'

type Desk = 'schedules' | 'inventory' | 'offers' | 'bookings' | 'passengers' | 'departures' | 'disruptions' | 'payments' | 'manifests' | 'settings'

type DetailDefinition = { title: string; eyebrow: string; description: string; boundary: string; backLabel: string; query: string; actionHref?: (data: RecordData) => string | null; actionLabel?: string }

const detail: Record<Desk, DetailDefinition> = {
  schedules: { title: 'Dated flight record', eyebrow: 'Schedule execution context', description: 'Review the persisted dated-flight identity and bounded commercial state.', boundary: 'This is not dispatch, safety, crew-legality, equipment, or operational movement authority.', backLabel: 'Schedules & flights', query: `query PlatformScheduleDetail($id:ID!){flightInstance(where:{id:$id}){id flightNumber serviceDate status scheduledDepartureAt scheduledArrivalAt departureGate departureTerminal origin{iataCode city} destination{iataCode city} inventoryBuckets(take:51,orderBy:[{id:asc}]){id bookingClassCode status capacity authorized sold held blocked} inventoryBucketsCount}}` },
  inventory: { title: 'Inventory bucket record', eyebrow: 'Commercial authorization context', description: 'Review retained counts and authorization before using the inventory desk command.', boundary: 'Available inventory is a commercial calculation, not a seat-map, load-control, or operational availability assertion.', backLabel: 'Inventory & fares', query: `query PlatformInventoryDetail($id:ID!){inventoryBucket(where:{id:$id}){id bucketKey status bookingClassCode capacity authorized sold held blocked baseAmount taxAmount currencyCode cabin{code name} fareBrand{code name} flightInstance{id flightNumber serviceDate origin{iataCode} destination{iataCode}}}}` },
  offers: { title: 'Offer record', eyebrow: 'Retailing context', description: 'Review the persisted offer before accepting it from the booking desk.', boundary: 'An offer is not a booking, settlement, ticket, or travel entitlement.', backLabel: 'Offers', query: `query PlatformOfferDetail($id:ID!){offer(where:{id:$id}){id offerNumber status source expiresAt baseAmount taxAmount feeAmount discountAmount totalAmount currencyCode passengersCount itemsCount booking{id recordLocator}}}` },
  bookings: { title: 'Booking record', eyebrow: 'Servicing context', description: 'Review the locator-level state, then return to the platform booking desk for controlled commands.', boundary: 'Booking, payment, ticketing, and segment lifecycle state remain distinct; no state is inferred across them.', backLabel: 'Bookings', query: `query PlatformBookingDetail($id:ID!){booking(where:{id:$id}){id recordLocator orderNumber status paymentStatus ticketingStatus source totalAmount currencyCode passengersCount segmentsCount ticketsCount refundsCount checkInsCount bagsCount createdAt}}`, actionHref: data => data.recordLocator ? `/dashboard/platform/bookings?locator=${encodeURIComponent(data.recordLocator)}` : null, actionLabel: 'Open controlled booking commands' },
  passengers: { title: 'Passenger service record', eyebrow: 'Carrier-scoped service context', description: 'Review the bounded passenger workload before moving into a booking or station task.', boundary: 'Sensitive document material is intentionally not requested. This record does not determine government admissibility.', backLabel: 'Passengers & service', query: `query PlatformPassengerDetail($id:ID!){passenger(where:{id:$id}){id passengerKey givenName middleNames familyName status preferredLanguage bookingPassengersCount serviceRequestsCount checkInsCount bagsCount ticketsCount reaccommodationsCount updatedAt bookingPassengers(take:21,orderBy:[{id:asc}]){id booking{id recordLocator segments(take:21,orderBy:[{sequence:asc},{id:asc}]){id originCode destinationCode flightInstance{id serviceDate}}}}}}` },
  departures: { title: 'Departure flight record', eyebrow: 'Station service context', description: 'Review the selected flight’s station-facing context before returning to passenger-service commands.', boundary: 'This is not a dispatch, load/trim, security, government, safety, or crew-legality record.', backLabel: 'Departures', query: `query PlatformDepartureDetail($id:ID!){flightInstance(where:{id:$id}){id flightNumber serviceDate status scheduledDepartureAt scheduledArrivalAt departureGate departureTerminal origin{iataCode city} destination{iataCode city} checkInsCount}}`, actionHref: data => `/dashboard/platform/departures?date=${encodeURIComponent(data.serviceDate?.slice(0,10) ?? '')}&origin=${encodeURIComponent(data.origin?.iataCode ?? '')}`, actionLabel: 'Return to station manifest' },
  disruptions: { title: 'Recovery record', eyebrow: 'Irregular operations context', description: 'Review persisted passenger impact and recovery counts before selecting a replacement in the recovery desk.', boundary: 'This record does not establish operational cause, compensation eligibility, safety status, or government clearance.', backLabel: 'Disruptions', query: `query PlatformDisruptionDetail($id:ID!){disruption(where:{id:$id}){id disruptionKey type severity status publicSummary providerReference detectedAt publishedAt resolvedAt affectedSegmentsCount reaccommodationsCount flightInstance{id flightNumber serviceDate origin{iataCode} destination{iataCode}}}}`, actionHref: () => '/dashboard/platform/disruptions', actionLabel: 'Return to recovery commands' },
  payments: { title: 'Payment record', eyebrow: 'Settlement evidence context', description: 'Review the persisted payment values and provider identifiers without claiming external settlement success.', boundary: 'Only external evidence and the existing maker-checker workflow can support payment or refund settlement assertions.', backLabel: 'Payments & refunds', query: `query PlatformPaymentDetail($id:ID!){payment(where:{id:$id}){id paymentKey status amount authorizedAmount capturedAmount refundedAmount currencyCode providerPaymentId providerCaptureId instrumentBrand instrumentLast4 failureCode failureMessage createdAt booking{id recordLocator} provider{name adapterType status} refundsCount manualPaymentEvidenceCount}}`, actionHref: data => data.booking?.recordLocator ? `/dashboard/platform/bookings?locator=${encodeURIComponent(data.booking.recordLocator)}` : null, actionLabel: 'Open settlement workflow' },
  manifests: { title: 'Audit evidence record', eyebrow: 'Command trace', description: 'Review bounded command evidence for a platform aggregate.', boundary: 'This is an operational audit entry, not a certified manifest, government submission, safety document, or regulatory export.', backLabel: 'Manifest entry & audit', query: `query PlatformAuditDetail($id:ID!){auditEvent(where:{id:$id}){id eventKey action aggregateType aggregateId source correlationId idempotencyKey occurredAt actor{name} approvedAgent{legalName}}}` },
  settings: { title: 'Provider connection record', eyebrow: 'Persisted local evidence', description: 'Review configured connection state and recorded attempts without asserting a live provider health result.', boundary: 'PSS, DCS, payments, baggage, government, safety, regulatory, and certification readiness need external validation.', backLabel: 'Settings & readiness', query: `query PlatformConnectionDetail($id:ID!){providerConnection(where:{id:$id}){id connectionKey name status capabilities externalAccountId lastAttemptedAt lastSucceededAt lastErrorCode lastErrorMessage provider{name code type status} webhookEndpointsCount webhookEventsCount}}` },
}

type Related = { id?: string; recordLocator?: string; code?: string; name?: string; legalName?: string; iataCode?: string; city?: string; flightNumber?: string; serviceDate?: string; adapterType?: string; status?: string; type?: string }
type Bucket = { id: string; bookingClassCode?: string; status?: string; capacity?: number; authorized?: number; sold?: number; held?: number; blocked?: number }
type RecordData = Related & {
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

function readable(value?: string | number | null) { return value === undefined || value === null || value === '' ? 'Unavailable' : String(value).replaceAll('_', ' ') }
function date(value?: string) { return value && Number.isFinite(Date.parse(value)) ? `${new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))} UTC` : 'Unavailable' }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="min-w-0 border-b pb-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium [overflow-wrap:anywhere]">{children}</dd></div> }
function BookingLink({ booking }: { booking?: Related | null }) { return booking?.recordLocator ? <Link className="underline" href={`/dashboard/platform/bookings?locator=${encodeURIComponent(booking.recordLocator)}`}>{booking.recordLocator}</Link> : <>Booking unavailable</> }

function recordIdentity(desk: Desk, record: RecordData) {
  switch (desk) {
    case 'bookings': return record.recordLocator
    case 'offers': return record.offerNumber
    case 'schedules': case 'departures': return record.flightNumber ? `Flight ${record.flightNumber} · ${record.serviceDate?.slice(0,10) ?? 'Date unavailable'}` : undefined
    case 'inventory': return record.bucketKey
    case 'passengers': return [record.givenName, record.middleNames, record.familyName].filter(Boolean).join(' ') || record.passengerKey
    case 'disruptions': return record.disruptionKey
    case 'payments': return record.providerPaymentId || record.paymentKey
    case 'manifests': return record.eventKey
    case 'settings': return record.name || record.connectionKey
  }
}

function RecordFields({ desk, data }: { desk: Desk; data: RecordData }) {
  const text = (label: string, value?: string | number | null) => <Field key={label} label={label}>{readable(value)}</Field>
  const money = (label: string, amount?: number) => <Field key={label} label={label}>{formatMinorUnits(amount, data.currencyCode)}</Field>
  const at = (label: string, value?: string) => <Field key={label} label={label}>{date(value)}</Field>
  const fields: React.ReactNode[] = [text('Status', data.status)]
  switch (desk) {
    case 'schedules': case 'departures':
      fields.push(text('Origin', [data.origin?.iataCode, data.origin?.city].filter(Boolean).join(' · ')), text('Destination', [data.destination?.iataCode, data.destination?.city].filter(Boolean).join(' · ')), at('Scheduled departure', data.scheduledDepartureAt), at('Scheduled arrival', data.scheduledArrivalAt), text('Departure terminal', data.departureTerminal), text('Departure gate', data.departureGate), text('Check-ins', data.checkInsCount))
      break
    case 'inventory':
      fields.push(text('Booking class', data.bookingClassCode), text('Cabin', data.cabin?.name), text('Fare', data.fareBrand?.name), text('Capacity', data.capacity), text('Authorized', data.authorized), text('Sold', data.sold), text('Held', data.held), text('Blocked', data.blocked), money('Base fare', data.baseAmount), money('Tax', data.taxAmount))
      break
    case 'bookings':
      fields.push(text('Order number', data.orderNumber), text('Payment', data.paymentStatus), text('Ticketing', data.ticketingStatus), money('Booking total', data.totalAmount), text('Travelers', data.passengersCount), text('Segments', data.segmentsCount), text('Tickets', data.ticketsCount), text('Refunds', data.refundsCount), at('Created', data.createdAt))
      break
    case 'offers':
      fields.push(text('Source', data.source), money('Base fare', data.baseAmount), money('Tax', data.taxAmount), money('Fees', data.feeAmount), money('Discount', data.discountAmount), money('Total', data.totalAmount), text('Travelers', data.passengersCount), at('Hold expires', data.expiresAt), <Field key="booking" label="Booking"><BookingLink booking={data.booking} /></Field>)
      break
    case 'passengers':
      fields.push(text('Passenger reference', data.passengerKey), text('Language', data.preferredLanguage), text('Bookings', data.bookingPassengersCount), text('Service requests', data.serviceRequestsCount), text('Check-ins', data.checkInsCount), text('Bags', data.bagsCount), at('Updated', data.updatedAt))
      break
    case 'disruptions':
      fields.push(text('Impact', data.type), text('Severity', data.severity), text('Passenger summary', data.publicSummary), text('Provider reference', data.providerReference), text('Affected segments', data.affectedSegmentsCount), text('Replacements', data.reaccommodationsCount), at('Detected', data.detectedAt), at('Published', data.publishedAt), at('Resolved', data.resolvedAt))
      break
    case 'payments':
      fields.push(<Field key="booking" label="Booking"><BookingLink booking={data.booking} /></Field>, money('Amount', data.amount), money('Authorized', data.authorizedAmount), money('Captured', data.capturedAmount), money('Refunded', data.refundedAmount), text('Provider', data.provider?.name), text('Provider type', data.provider?.adapterType), text('Provider payment reference', data.providerPaymentId), text('Provider capture reference', data.providerCaptureId), text('Instrument', [data.instrumentBrand, data.instrumentLast4].filter(Boolean).join(' · ')), text('Failure code', data.failureCode), at('Created', data.createdAt))
      break
    case 'manifests':
      fields.push(text('Action', data.action), text('Resource type', data.aggregateType), text('Resource reference', data.aggregateId), text('Actor', data.actor?.name || data.approvedAgent?.legalName), text('Source', data.source), text('Correlation reference', data.correlationId), at('Occurred', data.occurredAt))
      break
    case 'settings':
      fields.push(text('Connection reference', data.connectionKey), text('Provider', data.provider?.name), text('Provider status', data.provider?.status), text('External account', data.externalAccountId), text('Capabilities', data.capabilities?.join(', ')), at('Last attempt', data.lastAttemptedAt), at('Last recorded success', data.lastSucceededAt), text('Last error code', data.lastErrorCode))
      break
  }
  return <dl className="grid gap-x-6 gap-y-4 rounded-xl border bg-card p-5 sm:grid-cols-2">{fields}</dl>
}

export async function PlatformRecordDetail({ desk, id, returnTo }: { desk: Desk; id: string; returnTo?: unknown }) {
  const definition = detail[desk]
  const response = await keystoneClient<Record<string, RecordData | null>>(definition.query, { id })
  const backHref = safeDeskReturn(desk,returnTo)
  if (!response.success) return <Shell title={definition.title} eyebrow={definition.backLabel} description="This record could not be loaded. Check your access and try again."><p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm">Record unavailable.</p><Link href={backHref} className="underline">Return to {definition.backLabel}</Link></Shell>
  const data = Object.values(response.data)[0]
  if (!data) notFound()
  const identity = recordIdentity(desk, data) || 'Record identity unavailable'
  const actionHref = definition.actionHref?.(data)
  // Receipt access is independent of the basic booking record; a denied receipt must not erase a readable booking.
  const receiptResponse = desk === 'bookings' ? await keystoneClient<{ operatorBookingReceipt?: BookingReceipt }>(`query PlatformAcceptedBooking($id:ID!){operatorBookingReceipt(bookingId:$id)}`, { id }) : null
  const receipt = receiptResponse?.success ? receiptResponse.data.operatorBookingReceipt : undefined
  return <Shell title={identity} eyebrow={definition.backLabel} description={desk === 'bookings' ? 'Current booking details and original accepted terms.' : 'Review this record and continue to its related task.'} parent={{ title: definition.backLabel, href: backHref }}>
    <RecordFields desk={desk} data={data} />
    {desk === 'bookings' && <section className="space-y-3 rounded-xl border bg-card p-5"><h2 className="font-semibold">Original accepted terms</h2>{receipt?.accepted ? <><p className="text-sm">{receipt.accepted.offerNumber} · {formatMinorUnits(receipt.accepted.totalAmount, receipt.accepted.currencyCode)}</p><ul className="space-y-2 text-sm">{receipt.accepted.items.map((item,index) => <li key={index} className="[overflow-wrap:anywhere]">{item.description} · {item.quantity} travelers · {item.fareName ?? 'Fare unavailable'} · {formatMinorUnits(item.totalAmount,item.currencyCode)}{item.includedBaggage ? ` · ${item.includedBaggage.pieces} included bag(s), ${item.includedBaggage.maxWeightGrams / 1000} kg each` : ''}</li>)}</ul><p className="text-sm text-muted-foreground">These are the accepted terms. Current payment and travel eligibility are shown separately.</p></> : <p className="text-sm text-muted-foreground">Original terms are unavailable under your current access or were not retained.</p>}</section>}
    {desk === 'schedules' && <section className="space-y-3 rounded-xl border bg-card p-5"><h2 className="font-semibold">Inventory · {data.inventoryBucketsCount ?? 'Count unavailable'}</h2><ul className="space-y-2 text-sm">{data.inventoryBuckets?.slice(0,50).map(bucket => <li key={bucket.id} className="[overflow-wrap:anywhere]"><Link className="underline" href={`/dashboard/platform/inventory/${encodeURIComponent(bucket.id)}`}>{bucket.bookingClassCode ?? 'Class unavailable'}</Link> · {readable(bucket.status)} · authorized {readable(bucket.authorized)} · sold {readable(bucket.sold)} · held {readable(bucket.held)} · blocked {readable(bucket.blocked)}</li>)}</ul>{(data.inventoryBuckets?.length ?? 0) > 50 && <p className="text-sm">Showing the first 50 buckets. <Link className="underline" href="/dashboard/platform/inventory">Continue in Inventory & fares</Link>.</p>}</section>}
    {desk === 'passengers' && <section className="space-y-3 rounded-xl border bg-card p-5"><h2 className="font-semibold">Related bookings and stations</h2><ul className="space-y-3 text-sm">{data.bookingPassengers?.slice(0,20).map(link => <li key={link.id}><BookingLink booking={link.booking} /><ul className="mt-1 space-y-1">{link.booking?.segments?.slice(0,20).map(segment => <li key={segment.id}>{segment.originCode} → {segment.destinationCode} · {segment.flightInstance?.serviceDate?.slice(0,10) ?? 'Date unavailable'} {segment.flightInstance?.serviceDate && <Link className="underline" href={`/dashboard/platform/departures?date=${encodeURIComponent(segment.flightInstance.serviceDate.slice(0,10))}&origin=${encodeURIComponent(segment.originCode)}`}>Open station manifest</Link>}</li>)}</ul>{(link.booking?.segments?.length ?? 0) > 20 && <p>More segments are available in the linked booking.</p>}</li>)}</ul>{!data.bookingPassengers?.length && <p className="text-sm">No linked bookings are visible under your current access.</p>}{(data.bookingPassengers?.length ?? 0) > 20 && <p className="text-sm">Showing 20 linked bookings. Use booking search for additional records.</p>}</section>}
    <div className="flex flex-wrap gap-3"><Link href={backHref} className="rounded-lg border px-4 py-2 text-sm">Return to {definition.backLabel}</Link>{actionHref && <Link href={actionHref} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">{definition.actionLabel}</Link>}</div>
  </Shell>
}
