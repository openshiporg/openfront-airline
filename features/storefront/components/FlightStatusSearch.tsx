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

  return <div className="space-y-5">
    <form onSubmit={submit} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_1fr_auto]">
      <label className="text-sm font-medium">{carrier.code} flight number<input aria-label="Flight number" name="flightNumber" autoCapitalize="characters" autoComplete="off" inputMode="text" pattern="[A-Za-z0-9]{1,6}" maxLength={6} required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 uppercase" /></label>
      <label className="text-sm font-medium">Departure date (local)<input aria-label="Departure date" name="serviceDate" type="date" defaultValue={initialDate} required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3" /></label>
      <button disabled={busy} className="self-end rounded-xl bg-[var(--storefront-brand)] px-4 py-3 font-medium text-white disabled:opacity-50">{busy ? 'Checking…' : 'Check status'}</button>
    </form>
    {message && <p role="status" className="rounded-2xl bg-[var(--storefront-brand-soft)] px-4 py-3 text-sm text-slate-950">{message}</p>}
    {results.map(flight => <article key={flight.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-medium text-[var(--storefront-brand)]">{carrier.code} {flight.flightNumber} · {flight.serviceDate}</p><h2 className="mt-1 text-xl font-semibold">{flight.originCode} {flight.originCity} → {flight.destinationCode} {flight.destinationCity}</h2></div><span className="w-fit rounded-full bg-[var(--storefront-brand)] px-3 py-1 text-sm font-medium text-white">{displayStatus(flight.status)}</span></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Departure</dt><dd className="mt-1 font-medium">{airportTime(flight, 'Departure', carrier.defaultTimezone)} · Terminal {flight.departureTerminal ?? 'TBD'} · Gate {flight.departureGate ?? 'TBD'}</dd></div><div><dt className="text-slate-500">Arrival</dt><dd className="mt-1 font-medium">{airportTime(flight, 'Arrival', carrier.defaultTimezone)} · Terminal {flight.arrivalTerminal ?? 'TBD'} · Gate {flight.arrivalGate ?? 'TBD'}</dd></div></dl>{flight.disruption?.publicSummary && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">Published {displayStatus(flight.disruption.type)}</p><p className="mt-1">{flight.disruption.publicSummary}</p></div>}</article>)}
  </div>
}
