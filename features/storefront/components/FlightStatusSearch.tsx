'use client'

import { FormEvent, useState } from 'react'

import type { PublicCarrierIdentity } from '@/features/storefront/lib/carrier'
import { customerSafeMessage } from '@/features/storefront/lib/request-errors'

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

function statusTone(value: string) {
  if (['scheduled', 'open_for_sale', 'closed_for_sale', 'departed', 'arrived'].includes(value)) return 'ok'
  if (['cancelled'].includes(value)) return 'bad'
  return 'warn'
}

function displayStatus(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase())
}

// Each time is shown in its own airport's zone and says whether it is actual, estimated, or scheduled.
function airportTime(flight: FlightStatus, leg: 'Departure' | 'Arrival', fallbackZone: string) {
  const actual = leg === 'Departure' ? flight.actualDepartureAt : flight.actualArrivalAt
  const estimated = leg === 'Departure' ? flight.estimatedDepartureAt : flight.estimatedArrivalAt
  const scheduled = leg === 'Departure' ? flight.scheduledDepartureAt : flight.scheduledArrivalAt
  const zone = (leg === 'Departure' ? flight.originTimezone : flight.destinationTimezone) || fallbackZone
  const format = (value: string) => {
    try { return new Intl.DateTimeFormat('en-US', { timeZone: zone, dateStyle: 'medium', timeStyle: 'short', timeZoneName: 'short' }).format(new Date(value)) }
    catch { return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short', timeZoneName: 'short' }).format(new Date(value)) }
  }
  if (actual) return `${format(actual)} (actual)`
  if (estimated) return `${format(estimated)} (estimated; scheduled ${format(scheduled)})`
  return `${format(scheduled)} (scheduled)`
}

export function FlightStatusSearch({ carrier, initialDate }: { carrier: PublicCarrierIdentity; initialDate: string }) {
  const [results, setResults] = useState<FlightStatus[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); setResults([])
    try {
      const formData = new FormData(event.currentTarget)
      const flightNumber = String(formData.get('flightNumber') ?? '').trim().toUpperCase()
      const serviceDate = String(formData.get('serviceDate') ?? '')
      if (!/^[A-Z0-9]{1,6}$/.test(flightNumber)) throw new Error('Enter a valid carrier flight number.')
      const response = await fetch('/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: `query($carrier:String!,$flight:String!,$date:String!){publicFlightStatuses(carrierCode:$carrier,flightNumber:$flight,serviceDate:$date){id flightNumber serviceDate status scheduledDepartureAt scheduledArrivalAt estimatedDepartureAt estimatedArrivalAt actualDepartureAt actualArrivalAt departureTerminal departureGate arrivalTerminal arrivalGate originCode originCity originTimezone destinationCode destinationCity destinationTimezone disruption{type status publicSummary publishedAt}}}`, variables: { carrier: carrier.code, flight: flightNumber, date: serviceDate } }) })
      const payload = await response.json() as { data?: { publicFlightStatuses: FlightStatus[] }; errors?: Array<{ message: string }> }
      if (!response.ok || payload.errors?.length || !payload.data) throw new Error(customerSafeMessage(payload.errors?.[0]?.message, 'Flight status is unavailable right now. Please try again.'))
      setResults(payload.data.publicFlightStatuses)
      if (!payload.data.publicFlightStatuses.length) setMessage(`No ${carrier.name} flight ${flightNumber} was found on ${serviceDate}. Check the flight number and the local departure date.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Flight status is unavailable.') }
    setBusy(false)
  }

  return <div className="space-y-6">
    <form onSubmit={submit} className="af-card relative z-10 grid gap-4 p-4 shadow-[0_24px_48px_-24px_rgb(15_27_45/0.45)] sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-6">
      <label className="af-field"><span className="af-field-label">{carrier.code} flight number</span><input aria-label="Flight number" name="flightNumber" autoCapitalize="characters" autoComplete="off" inputMode="text" pattern="[A-Za-z0-9]{1,6}" maxLength={6} required placeholder="101" className="af-input af-input-code text-lg" /></label>
      <label className="af-field"><span className="af-field-label">Departure date (local)</span><input aria-label="Departure date" name="serviceDate" type="date" defaultValue={initialDate} required className="af-input" /></label>
      <div className="af-track" data-block="true"><button disabled={busy} className="af-pill af-pill-primary min-h-11 px-6">{busy ? 'Checking…' : 'Check status'}</button></div>
    </form>
    {message && <p role="status" className="af-notice" data-tone="warn"><span className="af-dot" data-tone="warn" />{message}</p>}
    {results.map(flight => <article key={flight.id} className="af-board overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-baseline justify-between gap-3 px-5 pt-5 sm:px-6"><p className="af-board-cell af-signal text-sm font-semibold">{carrier.code} {flight.flightNumber} · {flight.serviceDate}</p><p className="af-title-line text-sm font-semibold"><span className="af-dot" data-tone={statusTone(flight.status)} />{displayStatus(flight.status)}</p></div>
      <h2 className="af-display flex items-center gap-3 px-5 pt-3 text-5xl uppercase sm:px-6 sm:text-6xl">{flight.originCode}<span className="af-path" />{flight.destinationCode}</h2>
      <p className="px-5 pt-1 text-sm text-[var(--af-board-ink-2)] sm:px-6">{flight.originCity} to {flight.destinationCity}</p>
      <dl className="af-board-row mt-5 grid sm:grid-cols-2">
        {(['Departure', 'Arrival'] as const).map(leg => <div key={leg} className="px-5 py-4 sm:px-6 sm:[&:last-child]:border-l sm:[&:last-child]:border-[var(--af-board-line)]">
          <dt className="af-eyebrow">{leg}</dt>
          <dd className="af-board-cell mt-1 text-sm">{airportTime(flight, leg, carrier.defaultTimezone)}</dd>
          <dd className="mt-3 grid grid-cols-2 gap-3"><span><span className="af-eyebrow block">Terminal</span><span className="af-board-cell text-2xl font-semibold">{(leg === 'Departure' ? flight.departureTerminal : flight.arrivalTerminal) ?? 'TBD'}</span></span><span><span className="af-eyebrow block">Gate</span><span className="af-board-cell af-signal text-2xl font-semibold">{(leg === 'Departure' ? flight.departureGate : flight.arrivalGate) ?? 'TBD'}</span></span></dd>
        </div>)}
      </dl>
      {flight.disruption?.publicSummary && <div className="af-board-row px-5 py-4 sm:px-6"><p className="af-title-line text-sm font-semibold"><span className="af-dot" data-tone="warn" />{displayStatus(flight.disruption.type)}</p><p className="mt-1 pl-4 text-sm text-[var(--af-board-ink-2)]">{flight.disruption.publicSummary}</p></div>}
    </article>)}
  </div>
}
