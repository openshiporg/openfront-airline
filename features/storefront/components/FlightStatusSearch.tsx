'use client'

import { FormEvent, useState } from 'react'

import { PlatformDateInput } from '@/features/platform/components/PlatformDateTime'

import type { PublicCarrierIdentity } from '@/features/storefront/lib/carrier'
import { customerSafeMessage } from '@/features/storefront/lib/request-errors'
import { formatAirportClock } from '@/features/airline/lib/time'
import { dayShift, formatServiceDay } from '@/features/storefront/lib/airport-time'

type FlightStatus = {
  id: string
  flightNumber: string
  serviceDate: string
  status: string
  scheduledDepartureAt: string
  scheduledArrivalAt: string
  estimatedDepartureAt?: string | null
  estimatedArrivalAt?: string | null
  actualDepartureAt?: string | null
  actualArrivalAt?: string | null
  departureTerminal?: string | null
  departureGate?: string | null
  arrivalTerminal?: string | null
  arrivalGate?: string | null
  originCode: string
  originCity: string
  originTimezone?: string | null
  destinationCode: string
  destinationCity: string
  destinationTimezone?: string | null
  disruption?: { type: string; status: string; publicSummary?: string | null; publishedAt?: string | null } | null
}

// Sales states are not public flight states. A schedule alone is not evidence of boarding or departure.
type PublicStatus = 'Scheduled' | 'Boarding' | 'Closed' | 'Delayed' | 'Departed' | 'Cancelled'
function publicStatus(flight: Pick<FlightStatus, 'status' | 'scheduledDepartureAt' | 'estimatedDepartureAt' | 'actualDepartureAt'>): PublicStatus {
  if (flight.status === 'cancelled') return 'Cancelled'
  if (['departed', 'arrived'].includes(flight.status) || flight.actualDepartureAt) return 'Departed'
  if (flight.status === 'boarding') return 'Boarding'
  if (flight.status === 'boarding_closed') return 'Closed'
  const departure = Date.parse(flight.estimatedDepartureAt || flight.scheduledDepartureAt)
  // Do not advertise a delay without a revised time to show next to the original schedule.
  const revised = !!flight.estimatedDepartureAt && departure > Date.parse(flight.scheduledDepartureAt)
  return revised && (flight.status === 'delayed' || departure - Date.parse(flight.scheduledDepartureAt) >= 15 * 60_000) ? 'Delayed' : 'Scheduled'
}
const statusTone = (status: PublicStatus) => status === 'Cancelled' ? 'bad' : status === 'Delayed' ? 'warn' : 'ok'

// Each time is shown in its own airport's clock and says whether it is actual, estimated, or scheduled; a revised
// time keeps the original schedule beside it.
function airportTime(flight: FlightStatus, leg: 'Departure' | 'Arrival', fallbackZone: string) {
  const actual = leg === 'Departure' ? flight.actualDepartureAt : flight.actualArrivalAt
  const estimated = leg === 'Departure' ? flight.estimatedDepartureAt : flight.estimatedArrivalAt
  const scheduled = leg === 'Departure' ? flight.scheduledDepartureAt : flight.scheduledArrivalAt
  const zone = (leg === 'Departure' ? flight.originTimezone : flight.destinationTimezone) || fallbackZone
  const shown = actual ?? estimated ?? scheduled
  const later = leg === 'Arrival' ? dayShift(flight.scheduledDepartureAt, flight.originTimezone || fallbackZone, shown, zone) : 0
  return {
    kind: actual ? 'Actual' : estimated ? 'Estimated' : 'Scheduled',
    clock: formatAirportClock(shown, zone) ?? shown,
    later,
    scheduled: !actual && estimated ? formatAirportClock(scheduled, zone) : null,
  }
}
type MessageTone = 'info' | 'warn' | 'bad'

