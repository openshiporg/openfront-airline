'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

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

  return <div className="grid gap-6 xl:grid-cols-2">
    <section className="rounded-2xl border bg-card p-5 xl:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Open recovery records</h2><p className="text-sm text-muted-foreground">{disruptions.length} shown on this page · {disruptionCount} currently open disruption records in your authorized scope (count query).</p></div>{disruptionHasNextPage && disruptionNextHref ? <Link href={disruptionNextHref} className="inline-flex rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Next {RECOVERY_DISRUPTION_PAGE_SIZE} disruptions →</Link> : disruptionHasNextPage ? <span className="text-xs text-muted-foreground">More disruptions exist; reload to continue.</span> : null}</div><div className="mt-3 grid gap-2 md:grid-cols-2">{openDisruptions.map(item => <Link key={item.id} href={`${detailBase}/${item.id}`} className="rounded-lg border p-3 text-sm hover:bg-muted/40"><strong>{item.disruptionKey}</strong> · Flight {item.flightInstance?.flightNumber ?? '—'}<span className="mt-1 block text-muted-foreground">{item.status} · {item.publicSummary ?? 'No passenger summary recorded'}</span></Link>)}</div>{!openDisruptions.length && <p className="mt-3 text-sm text-muted-foreground">No open disruption records were returned in the authorized scope.</p>}</section>
    {message && <p role={messageFailed ? 'alert' : 'status'} className={`rounded-lg px-3 py-2 text-sm xl:col-span-2 ${messageFailed ? 'bg-destructive/10 text-destructive' : 'bg-primary/10'}`}>{message}</p>}
    <section className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Publish flight disruption</h2><p className="mt-1 text-sm text-muted-foreground">Records passenger-facing impact for upcoming scheduled, open-for-sale, or delayed services. It does not establish operational cause or safety status.</p><div className="mt-5 min-w-0 space-y-3 [overflow-wrap:anywhere]"><label className="block text-sm font-medium">Upcoming service<select disabled={working} value={selectedPublishFlightId} onChange={event => setFlightId(event.target.value)} className="mt-2 w-full rounded-lg border bg-background px-3 py-2"><option value="">Select a flight</option>{flights.map(flight => <option key={flight.id} value={flight.id}>Flight {flight.flightNumber} · {flight.origin.iataCode}–{flight.destination.iataCode} · {serviceDate(flight.serviceDate)} · {flight.status}</option>)}</select></label><label className="block text-sm font-medium">Impact type<select disabled={working} value={type} onChange={event => setType(event.target.value)} className="mt-2 w-full rounded-lg border bg-background px-3 py-2"><option value="delay">Delay</option><option value="cancellation">Cancellation</option><option value="schedule_change">Schedule change</option><option value="equipment_change">Equipment change</option><option value="misconnection">Misconnection</option><option value="diversion">Diversion</option><option value="other">Other</option></select></label><label className="block text-sm font-medium">Passenger-facing summary<textarea disabled={working} value={summary} onChange={event => setSummary(event.target.value)} placeholder="Passenger-facing summary" className="mt-2 min-h-24 w-full rounded-lg border bg-background px-3 py-2" /></label><button disabled={working || !selectedPublishFlightId || !summary.trim()} onClick={publish} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Publish impact</button><p className="text-xs text-muted-foreground">{flights.length} shown on this page · {flightCount} future scheduled/open-for-sale/delayed services in your authorized scope (count query).</p>{flightHasNextPage && serviceNextHref ? <Link href={serviceNextHref} className="inline-flex rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Next {RECOVERY_FLIGHT_PAGE_SIZE} candidate services →</Link> : flightHasNextPage ? <p className="text-xs text-muted-foreground">More candidate services exist; reload to continue.</p> : null}{!flights.length && <p className="text-sm text-muted-foreground">No future scheduled, open-for-sale, or delayed services were returned in the authorized carrier scope.</p>}</div></section>
    <section className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Confirm reaccommodation</h2><p className="mt-1 text-sm text-muted-foreground">Select only a booking currently affected by the chosen disruption. Replacement choices are limited to the same route, a different future service, and open inventory; the transaction remains authoritative.</p><div className="mt-5 min-w-0 space-y-3 [overflow-wrap:anywhere]"><label className="block text-sm font-medium">Open disruption<select value={disruptionId} onChange={event => { setDisruptionId(event.target.value); setBookingId(''); setReplacementFlightId(''); setBucketId('') }} disabled={working || !openDisruptions.length} className="mt-2 w-full rounded-lg border bg-background px-3 py-2">{openDisruptions.map(item => <option key={item.id} value={item.id}>{item.disruptionKey} · Flight {item.flightInstance?.flightNumber} · {item.publicSummary}</option>)}</select></label><label className="block text-sm font-medium">Affected booking<select value={selectedBookingId} onChange={event => setBookingId(event.target.value)} disabled={working || loadingAffected || !bookingChoices.length} className="mt-2 w-full rounded-lg border bg-background px-3 py-2"><option value="">Select an affected booking</option>{bookingChoices.map(booking => <option key={booking.id} value={booking.id}>{booking.recordLocator} · {booking.status} · {booking.paymentStatus}/{booking.ticketingStatus}</option>)}</select></label>{loadedDisruptionId === disruptionId && <p className="text-xs text-muted-foreground">Loaded {affectedSegments.length} of {affectedCount} currently disrupted segments for this record; eligible booking choices are filtered locally. Current booking and artifact gates are rechecked on submit.</p>}{loadingAffected && <p role="status" className="text-sm text-muted-foreground">Loading affected booking segments…</p>}{affectedError && <p role="alert" className="text-sm text-destructive">{affectedError} <button type="button" disabled={working || loadingAffected} onClick={() => setRefreshRevision(value => value + 1)} className="underline">Reload affected bookings</button></p>}{!loadingAffected && loadedDisruptionId === disruptionId && !bookingChoices.length && !affectedError && <p className="text-sm text-muted-foreground">No eligible booking choices are present in the loaded segment pages.</p>}{affectedHasNext && <button type="button" disabled={loadingAffected} onClick={loadNextAffectedPage} className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">Load next {RECOVERY_AFFECTED_SEGMENT_PAGE_SIZE} affected segments</button>}<label className="block text-sm font-medium">Same-route future replacement<select value={selectedReplacementFlightId} onChange={event => { setReplacementFlightId(event.target.value); setBucketId('') }} disabled={working || !replacementFlights.length} className="mt-2 w-full rounded-lg border bg-background px-3 py-2"><option value="">Select a replacement flight</option>{replacementFlights.map(flight => <option key={flight.id} value={flight.id}>Flight {flight.flightNumber} · {flight.origin.iataCode}–{flight.destination.iataCode} · {serviceDate(flight.serviceDate)} · {flight.status}</option>)}</select></label><label className="block text-sm font-medium">Open replacement bucket<select value={selectedBucketId} onChange={event => setBucketId(event.target.value)} disabled={working || !openBuckets.length} className="mt-2 w-full rounded-lg border bg-background px-3 py-2"><option value="">Select a fare</option>{openBuckets.map(bucket => <option key={bucket.id} value={bucket.id}>{bucket.bookingClassCode ?? 'Class unavailable'} · {bucket.cabin?.name ?? 'Cabin unavailable'} · {bucket.fareBrand?.name ?? 'Fare unavailable'} · {formatMinorUnits(bucket.baseAmount == null || bucket.taxAmount == null ? null : bucket.baseAmount + bucket.taxAmount, bucket.currencyCode)} · {Math.max(0, bucket.authorized - bucket.sold - bucket.held - bucket.blocked)} currently available</option>)}</select></label>{flightHasNextPage && <p className="text-xs text-amber-700 dark:text-amber-300">A matching same-route service may be on a later candidate-services page.</p>}{!replacementFlights.length && selectedDisruption && <p className="text-sm text-muted-foreground">No loaded future same-route service has an open bucket with current positive availability. The server revalidates time, route, state, and party capacity.</p>}<button disabled={working || !!affectedError || !disruptionId || !selectedBookingId || !selectedReplacementFlightId || !selectedBucketId} onClick={reaccommodate} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Confirm replacement</button></div></section>
  </div>
}

function serviceDate(value: string) { return value.slice(0, 10) }
