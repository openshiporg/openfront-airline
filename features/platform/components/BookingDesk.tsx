'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { decimalToMinorUnits, formatMinorUnits } from '@/features/keystone/lib/money'

import type { Offer, Booking, RefundCleanupBooking, Evidence } from '@/features/airline/lib/operator-bookings'

async function mutate(query: string, variables: Record<string, unknown>) {
  const response = await fetch('/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify({ query, variables }) })
  const body = await response.json() as { data?: any; errors?: Array<{ message: string }> }
  if (!response.ok || body.errors?.length || !body.data || !Object.values(body.data).some(value => value !== null && typeof value === 'object' && 'status' in value && typeof value.status === 'string')) throw new Error(body.errors?.[0]?.message ?? 'Operation failed.')
  return body.data
}

export function BookingDesk({ offers, bookings, bookingCount, bookingHasNextPage, bookingNextHref, refundCleanupBookings, refundCleanupTruncated, evidences, sectionErrors = {}, detailBase = '/dashboard/bookings' }: { offers: Offer[]; bookings: Booking[]; bookingCount: number; bookingHasNextPage: boolean; bookingNextHref: string | null; refundCleanupBookings: RefundCleanupBooking[]; refundCleanupTruncated: boolean; evidences: Evidence[]; sectionErrors?: Partial<Record<'offers'|'bookings'|'cleanup'|'evidence',string>>; detailBase?: string }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  // Command failures render as alerts, not in the success-styled status banner.
  const [messageFailed, setMessageFailed] = useState(false)
  const [working, setWorking] = useState<string | null>(null)
  const activeTasks = useRef(new Set<string>())
  const [pending, setPending] = useState<string[]>([])
  function beginTask(id: string) {
    if (activeTasks.current.has(id)) return false
    activeTasks.current.add(id)
    setPending([...activeTasks.current])
    return true
  }
  function endTask(id: string) {
    activeTasks.current.delete(id)
    setPending([...activeTasks.current])
    setWorking(current => activeTasks.current.size ? current : null)
  }
  function remainingRefund(booking: Booking) {
    if (!booking.payments || booking.paymentsCount !== booking.payments.length || booking.payments.length > 100 || booking.payments.some(payment => payment.currencyCode !== booking.currencyCode || !Number.isSafeInteger(payment.capturedAmount) || !Number.isSafeInteger(payment.refundedAmount))) return null
    const amount = booking.payments.reduce((sum,payment) => sum + payment.capturedAmount - payment.refundedAmount,0)
    return Number.isSafeInteger(amount) && amount >= 0 ? amount : null
  }
  const [originalBookingCommand, setOriginalBookingCommand] = useState<{ offer: string; passengers: string[]; key: string } | null>(null)
  const [originalCommandUnavailable, setOriginalCommandUnavailable] = useState(false)
  const commandStorageKey = 'airline:operator:original-booking-command'
  useEffect(() => {
    try {
      const value = sessionStorage.getItem(commandStorageKey)
      if (!value) return
      const parsed = JSON.parse(value)
      if (!parsed || typeof parsed.offer !== 'string' || !Array.isArray(parsed.passengers) || typeof parsed.key !== 'string') throw new Error('Invalid original command')
      setOriginalBookingCommand(parsed)
    } catch { setOriginalCommandUnavailable(true); setMessageFailed(true); setMessage('Saved original booking command is unavailable. Reconcile it before accepting a replacement offer.') }
  }, [])
  const [captureReferences, setCaptureReferences] = useState<Record<string, string>>({})
  const [refundReferences, setRefundReferences] = useState<Record<string, string>>({})
  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({})
  const [refundReasons, setRefundReasons] = useState<Record<string, string>>({})
  const [evidenceSources, setEvidenceSources] = useState<Record<string, string>>({})
  const [evidenceDigests, setEvidenceDigests] = useState<Record<string, string>>({})
  const [evidencePurposes, setEvidencePurposes] = useState<Record<string, string>>({})
  const [cancellationReasons, setCancellationReasons] = useState<Record<string, string>>({})
  const [evidenceRejectionReasons, setEvidenceRejectionReasons] = useState<Record<string, string>>({})
  const refundAmountValue = (booking: Booking) => refundAmounts[booking.id] ?? ''
  async function submitEvidence(booking: Booking) {
    const aggregate = booking.id
    if (!beginTask(aggregate)) return
    setWorking(`evidence:${booking.id}`); setMessageFailed(false); setMessage('')
    try {
      const purpose = evidencePurposes[booking.id] ?? 'capture'
      const reference = (purpose === 'capture' ? captureReferences : refundReferences)[booking.id]?.trim()
      const source = evidenceSources[booking.id]?.trim(); const digest = evidenceDigests[booking.id]?.trim()
      const amount = purpose === 'capture' ? booking.totalAmount : decimalToMinorUnits(refundAmountValue(booking), booking.currencyCode)
      if (!reference || !source || !digest || !amount) throw new Error('Imported ledger reference, source, SHA-256 digest, and amount are required.')
      await mutate(`mutation($booking:ID!,$purpose:String!,$reference:String!,$source:String!,$digest:String!,$amount:Int!,$currency:String!,$key:String!){submitManualPaymentEvidence(bookingId:$booking,purpose:$purpose,externalReference:$reference,ledgerSource:$source,evidenceDigest:$digest,amount:$amount,currencyCode:$currency,idempotencyKey:$key){status}}`, { booking: booking.id, purpose, reference, source, digest, amount, currency: booking.currencyCode, key: `evidence-${crypto.randomUUID()}` })
      setMessage(`Evidence submitted for ${booking.recordLocator}. A different authorized user must approve it.`); router.refresh()
    } catch (error) { setMessageFailed(true); setMessage(error instanceof Error ? error.message : 'Evidence could not be submitted.') }
    endTask(aggregate)
  }
  async function approveEvidence(evidence: Evidence) {
    const aggregate = evidence.booking?.id ?? evidence.id
    if (!beginTask(aggregate)) return
    setWorking(`approve:${evidence.id}`); setMessageFailed(false); setMessage('')
    try { await mutate(`mutation($id:ID!,$key:String!){approveManualPaymentEvidence(evidenceId:$id,idempotencyKey:$key){status}}`, { id: evidence.id, key: `evidence-approve-${crypto.randomUUID()}` }); setMessage(`Evidence ${evidence.externalReference} approved.`); router.refresh() }
    catch (error) { setMessageFailed(true); setMessage(error instanceof Error ? error.message : 'Evidence approval failed.') }
    endTask(aggregate)
  }
  async function rejectEvidence(evidence: Evidence) {
    if (!window.confirm(`Reject this settlement evidence for ${evidence.booking?.recordLocator ?? 'this booking'}? It cannot be approved afterwards.`)) return
    const aggregate = evidence.booking?.id ?? evidence.id
    if (!beginTask(aggregate)) return
    setWorking(`reject:${evidence.id}`); setMessageFailed(false); setMessage('')
    try { const reason = evidenceRejectionReasons[evidence.id]?.trim(); if (!reason) throw new Error('A rejection reason is required.'); await mutate(`mutation($id:ID!,$reason:String!,$key:String!){rejectManualPaymentEvidence(evidenceId:$id,reason:$reason,idempotencyKey:$key){status}}`, { id: evidence.id, reason, key: `evidence-reject-${evidence.id}` }); setMessage(`Evidence ${evidence.externalReference} rejected; it cannot be reused.`); router.refresh() }
    catch (error) { setMessageFailed(true); setMessage(error instanceof Error ? error.message : 'Evidence rejection failed.') }
    endTask(aggregate)
  }
  async function accept(offer?: Offer, recoverOnly = false) {
    if (originalCommandUnavailable || (!offer && !originalBookingCommand)) return
    setWorking(offer?.id ?? 'original-booking'); setMessageFailed(false); setMessage('')
    try {
      if (originalBookingCommand && offer && originalBookingCommand.offer !== offer.id) throw new Error('Resolve the original command before accepting a different offer.')
      const command = originalBookingCommand ?? { offer: offer!.id, passengers: offer!.passengers.map(passenger => passenger.id), key: `booking-${crypto.randomUUID()}` }
      sessionStorage.setItem(commandStorageKey, JSON.stringify(command)); setOriginalBookingCommand(command)
      const accepted = await mutate(`mutation($offer: ID!, $passengers: [ID!]!, $key: String!, $recover: Boolean) { createBookingFromOffer(offerId: $offer, passengerIds: $passengers, idempotencyKey: $key, recoverOnly: $recover) { bookingId recordLocator status bookingReceipt } }`, { ...command, recover: recoverOnly })
      const result = accepted.createBookingFromOffer
      sessionStorage.removeItem(commandStorageKey); setOriginalBookingCommand(null)
      setMessage(`Reservation ${result.recordLocator} acknowledged. Current status ${result.status}; payment ${result.bookingReceipt.current.paymentStatus}, internal documents ${result.bookingReceipt.current.ticketingStatus}. Open the booking detail for accepted terms and current controlled commands.`); router.refresh()
    } catch (error) { setMessageFailed(true); setMessage(`${error instanceof Error ? error.message : 'Booking acknowledgement unavailable.'} Preserve the original command/key; a lost response or expired offer is not proof of rollback.`) }
    setWorking(null)
  }
  async function capture(booking: Booking) {
    const aggregate = booking.id
    if (!beginTask(aggregate)) return
    setWorking(booking.id); setMessageFailed(false); setMessage('')
    try {
      const providerReference = captureReferences[booking.id]?.trim()
      if (!providerReference) throw new Error('An approved provider settlement reference is required.')
      await mutate(`mutation($id: ID!, $key: String!, $reference: String!) { captureBookingPayment(bookingId: $id, idempotencyKey: $key, providerReference: $reference) { status } }`, { id: booking.id, reference: providerReference, key: `payment-${crypto.randomUUID()}` })
      setMessage(`Externally settled payment recorded for ${booking.recordLocator}; this system did not initiate payment.`); router.refresh()
    } catch (error) { setMessageFailed(true); setMessage(error instanceof Error ? error.message : 'Payment failed.') }
    endTask(aggregate)
  }
  async function issue(booking: Booking) {
    const aggregate = booking.id
    if (!beginTask(aggregate)) return
    setWorking(booking.id); setMessageFailed(false); setMessage('')
    try {
      await mutate(`mutation($id: ID!, $key: String!) { issueBookingTickets(bookingId: $id, idempotencyKey: $key) { status } }`, { id: booking.id, key: `ticket-${crypto.randomUUID()}` })
      setMessage(`Internal ticket record issued for ${booking.recordLocator}. Use Departure control for passenger service; external carrier issuance is not implied.`); router.refresh()
    } catch (error) { setMessageFailed(true); setMessage(error instanceof Error ? error.message : 'Ticketing failed.') }
    endTask(aggregate)
  }
  async function cancel(booking: Booking) {
    if (!window.confirm(`Cancel booking ${booking.recordLocator} and release its inventory? This cannot be undone.`)) return
    const aggregate = booking.id
    if (!beginTask(aggregate)) return
    setWorking(booking.id); setMessageFailed(false); setMessage('')
    try {
      const reason = cancellationReasons[booking.id]?.trim()
      if (!reason) throw new Error('A cancellation reason is required.')
      await mutate(`mutation($id:ID!,$reason:String!,$key:String!){cancelBooking(bookingId:$id,reason:$reason,idempotencyKey:$key){status}}`, { id: booking.id, reason, key: `cancel-${crypto.randomUUID()}` })
      setMessage(`Booking ${booking.recordLocator} cancelled and inventory released.`); router.refresh()
    } catch (error) { setMessageFailed(true); setMessage(error instanceof Error ? error.message : 'Cancellation failed.') }
    endTask(aggregate)
  }
  async function refund(booking: Booking) {
    const aggregate = booking.id
    if (!beginTask(aggregate)) return
    setWorking(booking.id); setMessageFailed(false); setMessage('')
    try {
      const amountText = refundAmountValue(booking).trim()
      const providerReference = refundReferences[booking.id]?.trim()
      const reason = refundReasons[booking.id]?.trim()
      if (!amountText || !providerReference || !reason) throw new Error('Refund amount, settlement reference, and reason are required.')
      const amount = decimalToMinorUnits(amountText, booking.currencyCode)
      const remaining = remainingRefund(booking)
      if (amount <= 0 || remaining === null || amount > remaining) throw new Error('Enter a positive amount within the currently refundable balance. Reload if the balance is unavailable.')
      if (!window.confirm(`Record an externally evidenced refund of ${formatMinorUnits(amount, booking.currencyCode)} for ${booking.recordLocator}? Remaining balance: ${formatMinorUnits(remaining, booking.currencyCode)}.`)) return
      await mutate(`mutation($id: ID!, $amount: Int!, $reason: String!, $reference: String!, $key: String!) { processBookingRefund(bookingId: $id, amount: $amount, reason: $reason, providerReference: $reference, idempotencyKey: $key) { status } }`, { id: booking.id, amount, reason, reference: providerReference, key: `refund-${crypto.randomUUID()}` })
      setMessage(`Externally evidenced refund recorded for ${booking.recordLocator}; no provider-side refund was initiated here.`); router.refresh()
    } catch (error) { setMessageFailed(true); setMessage(error instanceof Error ? error.message : 'Refund failed.') }
    finally { endTask(aggregate) }
  }
  return <div className="space-y-8">
    {Object.entries(sectionErrors).map(([section,error]) => <p key={section} role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm">{section === 'cleanup' ? 'Refund follow-up' : section}: {error}</p>)}
    {message && <p role={messageFailed ? 'alert' : 'status'} className={`rounded-lg px-3 py-2 text-sm ${messageFailed ? 'bg-destructive/10 text-destructive' : 'bg-primary/10'}`}>{message}</p>}
    {originalBookingCommand && <section aria-label="Original operator booking command recovery" className="space-y-2 rounded-xl border border-amber-500/40 p-4 text-sm"><p>Original booking acknowledgement pending. Recovery uses the saved command and checks current operator/carrier authority; it does not create a booking.</p><div className="flex flex-wrap gap-2"><button disabled={Boolean(working)} onClick={() => accept(undefined, true)} className="rounded-lg border px-3 py-2">Recover original receipt</button><button disabled={Boolean(working)} onClick={() => accept()} className="rounded-lg border px-3 py-2">Retry same command</button></div></section>}
    {!sectionErrors.offers && <section><h2 className="mb-3 text-lg font-semibold">Held offers</h2><div className="space-y-3">{offers.filter(offer => ['held', 'available'].includes(offer.status)).map(offer => <article key={offer.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{offer.offerNumber}</p><p className="text-sm text-muted-foreground">{offer.passengers.map(passenger => `${passenger.givenName} ${passenger.familyName}`).join(', ')} · {formatMinorUnits(offer.totalAmount, offer.currencyCode)}</p></div><button disabled={Boolean(working) || originalCommandUnavailable || Boolean(originalBookingCommand && originalBookingCommand.offer !== offer.id)} onClick={() => accept(offer)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{working === offer.id ? 'Working…' : 'Accept & create booking'}</button></article>)}{!offers.some(offer => ['held', 'available'].includes(offer.status)) && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No held offers to accept. Hold a fare from <Link href="/dashboard/platform/offers" className="font-medium underline">Offers</Link>.</p>}</div></section>}
    {!sectionErrors.cleanup && <section aria-labelledby="booking-refund-cleanup-heading" className="rounded-2xl border border-amber-500/40 bg-card p-4 sm:p-5"><h2 id="booking-refund-cleanup-heading" className="text-lg font-semibold">Refund / void follow-up · read-only projection</h2><p className="mt-1 max-w-4xl text-sm text-muted-foreground">Carrier-scoped booking managers can locate refunded or voided records here, including bookings already marked cancelled. This is derived from persisted state, not a separate cleanup-intent record. Segment history is visible here; station-scoped artifact detail is shown only to authorized station roles. Neither booking cancellation nor ticket status proves settlement, ticket-provider invalidation, passenger disposition, or baggage disposition. Locator search can resume the existing authorized cancellation workflow, which rechecks its blockers.</p>{refundCleanupBookings.length ? <div className="mt-4 space-y-3">{refundCleanupBookings.map(booking => <article key={booking.id} className="rounded-xl border bg-background p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{booking.recordLocator} · {booking.status}</p><p className="text-sm text-muted-foreground">Payment {booking.paymentStatus} · ticketing {booking.ticketingStatus} · updated {new Date(booking.updatedAt).toLocaleString()}</p></div><span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs">{booking.status === 'cancelled' ? 'Already cancelled · inspect residual state' : 'Refund/void marked · review cancellation'}</span></div><p className="mt-3 text-xs text-muted-foreground">Segments: {booking.segmentsCount}. Passenger-service artifact detail is left to the station-scoped projection and the existing cancellation guards; this booking list does not infer their disposition.</p>{booking.segments.length ? <ul className="mt-2 flex flex-wrap gap-2">{booking.segments.map(segment => <li key={segment.id} className="rounded-md bg-muted px-2 py-1 text-xs">{segment.sequence}. {segment.originCode} → {segment.destinationCode} · {segment.status}</li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">No segments returned.</p>}{booking.segmentsCount > booking.segments.length && <p className="mt-2 text-xs text-muted-foreground">Showing {booking.segments.length} of {booking.segmentsCount} segments.</p>}<Link href={`${detailBase}?locator=${encodeURIComponent(booking.recordLocator)}`} className="mt-3 inline-flex rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open locator in existing Booking Desk</Link></article>)}</div> : <p className="mt-4 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No carrier-scoped booking currently has a refunded payment marker or voided ticketing marker.</p>}{refundCleanupTruncated && <p className="mt-3 text-xs text-muted-foreground">Showing the first 100 matching bookings; more exist. Use the locator search above to retrieve a specific record.</p>}</section>}
    {!sectionErrors.evidence && <section><h2 className="mb-3 text-lg font-semibold">Settlement evidence approval</h2><div className="space-y-3">{evidences.filter(evidence => evidence.status === 'submitted').map(evidence => <article key={evidence.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{evidence.booking?.recordLocator ?? 'Booking unavailable under current access'} · {evidence.purpose} · {evidence.externalReference}</p><p className="text-sm text-muted-foreground">{formatMinorUnits(evidence.amount, evidence.currencyCode)} · imported from {evidence.ledgerSource} · submitted by {evidence.submittedBy?.name ?? 'an operator not visible under current access'}</p></div><div className="flex flex-wrap gap-2"><button disabled={pending.includes(evidence.booking?.id ?? evidence.id)} onClick={() => approveEvidence(evidence)} className="rounded-lg border px-3 py-2 text-sm">Approve as second user</button><input aria-label={`Rejection reason for evidence ${evidence.externalReference}`} value={evidenceRejectionReasons[evidence.id] ?? ''} onChange={event => setEvidenceRejectionReasons(values => ({ ...values, [evidence.id]: event.target.value }))} placeholder="Rejection reason" className="rounded-lg border px-3 py-2 text-sm" /><button disabled={pending.includes(evidence.booking?.id ?? evidence.id) || !evidenceRejectionReasons[evidence.id]?.trim()} onClick={() => rejectEvidence(evidence)} className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive disabled:opacity-50">Reject</button></div></article>)}{!evidences.some(evidence => evidence.status === 'submitted') && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No evidence awaits approval.</p>}</div></section>}
    {!sectionErrors.bookings && <section><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Recent bookings</h2><p className="text-sm text-muted-foreground">Showing {bookings.length} on this page · {bookingCount} matching bookings total.</p></div>{bookingHasNextPage && bookingNextHref && <Link href={bookingNextHref} className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Next 50 bookings →</Link>}</div><div className="space-y-3">{bookings.map(booking => <article key={booking.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"><div><Link href={`${detailBase}/${booking.id}`} className="font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{booking.recordLocator} · {booking.status}</Link><p className="text-sm text-muted-foreground">Payment: {booking.paymentStatus} · Ticketing: {booking.ticketingStatus} · {formatMinorUnits(booking.totalAmount, booking.currencyCode)}</p>{booking.paymentStatus === 'unpaid' && booking.metadata?.paymentDueAt && <p className="text-xs text-amber-700 dark:text-amber-300">Payment evidence due {new Date(booking.metadata.paymentDueAt).toLocaleString()}; overdue reservations expire automatically.</p>}</div><div className="flex flex-wrap items-center gap-2"><select aria-label={`Evidence purpose for ${booking.recordLocator}`} value={evidencePurposes[booking.id] ?? 'capture'} onChange={event => setEvidencePurposes(values => ({ ...values, [booking.id]: event.target.value }))} className="rounded-lg border px-2 py-2 text-sm"><option value="capture">Capture evidence</option><option value="refund">Refund evidence</option></select><input aria-label={`Ledger source for ${booking.recordLocator}`} value={evidenceSources[booking.id] ?? ''} onChange={event => setEvidenceSources(values => ({ ...values, [booking.id]: event.target.value }))} placeholder="Imported ledger source" className="rounded-lg border px-3 py-2 text-sm" /><input aria-label={`Evidence digest for ${booking.recordLocator}`} value={evidenceDigests[booking.id] ?? ''} onChange={event => setEvidenceDigests(values => ({ ...values, [booking.id]: event.target.value }))} placeholder="SHA-256 digest" className="max-w-48 rounded-lg border px-3 py-2 text-sm" /><button disabled={pending.includes(booking.id)} onClick={() => submitEvidence(booking)} className="rounded-lg border px-3 py-2 text-sm">Submit imported evidence</button>{['unpaid', 'failed'].includes(booking.paymentStatus) && <><input aria-label={`Approved settlement reference for ${booking.recordLocator}`} value={captureReferences[booking.id] ?? ''} onChange={event => setCaptureReferences(values => ({ ...values, [booking.id]: event.target.value }))} placeholder="Approved settlement reference" className="rounded-lg border px-3 py-2 text-sm" /><button disabled={pending.includes(booking.id)} onClick={() => capture(booking)} className="rounded-lg border px-3 py-2 text-sm">Record payment</button></>}{booking.status === 'confirmed' && booking.paymentStatus === 'paid' && booking.ticketingStatus === 'not_ticketed' && <button disabled={pending.includes(booking.id)} onClick={() => issue(booking)} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Issue ticket</button>}{['paid', 'partially_refunded'].includes(booking.paymentStatus) && <><input aria-label={`Refund amount in ${booking.currencyCode} for ${booking.recordLocator}`} placeholder={`${booking.currencyCode} amount`} inputMode="decimal" value={refundAmountValue(booking)} onChange={event => setRefundAmounts(values => ({ ...values, [booking.id]: event.target.value }))} className="w-28 rounded-lg border px-3 py-2 text-sm" /><input aria-label={`Approved refund reference for ${booking.recordLocator}`} value={refundReferences[booking.id] ?? ''} onChange={event => setRefundReferences(values => ({ ...values, [booking.id]: event.target.value }))} placeholder="Approved refund reference" className="rounded-lg border px-3 py-2 text-sm" /><select aria-label={`Refund reason for ${booking.recordLocator}`} value={refundReasons[booking.id] ?? ''} onChange={event => setRefundReasons(values => ({ ...values, [booking.id]: event.target.value }))} className="rounded-lg border px-3 py-2 text-sm"><option value="">Select refund reason</option><option value="customer_request">Customer request</option><option value="disruption">Disruption</option><option value="schedule_change">Schedule change</option><option value="duplicate">Duplicate</option><option value="fraud">Fraud</option><option value="other">Other</option></select><button disabled={pending.includes(booking.id) || !refundReasons[booking.id]?.trim()} onClick={() => refund(booking)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Record refund</button><span className="text-xs text-muted-foreground">Remaining {formatMinorUnits(remainingRefund(booking), booking.currencyCode)}</span></>}{!['cancelled', 'completed'].includes(booking.status) && ['unpaid', 'failed', 'refunded'].includes(booking.paymentStatus) && <><input aria-label={`Cancellation reason for ${booking.recordLocator}`} value={cancellationReasons[booking.id] ?? ''} onChange={event => setCancellationReasons(values => ({ ...values, [booking.id]: event.target.value }))} placeholder="Cancellation reason" className="rounded-lg border px-3 py-2 text-sm" /><button disabled={pending.includes(booking.id) || !cancellationReasons[booking.id]?.trim()} onClick={() => cancel(booking)} className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive disabled:opacity-50">Cancel & release</button></>}</div></article>)}{!bookings.length && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No bookings yet.</p>}</div></section>}
  </div>
}
