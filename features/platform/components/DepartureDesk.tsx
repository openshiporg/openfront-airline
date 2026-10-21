'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

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

  if (!manifest.flights.length && !manifest.refundCleanup.items.length && manifest.refundCleanup.totalCount === 0) return <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No station-authorized flights or refund/void-marked booking segments were found for {manifest.serviceDate}.</p>
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{manifest.carrier ? `${manifest.carrier.name} · ${manifest.carrier.code}` : 'Carrier manifest'} · {manifest.serviceDate}</p><p className="text-xs text-muted-foreground">Up to 50 ticketed flights · cleanup page size {manifest.refundCleanup.pageSize}</p></div>
    {message && <p role={messageFailed ? 'alert' : 'status'} className={`rounded-lg px-3 py-2 text-sm ${messageFailed ? 'bg-destructive/10 text-destructive' : 'bg-primary/10'}`}>{message}</p>}
    <section aria-labelledby="refund-cleanup-heading" className="overflow-hidden rounded-2xl border border-amber-500/40 bg-card">
      <header className="border-b bg-amber-500/5 p-5"><h2 id="refund-cleanup-heading" className="font-semibold">Refund / void follow-up · read-only worklist</h2><p className="mt-1 text-sm text-muted-foreground">This resumable projection is recomputed from persisted booking, ticketing, segment, and artifact records; there is no separate cleanup-intent record. Eligible rows link only to the existing authorized cancellation command. Internal refund/cancellation state proves neither external settlement nor physical baggage disposition.</p></header>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3"><p className="text-xs text-muted-foreground">{manifest.refundCleanup.items.length} shown on this page · {manifest.refundCleanup.totalCount} matching refund/void segments for this service date/station.</p>{manifest.refundCleanup.hasNextPage && cleanupNextHref ? <Link href={cleanupNextHref} className="inline-flex rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Next {manifest.refundCleanup.pageSize} cleanup records →</Link> : manifest.refundCleanup.hasNextPage ? <span className="text-xs text-muted-foreground">More records exist; reload the manifest to continue.</span> : null}</div>
      {manifest.refundCleanup.items.length ? <div className="divide-y">{manifest.refundCleanup.items.map(item => <article key={item.id} className="space-y-3 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-medium">{item.originCode} → {item.destinationCode} · Flight {item.flightNumber} · Booking {item.recordLocator}</p><p className="text-sm text-muted-foreground">Departs {departureDateTime.format(new Date(item.scheduledDepartureAt))} · segment {item.sequence} ({item.segmentStatus}) · flight {item.flightStatus}</p></div><span className="w-fit rounded-full bg-amber-500/10 px-3 py-1 text-xs">Payment record: {item.paymentStatus} · ticketing record: {item.ticketingStatus}</span></div>
        <p className="text-xs text-muted-foreground">Internal booking state: {item.bookingStatus}. Related records: check-ins {item.artifacts.checkIns} (boarded {item.artifacts.boardedCheckIns}), active passes {item.artifacts.boardingPasses} (boarded {item.artifacts.boardedPasses}), seat assignments {item.artifacts.seatAssignments} (paid/inconsistent {item.artifacts.paidOrInconsistentSeats}), direct bags {item.artifacts.directBags}, route-linked bag references {item.artifacts.routeLinkedBags}, ticket coupons {item.artifacts.ticketCoupons} (active {item.artifacts.activeTicketCoupons}, refunded {item.artifacts.refundedTicketCoupons}, voided {item.artifacts.voidedTicketCoupons}, boarded/flown {item.artifacts.boardedCoupons}), ancillary coupons {item.artifacts.ancillaryCoupons} (active {item.artifacts.activeAncillaryCoupons}, refunded {item.artifacts.refundedAncillaryCoupons}, voided {item.artifacts.voidedAncillaryCoupons}), active service obligations {item.artifacts.activeServiceObligations}, active tickets {item.artifacts.activeTickets}, verified-document records {item.artifacts.documentVerifications}.</p>
        {item.gate === 'blocked_by_boarded_or_flown' ? <p className="text-sm text-destructive">Cancellation is blocked by {item.boardedOrFlownSegmentCount} boarded/flown segment(s) and/or {item.boardedPassengerArtifactCount} boarded passenger-service artifact(s). No cancellation action is offered.</p> : item.gate === 'blocked_by_artifact_disposition' ? <p className="text-sm text-destructive">Cancellation is blocked by persisted artifact(s): {item.artifacts.directBags + item.artifacts.routeLinkedBags} bag references, {item.artifacts.paidOrInconsistentSeats} paid/inconsistent seats, and {item.artifacts.activeAncillaryCoupons} open/used/unknown ancillary coupons. This desk cannot determine physical bag disposition or compensation.</p> : item.gate === 'cancelled_requires_reconciliation' ? <p className="text-sm text-destructive">The booking is already marked cancelled but passenger-service artifacts remain. The existing cancellation command cannot safely replay or reconcile them; no cleanup mutation is available here.</p> : item.gate === 'booking_desk_cancel_review' && manifest.canOpenBookingDesk ? <p className="text-sm text-muted-foreground">Use only the existing authorized booking-cancellation command; it revalidates eligibility and may reject. This queue performs no mutation.</p> : item.gate === 'read_only' ? <p className="text-sm text-muted-foreground">Visible to this station role, but the existing booking-cancellation command is not authorized here.</p> : item.bookingStatus === 'cancelled' ? <p className="text-sm text-muted-foreground">Booking and segment history are already marked cancelled. Retained ticket/coupon artifacts remain visible here; this projection does not infer external settlement or disposition and offers no replay.</p> : <p className="text-sm text-muted-foreground">The persisted payment/ticketing state is not sufficient for this queue to offer cancellation. Review external evidence and use only the existing workflow, which rechecks authorization and eligibility.</p>}
        {item.gate === 'booking_desk_cancel_review' && manifest.canOpenBookingDesk && <Link href={`/dashboard/platform/bookings?locator=${encodeURIComponent(item.recordLocator)}`} className="inline-flex rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open in Booking Desk</Link>}
      </article>)}</div> : <p className="p-5 text-sm text-muted-foreground">{manifest.refundCleanup.totalCount === 0 ? 'No refunded/voided booking segments are recorded at this station for this service date.' : 'No rows remain on this cursor page. Reload the manifest to re-evaluate the queue.'}</p>}
      {manifest.refundCleanup.hasNextPage && <p className="border-t px-5 py-3 text-xs text-muted-foreground">A further page is available. The visible grouped coupon/artifact summaries are limited to the current page; counts report all matching segment records at request time.</p>}
    </section>
    {!manifest.flights.length ? <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No station-authorized flights with ticketed travelers were found for {manifest.serviceDate}.</p> : manifest.flights.map(flight => <section key={flight.id} className="overflow-hidden rounded-2xl border bg-card">
      <header className="flex flex-col gap-2 border-b bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between"><div><Link href={`${detailBase}/${flight.id}`} className="font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{flight.origin.iataCode} → {flight.destination.iataCode} · Flight {flight.flightNumber}</Link><p className="text-sm text-muted-foreground">{departureDateTime.format(new Date(flight.scheduledDepartureAt))} · Terminal {flight.departureTerminal ?? 'TBD'} · Gate {flight.departureGate ?? 'TBD'}</p></div><span className="w-fit rounded-full bg-background px-3 py-1 text-xs">{flight.status} · {flight.travelers.length} travelers</span></header>
      <div className="divide-y">{flight.travelers.map(traveler => {
        const key = `${traveler.bookingPassengerId}:${traveler.bookingSegmentId}`
        const currentDocument = traveler.documents.find(document => document.status === 'verified' && (!document.expiresAt || new Date(document.expiresAt) > new Date()))
        const verify = verificationInput(key, currentDocument)
        const register = documentInput(key)
        const pass = traveler.checkIn?.boardingPass
        return <article key={key} className="space-y-4 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-medium">{traveler.passenger.givenName} {traveler.passenger.familyName}</p><p className="text-sm text-muted-foreground">Booking {traveler.recordLocator} · segment {traveler.segmentStatus}{traveler.passenger.dateOfBirth ? ` · born ${traveler.passenger.dateOfBirth}` : ''}</p></div><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-muted px-2.5 py-1">Document {traveler.verificationPresent ? 'verified' : manifest.canVerifyDocuments ? 'pending' : 'restricted'}</span><span className="rounded-full bg-muted px-2.5 py-1">Check-in {traveler.checkIn?.status ?? 'not started'}</span>{pass && <span className="rounded-full bg-muted px-2.5 py-1">Pass {pass.status} · {pass.seatDesignator ?? 'seat pending'}</span>}</div></div>
          {!traveler.verificationPresent && <div className="grid gap-3 rounded-xl border border-dashed p-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
            {currentDocument ? <>
              <label className="text-xs font-medium">Authoritative reference<input value={verify.providerReference} onChange={event => setVerificationInputs(values => ({ ...values, [key]: { ...verify, providerReference: event.target.value } }))} placeholder="Provider or manual review reference" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" /></label>
              <label className="text-xs font-medium">Evidence version<input value={verify.evidenceVersion} onChange={event => setVerificationInputs(values => ({ ...values, [key]: { ...verify, evidenceVersion: event.target.value } }))} placeholder="Policy/evidence version" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" /></label>
              <label className="text-xs font-medium">Valid through<input type="date" value={verify.expiresAt} max={currentDocument.expiresAt?.slice(0, 10)} onChange={event => setVerificationInputs(values => ({ ...values, [key]: { ...verify, expiresAt: event.target.value } }))} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" /></label>
              <button disabled={working === key || !verify.providerReference.trim() || !verify.evidenceVersion.trim() || !verify.expiresAt} onClick={() => run(key, () => mutate(`mutation($document:ID!,$segment:ID!,$reference:String!,$version:String!,$expires:String!,$key:String!){verifyPassengerTravelDocument(travelDocumentId:$document,bookingSegmentId:$segment,providerReference:$reference,evidenceVersion:$version,expiresAt:$expires,idempotencyKey:$key){status}}`, { document: currentDocument.id, segment: traveler.bookingSegmentId, reference: verify.providerReference, version: verify.evidenceVersion, expires: `${verify.expiresAt}T23:59:59.000Z`, key: `verify-${currentDocument.id}-${traveler.bookingSegmentId}-${verify.evidenceVersion}-${verify.expiresAt}` }), 'Document evidence recorded.')} className="self-end rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50">Verify evidence</button>
            </> : manifest.canVerifyDocuments ? <div className="space-y-3 lg:col-span-4"><div><p className="text-sm font-medium">Record a physical-document check</p><p className="text-xs text-muted-foreground">Use only after inspecting the original. The full number is HMAC-tokenized and never retained in raw form.</p></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><select aria-label="Document type" value={register.documentType} onChange={event => setDocumentInputs(values => ({ ...values, [key]: { ...register, documentType: event.target.value } }))} className="rounded-lg border bg-background px-3 py-2 text-sm"><option value="passport">Passport</option><option value="national_id">National identity card</option><option value="residence_permit">Residence permit</option><option value="other">Other</option></select><input autoComplete="off" value={register.documentNumber} onChange={event => setDocumentInputs(values => ({ ...values, [key]: { ...register, documentNumber: event.target.value } }))} placeholder="Full document number" aria-label="Full document number" className="rounded-lg border bg-background px-3 py-2 text-sm" /><input maxLength={2} value={register.issuingCountryCode} onChange={event => setDocumentInputs(values => ({ ...values, [key]: { ...register, issuingCountryCode: event.target.value.toUpperCase() } }))} placeholder="Issuing country (ISO, e.g. GB)" aria-label="Issuing country" required className="rounded-lg border bg-background px-3 py-2 text-sm" /><input maxLength={2} value={register.nationalityCode} onChange={event => setDocumentInputs(values => ({ ...values, [key]: { ...register, nationalityCode: event.target.value.toUpperCase() } }))} placeholder="Nationality (optional)" aria-label="Nationality" className="rounded-lg border bg-background px-3 py-2 text-sm" /><label className="text-xs font-medium">Document expiry<input type="date" value={register.expiresAt} onChange={event => setDocumentInputs(values => ({ ...values, [key]: { ...register, expiresAt: event.target.value } }))} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" /></label><input value={register.providerReference} onChange={event => setDocumentInputs(values => ({ ...values, [key]: { ...register, providerReference: event.target.value } }))} placeholder="Manual/provider reference" aria-label="Manual or provider reference" className="self-end rounded-lg border bg-background px-3 py-2 text-sm" /><input value={register.evidenceVersion} onChange={event => setDocumentInputs(values => ({ ...values, [key]: { ...register, evidenceVersion: event.target.value } }))} placeholder="Evidence version" aria-label="Evidence version" className="self-end rounded-lg border bg-background px-3 py-2 text-sm" /><button disabled={working === key || register.documentNumber.replace(/[^A-Z0-9]/gi, '').length < 4 || !/^[A-Z]{2}$/.test(register.issuingCountryCode) || (register.nationalityCode !== '' && !/^[A-Z]{2}$/.test(register.nationalityCode)) || !register.expiresAt || !register.providerReference.trim() || !register.evidenceVersion.trim()} onClick={() => run(key, async () => { const documentExpiry = new Date(`${register.expiresAt}T23:59:59.000Z`); const verificationExpiry = new Date(Math.min(documentExpiry.getTime(), Date.now() + 24 * 60 * 60_000)); await mutate(`mutation($passenger:ID!,$segment:ID!,$type:String!,$number:String!,$country:String!,$nationality:String,$expires:String!,$reference:String!,$version:String!,$verificationExpires:String!,$key:String!){registerPassengerTravelDocument(bookingPassengerId:$passenger,bookingSegmentId:$segment,documentType:$type,documentNumber:$number,issuingCountryCode:$country,nationalityCode:$nationality,expiresAt:$expires,providerReference:$reference,evidenceVersion:$version,verificationExpiresAt:$verificationExpires,idempotencyKey:$key){status}}`, { passenger: traveler.bookingPassengerId, segment: traveler.bookingSegmentId, type: register.documentType, number: register.documentNumber, country: register.issuingCountryCode, nationality: register.nationalityCode || null, expires: documentExpiry.toISOString(), reference: register.providerReference, version: register.evidenceVersion, verificationExpires: verificationExpiry.toISOString(), key: `register-document-${traveler.bookingPassengerId}-${traveler.bookingSegmentId}` }); setDocumentInputs(values => ({ ...values, [key]: { ...register, documentNumber: '', providerReference: '' } })) }, 'Document tokenized and authoritative station evidence recorded.')} className="self-end rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Tokenize and attest</button></div></div> : <p className="text-sm text-muted-foreground lg:col-span-4">Secure passenger-document permission is required to view identity details or record an attestation.</p>}
          </div>}
          <div className="flex flex-wrap items-end gap-2">
            {(!traveler.checkIn || traveler.checkIn.status === 'offloaded') && <button disabled={working === key || !traveler.verificationPresent} onClick={() => run(key, () => mutate(`mutation($passenger:ID!,$segment:ID!,$key:String!){checkInBookingPassenger(bookingPassengerId:$passenger,bookingSegmentId:$segment,idempotencyKey:$key){status}}`, { passenger: traveler.bookingPassengerId, segment: traveler.bookingSegmentId, key: `checkin-${traveler.bookingPassengerId}-${traveler.bookingSegmentId}-${traveler.checkIn?.id ?? 'initial'}-${traveler.checkIn?.offloadedAt ?? 'initial'}` }), 'Traveler checked in and boarding pass issued.')} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{traveler.checkIn?.status === 'offloaded' ? 'Re-check in' : 'Check in'}</button>}
            {traveler.checkIn?.status === 'checked_in' && <><label className="text-xs font-medium">Bag weight (kg)<input inputMode="decimal" value={bagWeights[key] ?? ''} onChange={event => setBagWeights(values => ({ ...values, [key]: event.target.value }))} className="mt-1 w-28 rounded-lg border bg-background px-3 py-2 text-sm" /></label><button disabled={working === key || !Number.isFinite(Number(bagWeights[key])) || Number(bagWeights[key]) <= 0} onClick={() => run(key, () => mutate(`mutation($passenger:ID!,$flight:ID!,$weight:Int!,$key:String!){acceptCheckedBag(bookingPassengerId:$passenger,flightInstanceId:$flight,weightGrams:$weight,idempotencyKey:$key){status}}`, { passenger: traveler.bookingPassengerId, flight: flight.id, weight: Math.round(Number(bagWeights[key]) * 1000), key: `bag-${crypto.randomUUID()}` }), 'Bag accepted with immutable entitlement evidence.')} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Accept bag</button></>}
            {pass && ['issued', 'reissued'].includes(pass.status) && <button disabled={working === key} onClick={() => run(key, () => mutate(`mutation($pass:ID!,$key:String!){boardBookingPassenger(boardingPassId:$pass,idempotencyKey:$key){status}}`, { pass: pass.id, key: `board-${pass.id}` }), 'Traveler boarded; pass, check-in, coupon, and seat were updated atomically.')} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white">Board</button>}
            {pass?.status === 'boarded' && <><input aria-label="Offload reason" value={offloadReasons[key] ?? ''} onChange={event => setOffloadReasons(values => ({ ...values, [key]: event.target.value }))} placeholder="Offload reason" className="rounded-lg border bg-background px-3 py-2 text-sm" /><button disabled={working === key || !offloadReasons[key]?.trim()} onClick={() => window.confirm('Offload this traveler? Their boarding pass is revoked.') && run(key, () => mutate(`mutation($pass:ID!,$reason:String!,$key:String!){offloadBookingPassenger(boardingPassId:$pass,reason:$reason,idempotencyKey:$key){status}}`, { pass: pass.id, reason: offloadReasons[key], key: `offload-${pass.id}` }), 'Traveler offloaded; boarding entitlement was revoked and audit evidence recorded.')} className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive disabled:opacity-50">Offload</button></>}
          </div>
        </article>
      })}</div>
    </section>)}
  </div>
}