export function FlightStatusSearch({ carrier, initialDate }: { carrier: PublicCarrierIdentity; initialDate: string }) {
  const [results, setResults] = useState<FlightStatus[]>([])
  const [message, setMessageText] = useState('')
  const [messageTone, setMessageTone] = useState<MessageTone>('info')
  function setMessage(next: string, tone: MessageTone = 'info') { setMessageText(next); setMessageTone(tone) }
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); setResults([])
    try {
      const formData = new FormData(event.currentTarget)
      const flightNumber = String(formData.get('flightNumber') ?? '').trim().toUpperCase()
      const serviceDate = String(formData.get('serviceDate') ?? '')
      if (!/^[A-Z0-9]{1,6}$/.test(flightNumber)) { setMessage(`Enter the ${carrier.code} flight number, for example 101.`, 'warn'); setBusy(false); return }
      const response = await fetch('/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: `query($carrier:String!,$flight:String!,$date:String!){publicFlightStatuses(carrierCode:$carrier,flightNumber:$flight,serviceDate:$date){id flightNumber serviceDate status scheduledDepartureAt scheduledArrivalAt estimatedDepartureAt estimatedArrivalAt actualDepartureAt actualArrivalAt departureTerminal departureGate arrivalTerminal arrivalGate originCode originCity originTimezone destinationCode destinationCity destinationTimezone disruption{type status publicSummary publishedAt}}}`, variables: { carrier: carrier.code, flight: flightNumber, date: serviceDate } }) })
      const payload = await response.json() as { data?: { publicFlightStatuses: FlightStatus[] }; errors?: Array<{ message: string }> }
      if (!response.ok || payload.errors?.length || !payload.data) throw new Error(customerSafeMessage(payload.errors?.[0]?.message, 'Flight status is unavailable right now. Please try again.'))
      setResults(payload.data.publicFlightStatuses)
      if (!payload.data.publicFlightStatuses.length) setMessage(`No ${carrier.name} flight ${flightNumber} on ${formatServiceDay(serviceDate)}. Check the flight number and the local departure date.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Flight status is unavailable.', 'bad') }
    setBusy(false)
  }

  return <div className="space-y-6">
    <form onSubmit={submit} className="af-card grid gap-4 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-6">
      <label className="af-field"><span className="af-field-label">{carrier.code} flight number</span><input aria-label="Flight number" name="flightNumber" autoCapitalize="characters" autoComplete="off" inputMode="text" pattern="[A-Za-z0-9]{1,6}" maxLength={6} required placeholder="101" className="af-input af-input-code" /></label>
      <div className="af-field relative"><span className="af-field-label">Departure date (local)</span><PlatformDateInput aria-label="Departure date" name="serviceDate" defaultValue={initialDate} required className="af-input af-trigger" /></div>
      <div className="af-track" data-block="true"><button disabled={busy} className="af-pill af-pill-primary">{busy ? 'Checking…' : 'Check status'}</button></div>
    </form>
    {message && <p role="status" className="af-notice" data-tone={messageTone}><span className="af-dot" data-tone={messageTone} />{message}</p>}
    {results.map(flight => <article key={flight.id} className="af-board af-board-card">
      <div className="flex flex-wrap items-baseline justify-between gap-3 px-5 pt-5 sm:px-6"><p className="af-board-cell af-signal text-sm font-semibold">{carrier.code} {flight.flightNumber} · {formatServiceDay(flight.serviceDate)}</p><p className="af-title-line text-sm font-semibold"><span className="af-dot" data-tone={statusTone(publicStatus(flight))} />{publicStatus(flight)}</p></div>
      <h2 className="af-display flex items-center gap-3 px-5 pt-3 text-5xl uppercase sm:px-6">{flight.originCode}<span className="af-path" />{flight.destinationCode}</h2>
      <p className="px-5 pt-1 text-sm text-[var(--af-board-ink-2)] sm:px-6">{flight.originCity} to {flight.destinationCity}</p>
      <dl className="af-board-row mt-5 grid sm:grid-cols-2">
        {(['Departure', 'Arrival'] as const).map(leg => <div key={leg} className="px-5 py-4 sm:px-6 sm:[&:last-child]:border-l sm:[&:last-child]:border-[var(--af-board-line)]">
          {(() => {
            const time = airportTime(flight, leg, carrier.defaultTimezone)
            return <><dt className="af-eyebrow">{leg === 'Departure' ? 'Departs' : 'Arrives'} · {time.kind}</dt>
              <dd className="af-board-cell af-time mt-1">{time.clock}{time.later > 0 ? <sup className="af-day-shift"><span className="sr-only">, </span>+{time.later}<span className="sr-only"> {time.later === 1 ? 'day' : 'days'}</span></sup> : null}</dd>
              {time.scheduled && <dd className="mt-1 text-sm text-[var(--af-board-ink-2)]">Scheduled {time.scheduled}</dd>}</>
          })()}
          {(() => {
            // A label shows only with a value: no bare "Terminal"/"Gate" before the station assigns them.
            const terminal = (leg === 'Departure' ? flight.departureTerminal : flight.arrivalTerminal)?.trim()
            const gate = (leg === 'Departure' ? flight.departureGate : flight.arrivalGate)?.trim()
            if (!terminal && !gate) return null
            return <dd className="mt-3 grid grid-cols-2 gap-3">{terminal && <span><span className="af-eyebrow block">Terminal</span><span className="af-board-cell text-2xl font-semibold">{terminal}</span></span>}{gate && <span><span className="af-eyebrow block">Gate</span><span className="af-board-cell af-signal text-2xl font-semibold">{gate}</span></span>}</dd>
          })()}
        </div>)}
      </dl>
      {flight.disruption?.publicSummary && <div className="af-board-row px-5 py-4 sm:px-6"><p className="af-title-line text-sm font-semibold"><span className="af-dot" data-tone="warn" />{flight.disruption.type.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase())}</p><p className="mt-1 pl-4 text-sm text-[var(--af-board-ink-2)]">{flight.disruption.publicSummary}</p></div>}
    </article>)}
  </div>
}
