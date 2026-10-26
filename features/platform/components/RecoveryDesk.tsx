'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ChevronRight, RotateCw } from 'lucide-react'

import {
  RECOVERY_AFFECTED_SEGMENT_PAGE_SIZE,
  RECOVERY_AFFECTED_SEGMENTS_QUERY,
  RECOVERY_DISRUPTION_PAGE_SIZE,
  RECOVERY_FLIGHT_PAGE_SIZE,
  currentRecoveryBookingChoices,
  recoveryAffectedSegmentPage,
  recoveryReplacementFlights,
  type RecoveryAffectedSegment,
  type RecoveryDisruptionOption,
  type RecoveryFlightOption,
} from '@/features/platform/lib/recovery-queue'
import { formatMinorUnits } from '@/features/keystone/lib/money'
import { cn } from '@/lib/utils'
import { Code, DeskSection, Field, Notice, Panel, Pill, Readout, ReadoutStrip, RowLink, TitleLine, Track, Well, deskInput, statusTone } from '@/features/platform/components/desk'

type AffectedPage = { items: RecoveryAffectedSegment[]; pageSize: number; totalCount: number; hasNextPage: boolean; nextCursor: string | null; disruptionStatus: string }

async function loadAffectedPage(disruptionId: string, cursor: string | null): Promise<AffectedPage> {
  const response = await fetch('/api/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      query: RECOVERY_AFFECTED_SEGMENTS_QUERY,
      variables: { disruptionId, cursor: cursor ? { id: cursor } : null, skip: cursor ? 1 : 0 },
    }),
  })
  const payload = await response.json() as {
    data?: { disruptions?: Array<{ status: string; affectedSegmentsCount: number; affectedSegments: RecoveryAffectedSegment[] }> }
    errors?: Array<{ message: string }>
  }
  if (!response.ok || payload.errors?.length || !payload.data) throw new Error(payload.errors?.[0]?.message ?? 'Could not load affected recovery segments.')
  const disruption = payload.data?.disruptions?.[0]
  if (!disruption) throw new Error('The selected disruption is no longer available in your authorized scope.')
  return { ...recoveryAffectedSegmentPage(disruption.affectedSegments ?? [], disruption.affectedSegmentsCount), disruptionStatus: disruption.status }
}

