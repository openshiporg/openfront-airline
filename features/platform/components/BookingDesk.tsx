'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { decimalToMinorUnits, formatMinorUnits } from '@/features/keystone/lib/money'
import { cn } from '@/lib/utils'
import { formatAirportTime } from '@/features/airline/lib/time'
import { Code, DeskSection, Notice, Panel, Pill, Route, StatusDot, StatusLabel, TitleLine, Track, Well, deskInput, statusTone } from '@/features/platform/components/desk'

import type { Offer, Booking, RefundCleanupBooking, Evidence } from '@/features/airline/lib/operator-bookings'

/** Lifecycle field with its label and dot, for the title line. */
function StateLabel({ label, status }: { label: string; status?: string | null }) {
  return <span className="inline-flex items-baseline gap-1 whitespace-nowrap text-xs text-muted-foreground">{label}<StatusLabel status={status} className="text-foreground" /></span>
}

/** One command group in a booking row: label on the left, fields and pills on the right. */
function CommandRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid min-w-0 gap-1.5 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-center sm:gap-3">
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
  </div>
}

const rowInput = cn(deskInput, 'sm:w-auto sm:min-w-40 sm:flex-1')

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
  const [receivedMethods, setReceivedMethods] = useState<Record<string, string>>({})
  const [receivedReferences, setReceivedReferences] = useState<Record<string, string>>({})
  const [receivedAt, setReceivedAt] = useState<Record<string, string>>({})
  const [evidencePurposes, setEvidencePurposes] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<string[]>([])
  const [issuedAccess, setIssuedAccess] = useState<{ recordLocator: string; accessToken: string } | null>(null)
  const [cancellationReasons, setCancellationReasons] = useState<Record<string, string>>({})
  const [evidenceRejectionReasons, setEvidenceRejectionReasons] = useState<Record<string, string>>({})
  const refundAmountValue = (booking: Booking) => refundAmounts[booking.id] ?? ''
  // Maker step: records money received (or a refund sent) outside the website, then a different operator approves.
  async function recordReceived(booking: Booking) {
    const aggregate = booking.id
    if (!beginTask(aggregate)) return
    setWorking(`evidence:${booking.id}`); setMessageFailed(false); setMessage('')
    try {
      const purpose = evidencePurposes[booking.id] ?? (['paid', 'partially_refunded'].includes(booking.paymentStatus) ? 'refund' : 'capture')
      const reference = receivedReferences[booking.id]?.trim()
      const method = receivedMethods[booking.id] ?? 'bank_transfer'
      const amount = purpose === 'capture' ? booking.totalAmount : decimalToMinorUnits(refundAmountValue(booking), booking.currencyCode)
      if (!reference) throw new Error('Enter the bank, terminal or receipt reference.')
      if (!amount) throw new Error('Enter the refund amount.')
      const when = receivedAt[booking.id] ? new Date(receivedAt[booking.id]).toISOString() : new Date().toISOString()
      await mutate(`mutation($booking:ID!,$purpose:String!,$method:String!,$reference:String!,$amount:Int!,$at:String!,$key:String!){recordReceivedPayment(bookingId:$booking,purpose:$purpose,method:$method,externalReference:$reference,amount:$amount,receivedAt:$at,idempotencyKey:$key){status}}`, { booking: booking.id, purpose, method, reference, amount, at: when, key: `received-${crypto.randomUUID()}` })
      if (purpose === 'capture') setCaptureReferences(values => ({ ...values, [booking.id]: reference }))
      else setRefundReferences(values => ({ ...values, [booking.id]: reference }))
      setMessage(`${purpose === 'capture' ? 'Payment' : 'Refund'} recorded for ${booking.recordLocator}. Another payment operator approves it under Settlement approval.`); router.refresh()
    } catch (error) { setMessageFailed(true); setMessage(error instanceof Error ? error.message : 'Payment could not be recorded.') }
    endTask(aggregate)
  }
  async function reissueAccess(booking: Booking) {
    if (!window.confirm(`Issue a new access code for ${booking.recordLocator}? The customer's current code stops working.`)) return
    const aggregate = booking.id
    if (!beginTask(aggregate)) return
    setMessageFailed(false); setMessage('')
    try {
      const response = await fetch('/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify({ query: 'mutation($id:ID!){reissueBookingAccessCode(bookingId:$id){recordLocator accessToken}}', variables: { id: booking.id } }) })
      const body = await response.json() as { data?: { reissueBookingAccessCode?: { recordLocator: string; accessToken: string } }; errors?: Array<{ message: string }> }
      if (!body.data?.reissueBookingAccessCode) throw new Error(body.errors?.[0]?.message ?? 'A new access code could not be issued.')
      setIssuedAccess(body.data.reissueBookingAccessCode)
    } catch (error) { setMessageFailed(true); setMessage(error instanceof Error ? error.message : 'A new access code could not be issued.') }
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
      const providerReference = (booking.approvedEvidence?.find(evidence => evidence.purpose === 'capture')?.externalReference ?? captureReferences[booking.id])?.trim()
      if (!providerReference) throw new Error('Record the payment and have another operator approve it first.')
      await mutate(`mutation($id: ID!, $key: String!, $reference: String!) { captureBookingPayment(bookingId: $id, idempotencyKey: $key, providerReference: $reference) { status } }`, { id: booking.id, reference: providerReference, key: `payment-${crypto.randomUUID()}` })
      setMessage(`${booking.recordLocator} is paid. Issue the ticket next.`); router.refresh()
    } catch (error) { setMessageFailed(true); setMessage(error instanceof Error ? error.message : 'Payment failed.') }
    endTask(aggregate)
  }
  async function issue(booking: Booking) {
    const aggregate = booking.id
    if (!beginTask(aggregate)) return
    setWorking(booking.id); setMessageFailed(false); setMessage('')
    try {
      await mutate(`mutation($id: ID!, $key: String!) { issueBookingTickets(bookingId: $id, idempotencyKey: $key) { status } }`, { id: booking.id, key: `ticket-${crypto.randomUUID()}` })
      setMessage(`Tickets issued for ${booking.recordLocator}. Seats and check-in are now open.`); router.refresh()
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
  const heldOffers = offers.filter(offer => ['held', 'available'].includes(offer.status))
  const awaitingEvidence = evidences.filter(evidence => evidence.status === 'submitted')
  return <div className="space-y-8">
    {Object.entries(sectionErrors).map(([section,error]) => <Notice key={section} tone="bad" role="alert"><span className="font-medium capitalize">{section === 'cleanup' ? 'Refund follow-up' : section}</span>: {error}</Notice>)}
    {message && <Notice tone={messageFailed ? 'bad' : 'ok'} role={messageFailed ? 'alert' : 'status'}>{message}</Notice>}
    {issuedAccess && <Notice tone="warn" role="status"><span className="font-medium">New access code for <Code className="text-foreground">{issuedAccess.recordLocator}</Code>. Shown once.</span><span className="mt-2 flex flex-wrap items-center gap-2"><code className="max-w-full break-all rounded-[3px] bg-background px-2 py-1 tabular-nums text-xs">{issuedAccess.accessToken}</code><Track><Pill size="sm" onClick={() => navigator.clipboard.writeText(issuedAccess.accessToken).then(() => setMessage('Access code copied.'), () => undefined)}>Copy</Pill><Pill size="sm" onClick={() => setIssuedAccess(null)}>Done</Pill></Track></span></Notice>}
    {originalBookingCommand && <section aria-label="Original operator booking command recovery" className="flex min-w-0 flex-col gap-3 rounded-[4px] border border-amber-500/40 bg-amber-500/5 p-3 sm:flex-row sm:items-center sm:justify-between">
      <TitleLine as="p" tone="warn" className="text-sm font-medium text-foreground">Booking acknowledgement pending</TitleLine>
      <Track><Pill disabled={Boolean(working)} onClick={() => accept(undefined, true)}>Recover receipt</Pill><Pill variant="primary" disabled={Boolean(working)} onClick={() => accept()}>Retry same command</Pill></Track>
    </section>}

    {!sectionErrors.evidence && <DeskSection title="Settlement approval" count={awaitingEvidence.length}>
      {awaitingEvidence.length ? <Panel className="divide-y">{awaitingEvidence.map(evidence => <article key={evidence.id} className="flex min-w-0 flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <TitleLine as="h3" tone={statusTone(evidence.status)} status={evidence.status}>{evidence.booking?.recordLocator ? <Code className="text-lg font-semibold tracking-wide text-foreground">{evidence.booking.recordLocator}</Code> : <span className="text-sm font-medium text-muted-foreground">Booking restricted</span>}</TitleLine>
            <span className="text-xs font-medium capitalize text-muted-foreground">{evidence.purpose}</span>
            <Code>{evidence.externalReference}</Code>
          </div>
          <p className="flex min-w-0 flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground"><span className="tabular-nums text-sm font-medium  text-foreground">{formatMinorUnits(evidence.amount, evidence.currencyCode)}</span><span>Received by {evidence.ledgerSource.replace(/^operator:/, 'operator · ').replaceAll('_', ' ')}</span><span>Maker {evidence.submittedBy?.name ?? 'restricted'}</span></p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <input aria-label={`Rejection reason for evidence ${evidence.externalReference}`} value={evidenceRejectionReasons[evidence.id] ?? ''} onChange={event => setEvidenceRejectionReasons(values => ({ ...values, [evidence.id]: event.target.value }))} placeholder="Rejection reason" className={cn(deskInput, 'sm:w-48')} />
          <Track>
            <Pill variant="danger" disabled={pending.includes(evidence.booking?.id ?? evidence.id) || !evidenceRejectionReasons[evidence.id]?.trim()} onClick={() => rejectEvidence(evidence)}>Reject</Pill>
            <Pill variant="primary" disabled={pending.includes(evidence.booking?.id ?? evidence.id)} onClick={() => approveEvidence(evidence)}>Approve</Pill>
          </Track>
        </div>
      </article>)}</Panel> : <Well>No evidence awaiting approval</Well>}
    </DeskSection>}

    {!sectionErrors.bookings && <DeskSection title="Bookings" count={bookingCount} actions={<div className="flex items-center gap-3"><span className="text-xs tabular-nums text-muted-foreground">{bookings.length} on page</span>{bookingHasNextPage && bookingNextHref && <Pill asChild size="sm"><Link href={bookingNextHref}>Next 50<ChevronRight /></Link></Pill>}</div>}>
      {bookings.length ? <div className="min-w-0 rounded-[4px] border">
        <div aria-hidden="true" className="hidden grid-cols-[6.5rem_minmax(9rem,1fr)_minmax(13rem,1.4fr)_9rem_6.5rem_7.5rem] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground lg:grid">
          <span>Locator</span><span>Travelers</span><span>Itinerary</span><span>State</span><span className="text-right">Total</span><span />
        </div>
        <ul className="divide-y">{bookings.map(booking => {
          const open = expanded.includes(booking.id)
          const nextAction = booking.status === 'confirmed' && booking.paymentStatus === 'paid' && booking.ticketingStatus === 'not_ticketed' ? 'ticket' : ['unpaid', 'failed'].includes(booking.paymentStatus) && !['cancelled', 'completed'].includes(booking.status) ? 'payment' : null
          return <li key={booking.id} className={cn('min-w-0', open && 'bg-muted/20')}>
          <div className="grid min-w-0 gap-x-3 gap-y-1.5 px-3 py-2.5 text-sm lg:grid-cols-[6.5rem_minmax(9rem,1fr)_minmax(13rem,1.4fr)_9rem_6.5rem_7.5rem] lg:items-start">
            <TitleLine as="h3" tone={statusTone(booking.status)} status={booking.status}><Link href={`${detailBase}/${booking.id}`} className="rounded-sm text-base font-semibold uppercase tabular-nums tracking-[0.06em] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{booking.recordLocator}</Link></TitleLine>
            <div className="min-w-0">
              <p className="break-words font-medium text-foreground">{booking.passengers?.length ? booking.passengers.map(entry => `${entry.passenger?.givenName ?? ''} ${entry.passenger?.familyName ?? ''}`.trim() + (entry.passengerType && entry.passengerType !== 'adult' ? ` (${entry.passengerType === 'child' ? 'child' : 'infant'})` : '')).join(', ') : <span className="text-muted-foreground">Travelers restricted</span>}{(booking.passengersCount ?? 0) > (booking.passengers?.length ?? 0) ? ` +${(booking.passengersCount ?? 0) - (booking.passengers?.length ?? 0)}` : ''}</p>
              <p className="break-words text-xs text-muted-foreground">{[booking.contactEmail, booking.contactPhone].filter(Boolean).join(' · ') || 'No contact'}</p>
            </div>
            {booking.segments?.length ? <ul className="min-w-0 space-y-1">{booking.segments.map(segment => <li key={segment.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"><span className="w-12 font-semibold tabular-nums">{segment.marketingFlightNumber}</span><Route from={segment.originCode} to={segment.destinationCode} /><span className="tabular-nums text-muted-foreground">{formatAirportTime(segment.scheduledDepartureAt, 'UTC')}</span></li>)}</ul> : <span className="text-xs text-muted-foreground">No segments</span>}
            <div className="flex min-w-0 flex-col gap-0.5">
              <StatusLabel status={booking.status} />
              <StateLabel label="Pay" status={booking.paymentStatus} />
              <StateLabel label="Ticket" status={booking.ticketingStatus} />
              {booking.paymentStatus === 'unpaid' && booking.metadata?.paymentDueAt && <span className="text-xs text-amber-700 dark:text-amber-300">Pay by <span className="tabular-nums">{formatAirportTime(booking.metadata.paymentDueAt, 'UTC')}</span></span>}
            </div>
            <span className="font-semibold tabular-nums text-foreground lg:text-right">{formatMinorUnits(booking.totalAmount, booking.currencyCode)}</span>
            <div className="flex lg:justify-end">
              <Pill size="sm" variant="raised" aria-expanded={open} aria-controls={`booking-commands-${booking.id}`} onClick={() => setExpanded(values => values.includes(booking.id) ? values.filter(value => value !== booking.id) : [...values, booking.id])}>
                {open ? 'Close' : nextAction === 'ticket' ? 'Issue ticket' : nextAction === 'payment' ? 'Take payment' : 'Service'}<ChevronRight className={cn('transition-transform', open && 'rotate-90')} />
              </Pill>
            </div>
          </div>
          {open && <div id={`booking-commands-${booking.id}`} className="space-y-2.5 border-t border-dashed px-3 py-3 lg:pl-[calc(6.5rem+1.5rem)]">
          {booking.status === 'confirmed' && booking.paymentStatus === 'paid' && booking.ticketingStatus === 'not_ticketed' && <CommandRow label="Ticket"><Track><Pill variant="primary" disabled={pending.includes(booking.id)} onClick={() => issue(booking)}>Issue ticket</Pill></Track></CommandRow>}
          {!['cancelled', 'completed'].includes(booking.status) && ['unpaid', 'failed', 'paid', 'partially_refunded'].includes(booking.paymentStatus) && <CommandRow label="Received">
            <select aria-label={`Money movement for ${booking.recordLocator}`} value={evidencePurposes[booking.id] ?? (['paid', 'partially_refunded'].includes(booking.paymentStatus) ? 'refund' : 'capture')} onChange={event => setEvidencePurposes(values => ({ ...values, [booking.id]: event.target.value }))} className={cn(deskInput, 'sm:w-auto')}>{['unpaid', 'failed'].includes(booking.paymentStatus) && <option value="capture">Payment received</option>}{['paid', 'partially_refunded'].includes(booking.paymentStatus) && <option value="refund">Refund sent</option>}</select>
            <select aria-label={`Method for ${booking.recordLocator}`} value={receivedMethods[booking.id] ?? 'bank_transfer'} onChange={event => setReceivedMethods(values => ({ ...values, [booking.id]: event.target.value }))} className={cn(deskInput, 'sm:w-auto')}><option value="bank_transfer">Bank transfer</option><option value="card_terminal">Card terminal</option><option value="cash">Cash</option><option value="other">Other</option></select>
            <input aria-label={`Reference for ${booking.recordLocator}`} value={receivedReferences[booking.id] ?? ''} onChange={event => setReceivedReferences(values => ({ ...values, [booking.id]: event.target.value }))} placeholder="Bank or receipt reference" className={cn(rowInput, 'tabular-nums')} />
            <input aria-label={`Received at for ${booking.recordLocator}`} type="datetime-local" value={receivedAt[booking.id] ?? ''} onChange={event => setReceivedAt(values => ({ ...values, [booking.id]: event.target.value }))} className={cn(deskInput, 'sm:w-auto')} />
            {(evidencePurposes[booking.id] ?? (['paid', 'partially_refunded'].includes(booking.paymentStatus) ? 'refund' : 'capture')) === 'capture' && <span className="tabular-nums text-sm ">{formatMinorUnits(booking.totalAmount, booking.currencyCode)}</span>}
            <Track><Pill disabled={pending.includes(booking.id)} onClick={() => recordReceived(booking)}>Record</Pill></Track>
          </CommandRow>}
          {['unpaid', 'failed'].includes(booking.paymentStatus) && <CommandRow label="Payment">
            {booking.approvedEvidence?.some(evidence => evidence.purpose === 'capture')
              ? <span className="text-xs text-muted-foreground">Approved <Code className="text-foreground">{booking.approvedEvidence.find(evidence => evidence.purpose === 'capture')!.externalReference}</Code></span>
              : booking.approvedEvidence ? <span className="text-xs text-muted-foreground">Awaiting approval</span>
                : <input aria-label={`Approved settlement reference for ${booking.recordLocator}`} value={captureReferences[booking.id] ?? ''} onChange={event => setCaptureReferences(values => ({ ...values, [booking.id]: event.target.value }))} placeholder="Approved reference" className={cn(rowInput, 'tabular-nums')} />}
            <Track><Pill variant="primary" disabled={pending.includes(booking.id) || Boolean(booking.approvedEvidence && !booking.approvedEvidence.some(evidence => evidence.purpose === 'capture'))} onClick={() => capture(booking)}>Mark paid</Pill></Track>
          </CommandRow>}
          {['paid', 'partially_refunded'].includes(booking.paymentStatus) && <CommandRow label="Refund">
            <input aria-label={`Refund amount in ${booking.currencyCode} for ${booking.recordLocator}`} placeholder={`${booking.currencyCode} amount`} inputMode="decimal" value={refundAmountValue(booking)} onChange={event => setRefundAmounts(values => ({ ...values, [booking.id]: event.target.value }))} className={cn(deskInput, 'tabular-nums  sm:w-32')} />
            <input aria-label={`Approved refund reference for ${booking.recordLocator}`} value={refundReferences[booking.id] ?? ''} onChange={event => setRefundReferences(values => ({ ...values, [booking.id]: event.target.value }))} placeholder="Refund reference" className={cn(rowInput, 'tabular-nums')} />
            <select aria-label={`Refund reason for ${booking.recordLocator}`} value={refundReasons[booking.id] ?? ''} onChange={event => setRefundReasons(values => ({ ...values, [booking.id]: event.target.value }))} className={cn(deskInput, 'sm:w-auto')}><option value="">Refund reason</option><option value="customer_request">Customer request</option><option value="disruption">Disruption</option><option value="schedule_change">Schedule change</option><option value="duplicate">Duplicate</option><option value="fraud">Fraud</option><option value="other">Other</option></select>
            <Track><Pill disabled={pending.includes(booking.id) || !refundReasons[booking.id]?.trim()} onClick={() => refund(booking)}>Record refund</Pill></Track>
            <span className="text-xs text-muted-foreground">Remaining <span className="tabular-nums  text-foreground">{formatMinorUnits(remainingRefund(booking), booking.currencyCode)}</span></span>
          </CommandRow>}
          {!['cancelled', 'completed'].includes(booking.status) && <CommandRow label="Access"><Track><Pill size="sm" disabled={pending.includes(booking.id)} onClick={() => reissueAccess(booking)}>New access code</Pill></Track></CommandRow>}
          {!['cancelled', 'completed'].includes(booking.status) && ['unpaid', 'failed', 'refunded'].includes(booking.paymentStatus) && <CommandRow label="Cancel">
            <input aria-label={`Cancellation reason for ${booking.recordLocator}`} value={cancellationReasons[booking.id] ?? ''} onChange={event => setCancellationReasons(values => ({ ...values, [booking.id]: event.target.value }))} placeholder="Cancellation reason" className={rowInput} />
            <Track><Pill variant="danger" disabled={pending.includes(booking.id) || !cancellationReasons[booking.id]?.trim()} onClick={() => cancel(booking)}>Cancel & release</Pill></Track>
          </CommandRow>}
          </div>}
        </li>})}</ul>
      </div> : <Well>No bookings</Well>}
    </DeskSection>}

    {!sectionErrors.offers && <DeskSection title="Held offers" count={heldOffers.length}>
      {heldOffers.length ? <Panel className="divide-y">{heldOffers.map(offer => <article key={offer.id} className="flex min-w-0 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <TitleLine as="h3" tone={statusTone(offer.status)} status={offer.status}><Code className="text-base font-semibold text-foreground">{offer.offerNumber}</Code></TitleLine>
            <span className="tabular-nums text-sm font-medium  text-foreground">{formatMinorUnits(offer.totalAmount, offer.currencyCode)}</span>
          </div>
          <p className="break-words text-sm text-muted-foreground">{offer.passengers.map(passenger => `${passenger.givenName} ${passenger.familyName}`).join(', ')}</p>
        </div>
        <Track className="self-start sm:self-auto"><Pill variant="primary" disabled={Boolean(working) || originalCommandUnavailable || Boolean(originalBookingCommand && originalBookingCommand.offer !== offer.id)} onClick={() => accept(offer)}>{working === offer.id ? 'Working…' : 'Accept & book'}</Pill></Track>
      </article>)}</Panel> : <Well>No held offers. <Link href="/dashboard/platform/offers" className="font-medium text-foreground underline underline-offset-2">Offers</Link></Well>}
    </DeskSection>}

    {!sectionErrors.cleanup && <DeskSection id="booking-refund-cleanup-heading" title="Refund / void follow-up" count={refundCleanupBookings.length} actions={refundCleanupTruncated ? <span className="tabular-nums text-xs  text-muted-foreground">First 100</span> : undefined}>
      {refundCleanupBookings.length ? <Panel className="divide-y">{refundCleanupBookings.map(booking => <article key={booking.id} className="space-y-2.5 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <TitleLine as="h3" tone={statusTone(booking.status)} status={booking.status}><Code className="text-lg font-semibold tracking-wide text-foreground">{booking.recordLocator}</Code></TitleLine>
            <span className="text-xs font-medium capitalize text-foreground">{booking.status.replaceAll('_', ' ')}</span>
            <StateLabel label="Pay" status={booking.paymentStatus} />
            <StateLabel label="Ticket" status={booking.ticketingStatus} />
          </div>
          <span className="tabular-nums text-xs  text-muted-foreground">{formatAirportTime(booking.updatedAt, 'UTC')}</span>
        </div>
        <p className="text-xs font-medium text-muted-foreground">{booking.status === 'cancelled' ? 'Cancelled · residual state' : 'Refund/void marked · cancellation review'}</p>
        {booking.segments.length ? <ul className="flex min-w-0 flex-wrap gap-x-4 gap-y-1.5">{booking.segments.map(segment => <li key={segment.id} className="inline-flex items-baseline gap-2"><span className="tabular-nums text-xs  text-muted-foreground">{segment.sequence}</span><Route from={segment.originCode} to={segment.destinationCode} /><StatusLabel status={segment.status} /></li>)}</ul> : <p className="text-xs text-muted-foreground">No segments</p>}
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <span className="tabular-nums text-xs  text-muted-foreground">{booking.segmentsCount > booking.segments.length ? `${booking.segments.length} of ${booking.segmentsCount} segments` : `${booking.segmentsCount} segments`}</span>
          <Track><Pill asChild size="sm"><Link href={`${detailBase}?locator=${encodeURIComponent(booking.recordLocator)}`}>Open locator<ChevronRight /></Link></Pill></Track>
        </div>
      </article>)}</Panel> : <Well>No refunded or voided bookings</Well>}
    </DeskSection>}
  </div>
}
