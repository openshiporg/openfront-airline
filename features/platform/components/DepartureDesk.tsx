'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Code, DeskSection, Field, Notice, Panel, Pill, Readout, ReadoutStrip, Route, StatusDot, TitleLine, Track, Well, deskInput, statusTone, type DeskTone } from '@/features/platform/components/desk'

type DocumentSummary = { id: string; documentType: string; documentNumberLast4: string; status: string; expiresAt?: string | null }
type DocumentInput = { documentType: string; documentNumber: string; issuingCountryCode: string; nationalityCode: string; expiresAt: string; providerReference: string; evidenceVersion: string }
type CheckInSummary = {
  id: string
  status: string
  offloadedAt?: string | null
  boardingPass?: { id: string; passNumber: string; status: string; seatDesignator?: string | null; boardingGroup?: string | null } | null
  seatAssignment?: { id: string; status: string; seatDesignator?: string | null } | null
  ticketCoupon?: { id: string; status: string } | null
}
type Traveler = {
  recordLocator: string
  bookingPassengerId: string
  bookingSegmentId: string
  segmentStatus: string
  passenger: { id: string; givenName: string; familyName: string; dateOfBirth?: string | null }
  documents: DocumentSummary[]
  verificationPresent?: boolean
  verification?: { id: string; status: string; expiresAt: string } | null
  checkIn?: CheckInSummary | null
}
type RefundCleanupItem = {
  id: string
  recordLocator: string
  bookingStatus: string
  paymentStatus: string
  ticketingStatus: string
  segmentStatus: string
  sequence: number
  originCode: string
  destinationCode: string
  flightNumber: string
  flightStatus: string
  scheduledDepartureAt: string
  boardedOrFlownSegmentCount: number
  gate: 'booking_desk_cancel_review' | 'blocked_by_boarded_or_flown' | 'blocked_by_artifact_disposition' | 'cancelled_requires_reconciliation' | 'read_only' | 'review_required'
  boardedPassengerArtifactCount: number
  artifacts: { checkIns: number; boardedCheckIns: number; boardingPasses: number; boardedPasses: number; seatAssignments: number; paidOrInconsistentSeats: number; directBags: number; routeLinkedBags: number; ticketCoupons: number; activeTicketCoupons: number; refundedTicketCoupons: number; voidedTicketCoupons: number; boardedCoupons: number; ancillaryCoupons: number; activeAncillaryCoupons: number; refundedAncillaryCoupons: number; voidedAncillaryCoupons: number; activeServiceObligations: number; activeTickets: number; documentVerifications: number }
}
type Flight = {
  id: string
  flightNumber: string
  status: string
  scheduledDepartureAt: string
  scheduledArrivalAt: string
  origin: { iataCode: string; city: string }
  destination: { iataCode: string; city: string }
  departureGate?: string | null
  departureTerminal?: string | null
  travelers: Traveler[]
}
type Manifest = { serviceDate: string; canVerifyDocuments: boolean; canOpenBookingDesk: boolean; carrier?: { name: string; code: string; defaultTimezone: string } | null; flights: Flight[]; refundCleanup: { items: RefundCleanupItem[]; pageSize: number; totalCount: number; hasNextPage: boolean; nextCursor: string | null } }