async function mutate(query: string, variables: Record<string, unknown>) {
  const response = await fetch('/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify({ query, variables }) })
  const payload = await response.json() as { data?: unknown; errors?: Array<{ message: string }> }
  if (!response.ok || payload.errors?.length || !payload.data) throw new Error(payload.errors?.[0]?.message ?? 'Operation failed.')
}

export function RecoveryDesk({
  flights,
  flightCount,
  flightHasNextPage,
  serviceNextHref,
  recoveryServicesFrom,
  disruptions,
  disruptionCount,
  disruptionHasNextPage,
  disruptionNextHref,
  detailBase = '/dashboard/recovery',
}: {
  flights: RecoveryFlightOption[]
  flightCount: number
  flightHasNextPage: boolean
  serviceNextHref: string | null
  recoveryServicesFrom: string
  disruptions: RecoveryDisruptionOption[]
  disruptionCount: number
  disruptionHasNextPage: boolean
  disruptionNextHref: string | null
  detailBase?: string
}) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  // Command failures render as alerts, not in the success-styled status banner.
  const [messageFailed, setMessageFailed] = useState(false)
  const [working, setWorking] = useState(false)
  const inFlight = useRef(false)
  const originalAttempt = useRef<{ operation: string; body: string; key: string } | null>(null)
  const [refreshRevision, setRefreshRevision] = useState(0)
  const [flightId, setFlightId] = useState(flights[0]?.id ?? '')
  const [replacementFlightId, setReplacementFlightId] = useState('')
  const [bucketId, setBucketId] = useState('')
  const [type, setType] = useState('delay')
  const [summary, setSummary] = useState('')
  const openDisruptions = disruptions.filter(item => ['published', 'recovering'].includes(item.status))
  const [disruptionId, setDisruptionId] = useState(openDisruptions[0]?.id ?? '')
  const [bookingId, setBookingId] = useState('')
  const [affectedSegments, setAffectedSegments] = useState<RecoveryAffectedSegment[]>([])
  const [affectedCount, setAffectedCount] = useState(0)
  const [affectedCursor, setAffectedCursor] = useState<string | null>(null)
  const [affectedHasNext, setAffectedHasNext] = useState(false)
  const [loadedDisruptionId, setLoadedDisruptionId] = useState('')
  const [loadingAffected, setLoadingAffected] = useState(false)
  const [affectedError, setAffectedError] = useState('')
  const requestGeneration = useRef(0)

  useEffect(() => {
    const generation = ++requestGeneration.current
    setAffectedSegments([])
    setAffectedCount(0)
    setAffectedCursor(null)
    setAffectedHasNext(false)
    setLoadedDisruptionId('')
    setAffectedError('')
    if (!disruptionId) return () => { if (requestGeneration.current === generation) requestGeneration.current++ }
    setLoadingAffected(true)
    void loadAffectedPage(disruptionId, null).then(page => {
      if (requestGeneration.current !== generation) return
      setAffectedSegments(page.items)
      setAffectedCount(page.totalCount)
      setAffectedCursor(page.nextCursor)
      setAffectedHasNext(page.hasNextPage)
      setLoadedDisruptionId(disruptionId)
      if (!['published', 'recovering'].includes(page.disruptionStatus)) setAffectedError('This disruption is no longer open for recovery; refresh the desk before proceeding.')
    }).catch(error => {
      if (requestGeneration.current === generation) setAffectedError(error instanceof Error ? error.message : 'Could not load affected recovery segments.')
    }).finally(() => {
      if (requestGeneration.current === generation) setLoadingAffected(false)
    })
    return () => { if (requestGeneration.current === generation) requestGeneration.current++ }
  }, [disruptionId, refreshRevision])

  const selectedDisruption = openDisruptions.find(item => item.id === disruptionId)
  const selectedPublishFlightId = flights.some(flight => flight.id === flightId) ? flightId : ''
  const bookingChoices = loadedDisruptionId === disruptionId ? currentRecoveryBookingChoices(affectedSegments) : []
  const selectedBookingId = bookingChoices.some(booking => booking.id === bookingId) ? bookingId : ''
  const replacementFlights = recoveryReplacementFlights(flights, selectedDisruption, recoveryServicesFrom)
  const selectedReplacementFlightId = replacementFlights.some(flight => flight.id === replacementFlightId) ? replacementFlightId : ''
  const selectedReplacementFlight = replacementFlights.find(flight => flight.id === selectedReplacementFlightId)
  const openBuckets = selectedReplacementFlight?.inventoryBuckets.filter(bucket => bucket.status === 'open' && bucket.authorized - bucket.sold - bucket.held - bucket.blocked > 0) ?? []
  const selectedBucketId = openBuckets.some(bucket => bucket.id === bucketId) ? bucketId : ''

  async function loadNextAffectedPage() {
    if (!disruptionId || !affectedCursor || loadingAffected) return
    const generation = requestGeneration.current
    setLoadingAffected(true)
    setAffectedError('')
    try {
      const page = await loadAffectedPage(disruptionId, affectedCursor)
      if (requestGeneration.current !== generation) return
      setAffectedSegments(current => {
        const seen = new Set(current.map(segment => segment.id))
        return [...current, ...page.items.filter(segment => !seen.has(segment.id))]
      })
      setAffectedCount(page.totalCount)
      setAffectedCursor(page.nextCursor)
      setAffectedHasNext(page.hasNextPage)
    } catch (error) {
      if (requestGeneration.current === generation) setAffectedError(error instanceof Error ? error.message : 'Could not load more affected recovery segments.')
    } finally {
      if (requestGeneration.current === generation) setLoadingAffected(false)
    }
  }

  function attempt(operation: string, variables: Record<string, string>) {
    const body = JSON.stringify(variables)
    if (originalAttempt.current && (originalAttempt.current.operation !== operation || originalAttempt.current.body !== body)) throw new Error('The previous request is still unconfirmed. Restore its selections and retry it before starting another operation.')
    originalAttempt.current ??= { operation, body, key: `${operation}-${crypto.randomUUID()}` }
    return { ...variables, key: originalAttempt.current.key }
  }

  async function publish() {
    if (inFlight.current || !selectedPublishFlightId) return
    if (!window.confirm('Publish this disruption? Affected booked segments are marked for recovery and the passenger-facing summary is shown immediately.')) return
    inFlight.current = true
    setWorking(true); setMessageFailed(false); setMessage('')
    try {
      await mutate(`mutation($flight: ID!, $type: String!, $summary: String!, $key: String!) { publishFlightDisruption(flightInstanceId: $flight, type: $type, publicSummary: $summary, idempotencyKey: $key) { status } }`, attempt('disruption', { flight: selectedPublishFlightId, type, summary }))
      setMessage('Disruption published and affected booked segments marked for recovery. Replacement options are loading.')
      originalAttempt.current = null
      setRefreshRevision(value => value + 1)
      router.refresh()
    } catch (error) { setMessageFailed(true); setMessage(error instanceof Error ? error.message : 'Could not publish disruption.') }
    inFlight.current = false
    setWorking(false)
  }

  async function reaccommodate() {
    if (inFlight.current || !selectedBookingId || !selectedReplacementFlightId || !selectedBucketId || affectedError) return
    if (!window.confirm('Confirm this replacement? Inventory is protected, the itinerary is updated, and eligible coupons are reissued.')) return
    inFlight.current = true
    setWorking(true); setMessageFailed(false); setMessage('')
    try {
      await mutate(`mutation($disruption: ID!, $booking: ID!, $flight: ID!, $bucket: ID!, $key: String!) { reaccommodateBooking(disruptionId: $disruption, bookingId: $booking, replacementFlightInstanceId: $flight, replacementInventoryBucketId: $bucket, idempotencyKey: $key) { status } }`, attempt('reaccommodation', { disruption: disruptionId, booking: selectedBookingId, flight: selectedReplacementFlightId, bucket: selectedBucketId }))
      setMessage('Replacement confirmed. Reloading affected bookings…')
      setBookingId('')
      setBucketId('')
      originalAttempt.current = null
      setRefreshRevision(value => value + 1)
      router.refresh()
    } catch (error) { setMessageFailed(true); setMessage(error instanceof Error ? error.message : 'Reaccommodation failed.') }
    inFlight.current = false
    setWorking(false)
  }

  const affectedLoaded = loadedDisruptionId === disruptionId
  return <div className="space-y-8">
    <ReadoutStrip>
      <Readout label="Open disruptions" tone={disruptionCount ? 'warn' : 'ok'} value={<span className="tabular-nums">{disruptionCount}</span>} />
      <Readout label="Candidate services" value={<span className="tabular-nums">{flightCount}</span>} />
      <Readout label="Affected segments" value={<span className="tabular-nums">{affectedLoaded ? affectedCount : '—'}</span>} sub={selectedDisruption?.disruptionKey} />
      <Readout label="Replacements" value={<span className="tabular-nums">{selectedDisruption ? replacementFlights.length : '—'}</span>} />
    </ReadoutStrip>

    {message && <Notice tone={messageFailed ? 'bad' : 'ok'} role={messageFailed ? 'alert' : 'status'}>{message}</Notice>}

    <DeskSection title="Open disruptions" count={disruptionCount} actions={<div className="flex items-center gap-2"><span className="tabular-nums text-xs  text-muted-foreground">{disruptions.length} on page</span>{disruptionHasNextPage && disruptionNextHref ? <Track><Pill asChild size="sm"><Link href={disruptionNextHref}>Next {RECOVERY_DISRUPTION_PAGE_SIZE}<ChevronRight /></Link></Pill></Track> : disruptionHasNextPage ? <span className="text-xs text-muted-foreground">More exist; reload</span> : null}</div>}>
      {openDisruptions.length ? <Panel className="divide-y">{openDisruptions.map(item => <RowLink key={item.id} href={`${detailBase}/${item.id}`} className={cn(item.id === disruptionId && 'bg-muted/40')}>
        <div className="min-w-0 space-y-0.5">
          <TitleLine as="h3" tone={statusTone(item.status)} status={item.status} className="text-sm font-semibold text-foreground"><Code className="text-base font-semibold text-foreground">{item.disruptionKey}</Code></TitleLine>
          <p className="break-words text-sm text-muted-foreground">{item.publicSummary ?? 'No passenger summary'}</p>
        </div>
        <div className="flex shrink-0 items-baseline gap-3">
          <span className="text-xs font-medium capitalize text-muted-foreground">{item.status}</span>
          <span className="tabular-nums text-sm font-medium  text-foreground">{item.flightInstance?.flightNumber ?? '—'}</span>
          <ChevronRight className="size-4 self-center text-muted-foreground" aria-hidden="true" />
        </div>
      </RowLink>)}</Panel> : <Well>No open disruptions</Well>}
    </DeskSection>

    <div className="grid min-w-0 gap-8 xl:grid-cols-2">
      <DeskSection title="Publish impact" count={flightCount}>
        <Panel className="space-y-4 p-4 [overflow-wrap:anywhere]">
          <Field label="Service"><select disabled={working} value={selectedPublishFlightId} onChange={event => setFlightId(event.target.value)} className={cn(deskInput, 'tabular-nums ')}><option value="">Select a flight</option>{flights.map(flight => <option key={flight.id} value={flight.id}>{flight.flightNumber} · {flight.origin.iataCode}–{flight.destination.iataCode} · {serviceDate(flight.serviceDate)} · {flight.status}</option>)}</select></Field>
          <Field label="Impact type"><select disabled={working} value={type} onChange={event => setType(event.target.value)} className={deskInput}><option value="delay">Delay</option><option value="cancellation">Cancellation</option><option value="schedule_change">Schedule change</option><option value="equipment_change">Equipment change</option><option value="misconnection">Misconnection</option><option value="diversion">Diversion</option><option value="other">Other</option></select></Field>
          <Field label="Passenger summary"><textarea disabled={working} value={summary} onChange={event => setSummary(event.target.value)} placeholder="Passenger-facing summary" className={cn(deskInput, 'h-auto min-h-24 py-2')} /></Field>
          {!flights.length && <Well className="py-4">No upcoming services</Well>}
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t pt-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="tabular-nums text-xs  text-muted-foreground">{flights.length} of {flightCount} services</span>
              {flightHasNextPage && serviceNextHref ? <Track><Pill asChild size="sm"><Link href={serviceNextHref}>Next {RECOVERY_FLIGHT_PAGE_SIZE}<ChevronRight /></Link></Pill></Track> : flightHasNextPage ? <span className="text-xs text-muted-foreground">More exist; reload</span> : null}
            </div>
            <Track><Pill variant="primary" disabled={working || !selectedPublishFlightId || !summary.trim()} onClick={publish}>Publish impact</Pill></Track>
          </div>
        </Panel>
      </DeskSection>

      <DeskSection title="Reaccommodate">
        <Panel className="space-y-4 p-4 [overflow-wrap:anywhere]">
          <Field label="Open disruption"><select value={disruptionId} onChange={event => { setDisruptionId(event.target.value); setBookingId(''); setReplacementFlightId(''); setBucketId('') }} disabled={working || !openDisruptions.length} className={deskInput}>{openDisruptions.map(item => <option key={item.id} value={item.id}>{item.disruptionKey} · {item.flightInstance?.flightNumber} · {item.publicSummary}</option>)}</select></Field>
          <Field label={<span className="flex items-baseline justify-between gap-2">Affected booking{affectedLoaded && <span className="tabular-nums font-normal ">{affectedSegments.length} of {affectedCount} segments</span>}</span>}><select value={selectedBookingId} onChange={event => setBookingId(event.target.value)} disabled={working || loadingAffected || !bookingChoices.length} className={cn(deskInput, 'tabular-nums ')}><option value="">Select an affected booking</option>{bookingChoices.map(booking => <option key={booking.id} value={booking.id}>{booking.recordLocator} · {booking.status} · {booking.paymentStatus}/{booking.ticketingStatus}</option>)}</select></Field>
          {loadingAffected && <p role="status" className="text-xs text-muted-foreground">Loading affected segments…</p>}
          {affectedError && <Notice tone="bad" role="alert"><div className="flex min-w-0 flex-wrap items-center gap-2">{affectedError}<Track><Pill size="sm" disabled={working || loadingAffected} onClick={() => setRefreshRevision(value => value + 1)}><RotateCw />Reload</Pill></Track></div></Notice>}
          {!loadingAffected && affectedLoaded && !bookingChoices.length && !affectedError && <p className="text-xs text-muted-foreground">No eligible bookings in loaded segments</p>}
          {affectedHasNext && <Track><Pill size="sm" disabled={loadingAffected} onClick={loadNextAffectedPage}>Load next {RECOVERY_AFFECTED_SEGMENT_PAGE_SIZE} segments</Pill></Track>}
          <Field label="Replacement flight"><select value={selectedReplacementFlightId} onChange={event => { setReplacementFlightId(event.target.value); setBucketId('') }} disabled={working || !replacementFlights.length} className={cn(deskInput, 'tabular-nums ')}><option value="">Select a replacement flight</option>{replacementFlights.map(flight => <option key={flight.id} value={flight.id}>{flight.flightNumber} · {flight.origin.iataCode}–{flight.destination.iataCode} · {serviceDate(flight.serviceDate)} · {flight.status}</option>)}</select></Field>
          <Field label="Replacement bucket"><select value={selectedBucketId} onChange={event => setBucketId(event.target.value)} disabled={working || !openBuckets.length} className={deskInput}><option value="">Select a fare</option>{openBuckets.map(bucket => <option key={bucket.id} value={bucket.id}>{bucket.bookingClassCode ?? 'Class unavailable'} · {bucket.cabin?.name ?? 'Cabin unavailable'} · {bucket.fareBrand?.name ?? 'Fare unavailable'} · {formatMinorUnits(bucket.baseAmount == null || bucket.taxAmount == null ? null : bucket.baseAmount + bucket.taxAmount, bucket.currencyCode)} · {Math.max(0, bucket.authorized - bucket.sold - bucket.held - bucket.blocked)} available</option>)}</select></Field>
          {flightHasNextPage && <Notice tone="warn">More candidate services on later pages</Notice>}
          {!replacementFlights.length && selectedDisruption && <p className="text-xs text-muted-foreground">No same-route replacement with open inventory</p>}
          <div className="flex justify-end border-t pt-4">
            <Track><Pill variant="primary" disabled={working || !!affectedError || !disruptionId || !selectedBookingId || !selectedReplacementFlightId || !selectedBucketId} onClick={reaccommodate}>Confirm replacement</Pill></Track>
          </div>
        </Panel>
      </DeskSection>
    </div>
  </div>
}

function serviceDate(value: string) { return value.slice(0, 10) }