async function mutate(query: string, variables: Record<string, unknown>) {
  const response = await fetch('/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify({ query, variables }) })
  const body = await response.json() as { data?: any; errors?: Array<{ message: string }> }
  if (!response.ok || body.errors?.length || !body.data) throw new Error(body.errors?.[0]?.message ?? 'Departure operation failed.')
  return body.data
}

export function DepartureDesk({ manifest, detailBase = '/dashboard/departures', cleanupNextHref }: { manifest: Manifest; detailBase?: string; cleanupNextHref?: string | null }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  // Command failures render as alerts, not in the success-styled status banner.
  const [messageFailed, setMessageFailed] = useState(false)
  const [working, setWorking] = useState<string | null>(null)
  const [bagWeights, setBagWeights] = useState<Record<string, string>>({})
  const [offloadReasons, setOffloadReasons] = useState<Record<string, string>>({})
  const [verificationInputs, setVerificationInputs] = useState<Record<string, { providerReference: string; evidenceVersion: string; expiresAt: string }>>({})
  const [documentInputs, setDocumentInputs] = useState<Record<string, DocumentInput>>({})
  const departureDateTime = useMemo(() => new Intl.DateTimeFormat('en-US', { timeZone: manifest.carrier?.defaultTimezone ?? 'UTC', dateStyle: 'medium', timeStyle: 'short' }), [manifest.carrier?.defaultTimezone])

  async function run(key: string, operation: () => Promise<unknown>, success: string) {
    setWorking(key); setMessageFailed(false); setMessage('')
    try { await operation(); setMessage(success); router.refresh() }
    catch (error) { setMessageFailed(true); setMessage(error instanceof Error ? error.message : 'Departure operation failed.') }
    setWorking(null)
  }

  function verificationInput(key: string, document?: DocumentSummary) {
    const fallbackExpiry = document?.expiresAt?.slice(0, 10) ?? ''
    return verificationInputs[key] ?? { providerReference: '', evidenceVersion: '', expiresAt: fallbackExpiry }
  }

  function documentInput(key: string): DocumentInput {
    return documentInputs[key] ?? { documentType: 'passport', documentNumber: '', issuingCountryCode: '', nationalityCode: '', expiresAt: '', providerReference: '', evidenceVersion: 'station-physical-check-v1' }
  }

  if (!manifest.flights.length && !manifest.refundCleanup.items.length && manifest.refundCleanup.totalCount === 0) return <Well>No flights or refund/void segments for <span className="font-mono tabular-nums text-foreground">{manifest.serviceDate}</span></Well>
  const allTravelers = manifest.flights.flatMap(flight => flight.travelers)
  const checkedInCount = allTravelers.filter(traveler => traveler.checkIn?.status === 'checked_in' || traveler.checkIn?.boardingPass?.status === 'boarded').length
  const boardedCount = allTravelers.filter(traveler => traveler.checkIn?.boardingPass?.status === 'boarded').length
  const verifiedCount = allTravelers.filter(traveler => traveler.verificationPresent).length
  const cleanup = manifest.refundCleanup
  return <div className="space-y-8">
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{manifest.carrier ? `${manifest.carrier.name} · ${manifest.carrier.code}` : 'Carrier manifest'}</p>
      <span className="font-mono text-sm tabular-nums text-foreground">{manifest.serviceDate}</span>
    </div>
    {manifest.flights.length > 0 && <ReadoutStrip>
      <Readout label="Flights" value={<span className="font-mono">{manifest.flights.length}</span>} />
      <Readout label="Passengers" value={<span className="font-mono">{allTravelers.length}</span>} />
      <Readout label="Docs verified" tone={verifiedCount < allTravelers.length ? 'warn' : 'ok'} value={<span className="font-mono">{verifiedCount}</span>} />
      <Readout label="Checked in" value={<span className="font-mono">{checkedInCount}</span>} />
      <Readout label="Boarded" tone={boardedCount ? 'ok' : undefined} value={<span className="font-mono">{boardedCount}</span>} />
    </ReadoutStrip>}
    {message && <Notice tone={messageFailed ? 'bad' : 'ok'} role={messageFailed ? 'alert' : 'status'}>{message}</Notice>}

    {!manifest.flights.length ? <Well>No ticketed flights for <span className="font-mono tabular-nums text-foreground">{manifest.serviceDate}</span></Well> : manifest.flights.map(flight => <section key={flight.id} aria-labelledby={`flight-${flight.id}`} className="min-w-0 space-y-3">
      <header className="flex min-w-0 flex-col gap-3 border-b pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <TitleLine as="h2" tone={statusTone(flight.status)} status={flight.status} className="text-foreground">
            <Link id={`flight-${flight.id}`} href={`${detailBase}/${flight.id}`} className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="font-mono text-xl font-semibold tabular-nums tracking-tight">{flight.flightNumber}</span><Route from={flight.origin.iataCode} to={flight.destination.iataCode} className="text-base" /></Link>
          </TitleLine>
          <p className="text-sm text-muted-foreground">{flight.origin.city} – {flight.destination.city} · <span className="capitalize">{flight.status.replaceAll('_', ' ')}</span> · <span className="font-mono tabular-nums">{flight.travelers.length}</span> pax</p>
        </div>
        <dl className="flex shrink-0 flex-wrap gap-x-6 gap-y-2">
          <FlightFact label="Departs" value={departureDateTime.format(new Date(flight.scheduledDepartureAt))} />
          <FlightFact label="Terminal" value={flight.departureTerminal ?? 'TBD'} />
          <FlightFact label="Gate" value={flight.departureGate ?? 'TBD'} large />
        </dl>
      </header>
      <Panel className="divide-y">{flight.travelers.map(traveler => {
        const key = `${traveler.bookingPassengerId}:${traveler.bookingSegmentId}`
        const currentDocument = traveler.documents.find(document => document.status === 'verified' && (!document.expiresAt || new Date(document.expiresAt) > new Date()))
        const verify = verificationInput(key, currentDocument)
        const register = documentInput(key)
        const pass = traveler.checkIn?.boardingPass
        const passengerState = pass?.status === 'boarded' ? 'boarded' : traveler.checkIn?.status ?? 'not checked in'
        const documentState = traveler.verificationPresent ? 'verified' : manifest.canVerifyDocuments ? 'pending' : 'restricted'
        return <article key={key} className="space-y-3 px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <TitleLine as="h3" tone={traveler.checkIn ? statusTone(passengerState) : 'idle'} status={passengerState} className="text-sm font-semibold text-foreground">{traveler.passenger.givenName} {traveler.passenger.familyName}</TitleLine>
              <Code className="text-[13px] font-medium text-foreground">{traveler.recordLocator}</Code>
              <PassengerState label="Doc" value={documentState} tone={traveler.verificationPresent ? 'ok' : manifest.canVerifyDocuments ? 'warn' : 'idle'} />
              <PassengerState label="Check-in" value={traveler.checkIn?.status ?? 'not started'} tone={traveler.checkIn ? statusTone(traveler.checkIn.status) : 'idle'} />
              {pass && <PassengerState label="Pass" value={pass.status} tone={statusTone(pass.status)} />}
            </div>
            {pass && <span className="inline-flex items-baseline gap-3 text-xs text-muted-foreground">{pass.boardingGroup && <span>Grp <span className="font-mono text-sm font-medium tabular-nums text-foreground">{pass.boardingGroup}</span></span>}<span>Seat <span className="font-mono text-base font-semibold tabular-nums text-foreground">{pass.seatDesignator ?? '—'}</span></span></span>}
          </div>
          <p className="text-xs text-muted-foreground">Segment <span className="capitalize">{traveler.segmentStatus.replaceAll('_', ' ')}</span>{traveler.passenger.dateOfBirth ? <> · DOB <span className="font-mono tabular-nums">{traveler.passenger.dateOfBirth}</span></> : null}</p>
          {!traveler.verificationPresent && <div className="border-t pt-3">
            {currentDocument ? <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_10rem_auto] lg:items-end">
              <Field label="Reference"><input value={verify.providerReference} onChange={event => setVerificationInputs(values => ({ ...values, [key]: { ...verify, providerReference: event.target.value } }))} placeholder="Provider or manual review reference" className={cn(deskInput, 'font-mono')} /></Field>
              <Field label="Evidence version"><input value={verify.evidenceVersion} onChange={event => setVerificationInputs(values => ({ ...values, [key]: { ...verify, evidenceVersion: event.target.value } }))} placeholder="Policy/evidence version" className={deskInput} /></Field>
              <Field label="Valid through"><input type="date" value={verify.expiresAt} max={currentDocument.expiresAt?.slice(0, 10)} onChange={event => setVerificationInputs(values => ({ ...values, [key]: { ...verify, expiresAt: event.target.value } }))} className={cn(deskInput, 'font-mono tabular-nums')} /></Field>
              <Track className="self-end justify-self-start"><Pill variant="primary" disabled={working === key || !verify.providerReference.trim() || !verify.evidenceVersion.trim() || !verify.expiresAt} onClick={() => run(key, () => mutate(`mutation($document:ID!,$segment:ID!,$reference:String!,$version:String!,$expires:String!,$key:String!){verifyPassengerTravelDocument(travelDocumentId:$document,bookingSegmentId:$segment,providerReference:$reference,evidenceVersion:$version,expiresAt:$expires,idempotencyKey:$key){status}}`, { document: currentDocument.id, segment: traveler.bookingSegmentId, reference: verify.providerReference, version: verify.evidenceVersion, expires: `${verify.expiresAt}T23:59:59.000Z`, key: `verify-${currentDocument.id}-${traveler.bookingSegmentId}-${verify.evidenceVersion}-${verify.expiresAt}` }), 'Document evidence recorded.')}>Verify document</Pill></Track>
            </div> : manifest.canVerifyDocuments ? <div className="space-y-2">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Document check</p>
              <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
                <select aria-label="Document type" value={register.documentType} onChange={event => setDocumentInputs(values => ({ ...values, [key]: { ...register, documentType: event.target.value } }))} className={cn(deskInput, 'self-end')}><option value="passport">Passport</option><option value="national_id">National identity card</option><option value="residence_permit">Residence permit</option><option value="other">Other</option></select>
                <input autoComplete="off" value={register.documentNumber} onChange={event => setDocumentInputs(values => ({ ...values, [key]: { ...register, documentNumber: event.target.value } }))} placeholder="Full document number" aria-label="Full document number" className={cn(deskInput, 'self-end font-mono')} />
                <input maxLength={2} value={register.issuingCountryCode} onChange={event => setDocumentInputs(values => ({ ...values, [key]: { ...register, issuingCountryCode: event.target.value.toUpperCase() } }))} placeholder="Issuing country (ISO, e.g. GB)" aria-label="Issuing country" required className={cn(deskInput, 'self-end font-mono')} />
                <input maxLength={2} value={register.nationalityCode} onChange={event => setDocumentInputs(values => ({ ...values, [key]: { ...register, nationalityCode: event.target.value.toUpperCase() } }))} placeholder="Nationality (optional)" aria-label="Nationality" className={cn(deskInput, 'self-end font-mono')} />
                <Field label="Document expiry"><input type="date" value={register.expiresAt} onChange={event => setDocumentInputs(values => ({ ...values, [key]: { ...register, expiresAt: event.target.value } }))} className={cn(deskInput, 'font-mono tabular-nums')} /></Field>
                <input value={register.providerReference} onChange={event => setDocumentInputs(values => ({ ...values, [key]: { ...register, providerReference: event.target.value } }))} placeholder="Manual/provider reference" aria-label="Manual or provider reference" className={cn(deskInput, 'self-end font-mono')} />
                <input value={register.evidenceVersion} onChange={event => setDocumentInputs(values => ({ ...values, [key]: { ...register, evidenceVersion: event.target.value } }))} placeholder="Evidence version" aria-label="Evidence version" className={cn(deskInput, 'self-end')} />
                <Track className="self-end justify-self-start"><Pill variant="primary" disabled={working === key || register.documentNumber.replace(/[^A-Z0-9]/gi, '').length < 4 || !/^[A-Z]{2}$/.test(register.issuingCountryCode) || (register.nationalityCode !== '' && !/^[A-Z]{2}$/.test(register.nationalityCode)) || !register.expiresAt || !register.providerReference.trim() || !register.evidenceVersion.trim()} onClick={() => run(key, async () => { const documentExpiry = new Date(`${register.expiresAt}T23:59:59.000Z`); const verificationExpiry = new Date(Math.min(documentExpiry.getTime(), Date.now() + 24 * 60 * 60_000)); await mutate(`mutation($passenger:ID!,$segment:ID!,$type:String!,$number:String!,$country:String!,$nationality:String,$expires:String!,$reference:String!,$version:String!,$verificationExpires:String!,$key:String!){registerPassengerTravelDocument(bookingPassengerId:$passenger,bookingSegmentId:$segment,documentType:$type,documentNumber:$number,issuingCountryCode:$country,nationalityCode:$nationality,expiresAt:$expires,providerReference:$reference,evidenceVersion:$version,verificationExpiresAt:$verificationExpires,idempotencyKey:$key){status}}`, { passenger: traveler.bookingPassengerId, segment: traveler.bookingSegmentId, type: register.documentType, number: register.documentNumber, country: register.issuingCountryCode, nationality: register.nationalityCode || null, expires: documentExpiry.toISOString(), reference: register.providerReference, version: register.evidenceVersion, verificationExpires: verificationExpiry.toISOString(), key: `register-document-${traveler.bookingPassengerId}-${traveler.bookingSegmentId}` }); setDocumentInputs(values => ({ ...values, [key]: { ...register, documentNumber: '', providerReference: '' } })) }, 'Document tokenized and authoritative station evidence recorded.')}>Tokenize and attest</Pill></Track>
              </div>
            </div> : <p className="text-xs text-muted-foreground">Document permission required</p>}
          </div>}
          <div className="flex min-w-0 flex-wrap items-end gap-2">
            {(!traveler.checkIn || traveler.checkIn.status === 'offloaded') && <Track><Pill variant="primary" disabled={working === key || !traveler.verificationPresent} onClick={() => run(key, () => mutate(`mutation($passenger:ID!,$segment:ID!,$key:String!){checkInBookingPassenger(bookingPassengerId:$passenger,bookingSegmentId:$segment,idempotencyKey:$key){status}}`, { passenger: traveler.bookingPassengerId, segment: traveler.bookingSegmentId, key: `checkin-${traveler.bookingPassengerId}-${traveler.bookingSegmentId}-${traveler.checkIn?.id ?? 'initial'}-${traveler.checkIn?.offloadedAt ?? 'initial'}` }), 'Traveler checked in and boarding pass issued.')}>{traveler.checkIn?.status === 'offloaded' ? 'Re-check in' : 'Check in'}</Pill></Track>}
            {traveler.checkIn?.status === 'checked_in' && <><Field label="Bag weight (kg)" className="w-28"><input inputMode="decimal" value={bagWeights[key] ?? ''} onChange={event => setBagWeights(values => ({ ...values, [key]: event.target.value }))} className={cn(deskInput, 'font-mono tabular-nums')} /></Field><Track><Pill disabled={working === key || !Number.isFinite(Number(bagWeights[key])) || Number(bagWeights[key]) <= 0} onClick={() => run(key, () => mutate(`mutation($passenger:ID!,$flight:ID!,$weight:Int!,$key:String!){acceptCheckedBag(bookingPassengerId:$passenger,flightInstanceId:$flight,weightGrams:$weight,idempotencyKey:$key){status}}`, { passenger: traveler.bookingPassengerId, flight: flight.id, weight: Math.round(Number(bagWeights[key]) * 1000), key: `bag-${crypto.randomUUID()}` }), 'Bag accepted with immutable entitlement evidence.')}>Accept bag</Pill></Track></>}
            {pass && ['issued', 'reissued'].includes(pass.status) && <Track><Pill variant="primary" disabled={working === key} onClick={() => run(key, () => mutate(`mutation($pass:ID!,$key:String!){boardBookingPassenger(boardingPassId:$pass,idempotencyKey:$key){status}}`, { pass: pass.id, key: `board-${pass.id}` }), 'Traveler boarded; pass, check-in, coupon, and seat were updated atomically.')}>Board</Pill></Track>}
            {pass?.status === 'boarded' && <><input aria-label="Offload reason" value={offloadReasons[key] ?? ''} onChange={event => setOffloadReasons(values => ({ ...values, [key]: event.target.value }))} placeholder="Offload reason" className={cn(deskInput, 'sm:w-56')} /><Track><Pill variant="danger" disabled={working === key || !offloadReasons[key]?.trim()} onClick={() => window.confirm('Offload this traveler? Their boarding pass is revoked.') && run(key, () => mutate(`mutation($pass:ID!,$reason:String!,$key:String!){offloadBookingPassenger(boardingPassId:$pass,reason:$reason,idempotencyKey:$key){status}}`, { pass: pass.id, reason: offloadReasons[key], key: `offload-${pass.id}` }), 'Traveler offloaded; boarding entitlement was revoked and audit evidence recorded.')}>Offload</Pill></Track></>}
          </div>
        </article>
      })}</Panel>
    </section>)}

    <DeskSection id="refund-cleanup-heading" title="Refund / void follow-up" count={cleanup.totalCount} actions={<div className="flex items-center gap-2"><span className="font-mono text-xs tabular-nums text-muted-foreground">{cleanup.items.length} on page</span>{cleanup.hasNextPage && cleanupNextHref ? <Track><Pill asChild size="sm"><Link href={cleanupNextHref}>Next {cleanup.pageSize}<ChevronRight /></Link></Pill></Track> : cleanup.hasNextPage ? <span className="text-xs text-muted-foreground">More exist; reload</span> : null}</div>}>
      {cleanup.items.length ? <Panel className="divide-y">{cleanup.items.map(item => <article key={item.id} className="space-y-2.5 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <TitleLine as="h3" tone={statusTone(item.bookingStatus)} status={item.bookingStatus}><Code className="text-lg font-semibold tracking-wide text-foreground">{item.recordLocator}</Code></TitleLine>
            <span className="font-mono text-sm font-medium tabular-nums text-foreground">{item.flightNumber}</span>
            <Route from={item.originCode} to={item.destinationCode} />
            <PassengerState label="Pay" value={item.paymentStatus} tone={statusTone(item.paymentStatus)} />
            <PassengerState label="Ticket" value={item.ticketingStatus} tone={statusTone(item.ticketingStatus)} />
          </div>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{departureDateTime.format(new Date(item.scheduledDepartureAt))}</span>
        </div>
        <p className="text-xs text-muted-foreground">Booking <span className="capitalize">{item.bookingStatus}</span> · Segment <span className="font-mono tabular-nums">{item.sequence}</span> <span className="capitalize">{item.segmentStatus}</span> · Flight <span className="capitalize">{item.flightStatus}</span></p>
        <dl className="grid min-w-0 gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <ArtifactFact label="Check-ins" value={`${item.artifacts.checkIns} · ${item.artifacts.boardedCheckIns} boarded`} />
          <ArtifactFact label="Boarding passes" value={`${item.artifacts.boardingPasses} · ${item.artifacts.boardedPasses} boarded`} />
          <ArtifactFact label="Seats" value={`${item.artifacts.seatAssignments} · ${item.artifacts.paidOrInconsistentSeats} paid/inconsistent`} />
          <ArtifactFact label="Bags" value={`${item.artifacts.directBags} direct · ${item.artifacts.routeLinkedBags} route-linked`} />
          <ArtifactFact label="Ticket coupons" value={`${item.artifacts.ticketCoupons} · ${item.artifacts.activeTicketCoupons} active · ${item.artifacts.refundedTicketCoupons} refunded · ${item.artifacts.voidedTicketCoupons} voided · ${item.artifacts.boardedCoupons} boarded/flown`} />
          <ArtifactFact label="Ancillary coupons" value={`${item.artifacts.ancillaryCoupons} · ${item.artifacts.activeAncillaryCoupons} active · ${item.artifacts.refundedAncillaryCoupons} refunded · ${item.artifacts.voidedAncillaryCoupons} voided`} />
          <ArtifactFact label="Service obligations" value={`${item.artifacts.activeServiceObligations} active`} />
          <ArtifactFact label="Tickets" value={`${item.artifacts.activeTickets} active`} />
          <ArtifactFact label="Doc verifications" value={`${item.artifacts.documentVerifications}`} />
        </dl>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          {item.gate === 'blocked_by_boarded_or_flown' ? <Notice tone="bad" className="w-full">Blocked: <span className="font-mono tabular-nums">{item.boardedOrFlownSegmentCount}</span> boarded/flown segments, <span className="font-mono tabular-nums">{item.boardedPassengerArtifactCount}</span> boarded artifacts</Notice> : item.gate === 'blocked_by_artifact_disposition' ? <Notice tone="bad" className="w-full">Blocked: <span className="font-mono tabular-nums">{item.artifacts.directBags + item.artifacts.routeLinkedBags}</span> bag references, <span className="font-mono tabular-nums">{item.artifacts.paidOrInconsistentSeats}</span> paid/inconsistent seats, <span className="font-mono tabular-nums">{item.artifacts.activeAncillaryCoupons}</span> open ancillary coupons</Notice> : item.gate === 'cancelled_requires_reconciliation' ? <Notice tone="bad" className="w-full">Cancelled with artifacts remaining; no cleanup command</Notice> : item.gate === 'booking_desk_cancel_review' && manifest.canOpenBookingDesk ? <GateState tone="warn">Cancellation review</GateState> : item.gate === 'read_only' ? <GateState tone="idle">Read-only for this role</GateState> : item.bookingStatus === 'cancelled' ? <GateState tone="idle">Cancelled; artifacts retained</GateState> : <GateState tone="warn">Review required</GateState>}
          {item.gate === 'booking_desk_cancel_review' && manifest.canOpenBookingDesk && <Track><Pill asChild size="sm"><Link href={`/dashboard/platform/bookings?locator=${encodeURIComponent(item.recordLocator)}`}>Open in Booking Desk<ChevronRight /></Link></Pill></Track>}
        </div>
      </article>)}</Panel> : <Well>{cleanup.totalCount === 0 ? 'No refund/void segments' : 'No rows on this page. Reload the manifest.'}</Well>}
      {cleanup.hasNextPage && <p className="mt-2 text-xs text-muted-foreground">More records on the next page</p>}
    </DeskSection>
  </div>
}

function FlightFact({ label, value, large }: { label: string; value: ReactNode; large?: boolean }) {
  return <div className="min-w-0">
    <dt className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
    <dd className={cn('font-mono tabular-nums text-foreground', large ? 'text-2xl font-semibold leading-tight' : 'text-sm font-medium')}>{value}</dd>
  </div>
}

function PassengerState({ label, value, tone }: { label: string; value: string; tone: DeskTone }) {
  return <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap text-xs text-muted-foreground">{label}<StatusDot tone={tone} className="-translate-y-[0.05em] size-1.5 shadow-none" /><span className="font-medium capitalize text-foreground">{value.replaceAll('_', ' ')}</span></span>
}

function ArtifactFact({ label, value }: { label: string; value: string }) {
  return <div className="flex min-w-0 items-baseline justify-between gap-3 border-b border-dashed py-1 last:border-b-0">
    <dt className="shrink-0 text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words text-right font-mono tabular-nums text-foreground">{value}</dd>
  </div>
}

function GateState({ tone, children }: { tone: DeskTone; children: ReactNode }) {
  return <p className="flex items-baseline gap-2 text-sm font-medium text-foreground"><StatusDot tone={tone} className="-translate-y-[0.1em] shadow-none" />{children}</p>
}
