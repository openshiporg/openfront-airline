import Link from 'next/link'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { carrierCalendarDate } from '@/features/storefront/lib/branding'
import { Shell } from '@/features/platform/screens/Canonical/PlatformDeskPages'
import { Code, DeskSection, Field, FilterBar, Notice, Panel, Pill, Readout, ReadoutStrip, Route, StatusLabel, TitleLine, Track, Well, deskInput, statusTone } from '@/features/platform/components/desk'
import { FlightOpsControls, type FlightOpsFlight } from '@/features/platform/flight-ops/components/FlightOpsControls'
import { formatAirportTime, instantToAirportLocal } from '@/features/platform/flight-ops/lib/airport-time'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const PAGE_SIZE = 200
const BASE = '/dashboard/platform/flight-ops'

type Actor = {
  carrier?: { id: string; defaultTimezone: string | null } | null
  role?: { canReadNetwork: boolean | null; canManageNetwork: boolean | null; canManageAirportService: boolean | null; canManageCarriers: boolean | null } | null
} | null

type AirportRef = { iataCode: string | null; timezone: string | null } | null

type FlightRow = {
  id: string
  flightNumber: string | null
  status: string | null
  serviceDate: string | null
  scheduledDepartureAt: string | null
  scheduledArrivalAt: string | null
  estimatedDepartureAt: string | null
  estimatedArrivalAt: string | null
  actualDepartureAt: string | null
  actualArrivalAt: string | null
  departureTerminal: string | null
  departureGate: string | null
  arrivalTerminal: string | null
  arrivalGate: string | null
  origin: AirportRef
  destination: AirportRef
  passengerCount: number | null
  checkedInCount: number | null
}

const ACTOR_QUERY = `query FlightOpsActor {
  authenticatedItem { ... on User { carrier { id defaultTimezone } role { canReadNetwork canManageNetwork canManageAirportService canManageCarriers } } }
}`

const FLIGHTS_QUERY = `query FlightOpsBoard($where: FlightInstanceWhereInput!, $delayedWhere: FlightInstanceWhereInput!, $departedWhere: FlightInstanceWhereInput!, $arrivedWhere: FlightInstanceWhereInput!) {
  flightInstances(where: $where, orderBy: [{ scheduledDepartureAt: asc }, { id: asc }], take: ${PAGE_SIZE}) {
    id flightNumber status serviceDate
    scheduledDepartureAt scheduledArrivalAt estimatedDepartureAt estimatedArrivalAt actualDepartureAt actualArrivalAt
    departureTerminal departureGate arrivalTerminal arrivalGate
    origin { iataCode timezone }
    destination { iataCode timezone }
    passengerCount: bookingSegmentsCount(where: { status: { in: [confirmed, checked_in, boarded, flown] } })
    checkedInCount: checkInsCount(where: { status: { in: [checked_in, boarded] } })
  }
  total: flightInstancesCount(where: $where)
  delayed: flightInstancesCount(where: $delayedWhere)
  departed: flightInstancesCount(where: $departedWhere)
  arrived: flightInstancesCount(where: $arrivedWhere)
}`

function todayIn(timezone: string | null | undefined) {
  try { return carrierCalendarDate(new Date(), timezone || 'UTC') } catch { return carrierCalendarDate(new Date(), 'UTC') }
}

function TimeTriple({ scheduled, estimated, actual, timezone, referenceDay }: { scheduled: string | null; estimated: string | null; actual: string | null; timezone: string | null; referenceDay: string }) {
  const cells = [
    { label: 'Sch', value: formatAirportTime(scheduled, timezone, referenceDay) },
    { label: 'Est', value: formatAirportTime(estimated, timezone, referenceDay) },
    { label: 'Act', value: formatAirportTime(actual, timezone, referenceDay) },
  ]
  return (
    <dl className="grid grid-cols-3 gap-2 tabular-nums text-xs ">
      {cells.map(cell => (
        <div key={cell.label} className="min-w-0">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{cell.label}</dt>
          <dd className={cell.value ? 'text-foreground' : 'text-muted-foreground'}>{cell.value || '--'}</dd>
        </div>
      ))}
    </dl>
  )
}

function Stand({ terminal, gate }: { terminal: string | null; gate: string | null }) {
  return (
    <span className="tabular-nums text-xs  text-muted-foreground">
      T <span className="text-foreground">{terminal || '--'}</span> Gate <span className="text-foreground">{gate || '--'}</span>
    </span>
  )
}

function FlightRowView({ flight, canManage }: { flight: FlightRow; canManage: boolean }) {
  const originTz = flight.origin?.timezone ?? null
  const destinationTz = flight.destination?.timezone ?? null
  const referenceDay = instantToAirportLocal(flight.scheduledDepartureAt, originTz).slice(0, 10)
  const controlsFlight: FlightOpsFlight = {
    id: flight.id,
    flightNumber: flight.flightNumber,
    status: flight.status,
    originCode: flight.origin?.iataCode ?? null,
    destinationCode: flight.destination?.iataCode ?? null,
    originTimezone: originTz,
    destinationTimezone: destinationTz,
    scheduledDepartureAt: flight.scheduledDepartureAt,
    scheduledArrivalAt: flight.scheduledArrivalAt,
    estimatedDepartureAt: flight.estimatedDepartureAt,
    estimatedArrivalAt: flight.estimatedArrivalAt,
    actualDepartureAt: flight.actualDepartureAt,
    actualArrivalAt: flight.actualArrivalAt,
    departureTerminal: flight.departureTerminal,
    departureGate: flight.departureGate,
    arrivalTerminal: flight.arrivalTerminal,
    arrivalGate: flight.arrivalGate,
  }
  return (
    <li className="min-w-0 space-y-3 px-4 py-3">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <TitleLine as="h3" tone={statusTone(flight.status)} status={flight.status ?? undefined} className="font-medium">
          <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="tabular-nums ">{flight.flightNumber ?? '--'}</span>
            <Route from={flight.origin?.iataCode} to={flight.destination?.iataCode} />
          </span>
        </TitleLine>
        <div className="flex items-baseline gap-3">
          <StatusLabel status={flight.status} />
          <span className="tabular-nums text-xs  text-muted-foreground">Pax <span className="text-foreground">{flight.passengerCount ?? '--'}</span> Chk <span className="text-foreground">{flight.checkedInCount ?? '--'}</span></span>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-1.5 rounded-[4px] bg-muted/40 px-3 py-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Departure <Code>{flight.origin?.iataCode}</Code></span>
            <Stand terminal={flight.departureTerminal} gate={flight.departureGate} />
          </div>
          <TimeTriple scheduled={flight.scheduledDepartureAt} estimated={flight.estimatedDepartureAt} actual={flight.actualDepartureAt} timezone={originTz} referenceDay={referenceDay} />
        </div>
        <div className="min-w-0 space-y-1.5 rounded-[4px] bg-muted/40 px-3 py-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Arrival <Code>{flight.destination?.iataCode}</Code></span>
            <Stand terminal={flight.arrivalTerminal} gate={flight.arrivalGate} />
          </div>
          <TimeTriple scheduled={flight.scheduledArrivalAt} estimated={flight.estimatedArrivalAt} actual={flight.actualArrivalAt} timezone={destinationTz} referenceDay={referenceDay} />
        </div>
      </div>
      <FlightOpsControls key={`${flight.id}:${flight.status}:${flight.estimatedDepartureAt}:${flight.actualDepartureAt}:${flight.departureGate}`} flight={controlsFlight} canManage={canManage} />
    </li>
  )
}

export async function FlightOpsPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ? await searchParams : {}
  const actorResponse = await keystoneClient<{ authenticatedItem: Actor }>(ACTOR_QUERY)
  const actor = actorResponse.success ? actorResponse.data.authenticatedItem : null
  const rawDate = typeof params.date === 'string' ? params.date.trim() : ''
  const serviceDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && !Number.isNaN(Date.parse(`${rawDate}T00:00:00Z`)) ? rawDate : todayIn(actor?.carrier?.defaultTimezone)
  const rawStation = typeof params.station === 'string' ? params.station.trim().toUpperCase() : ''
  const station = /^[A-Z]{3}$/.test(rawStation) ? rawStation : ''
  const stationInvalid = Boolean(rawStation) && !station

  const disruptionsLink = <Track><Pill asChild size="sm"><Link href="/dashboard/platform/disruptions">Disruptions</Link></Pill></Track>
  const meta = <span className="tabular-nums ">{serviceDate}{station ? ` / ${station}` : ' / All stations'}</span>
  const filters = (
    <FilterBar action={BASE}>
      <Field label="Service date" className="sm:w-48"><input type="date" name="date" defaultValue={serviceDate} required className={`${deskInput} tabular-nums `} /></Field>
      <Field label="Station" className="sm:w-32"><input name="station" defaultValue={rawStation} maxLength={3} placeholder="JFK" className={`${deskInput} tabular-nums uppercase`} /></Field>
      <Track><Pill type="submit" variant="primary">Load</Pill><Pill asChild><Link href={BASE}>Today</Link></Pill></Track>
    </FilterBar>
  )

  if (!actorResponse.success) {
    return <Shell title="Flight operations" eyebrow="Operations control" actions={disruptionsLink} meta={meta}>{filters}<Notice tone="bad">Flight operations could not be loaded. Try again.</Notice></Shell>
  }
  const role = actor?.role
  const canRead = Boolean((role?.canReadNetwork || role?.canManageNetwork) && (role?.canManageCarriers || actor?.carrier?.id))
  if (!canRead) {
    return <Shell title="Flight operations" eyebrow="Operations control" tone="bad" status="Unavailable" actions={disruptionsLink} meta={meta}><Notice tone="bad" role="alert">Dated flights are unavailable under your current access.</Notice></Shell>
  }
  const canManage = Boolean(role?.canManageAirportService)

  const start = new Date(`${serviceDate}T00:00:00.000Z`)
  const end = new Date(start.getTime() + 86_400_000)
  const where: Record<string, unknown> = {
    serviceDate: { gte: start.toISOString(), lt: end.toISOString() },
    ...(station ? { OR: [{ origin: { iataCode: { equals: station } } }, { destination: { iataCode: { equals: station } } }] } : {}),
  }
  const withStatus = (status: string) => ({ AND: [where, { status: { equals: status } }] })
  const response = await keystoneClient<{ flightInstances: FlightRow[] | null; total: number | null; delayed: number | null; departed: number | null; arrived: number | null }>(FLIGHTS_QUERY, {
    where,
    delayedWhere: withStatus('delayed'),
    departedWhere: withStatus('departed'),
    arrivedWhere: withStatus('arrived'),
  })

  const data = response.success ? response.data : null
  const flights = data?.flightInstances ?? []
  const total = data?.total ?? flights.length

  return (
    <Shell title="Flight operations" eyebrow="Operations control" tone={data && (data.delayed ?? 0) > 0 ? 'warn' : undefined} meta={meta} actions={disruptionsLink}>
      {filters}
      {stationInvalid && <Notice tone="warn">Station must be a three-letter code. Showing all stations.</Notice>}
      {!response.success ? <Notice tone="bad">Flights could not be loaded. Try again.</Notice> : (
        <>
          <ReadoutStrip>
            <Readout label="Flights" value={total} />
            <Readout label="Delayed" tone={(data?.delayed ?? 0) > 0 ? 'warn' : undefined} value={data?.delayed ?? 0} />
            <Readout label="Departed" value={data?.departed ?? 0} />
            <Readout label="Arrived" value={data?.arrived ?? 0} />
          </ReadoutStrip>
          {!canManage && <Notice>Read only. Airport service access required for changes.</Notice>}
          {total > flights.length && <Notice tone="warn">Showing the first {flights.length} of {total} flights. Filter by station.</Notice>}
          {flights.length === 0 ? <Well>No dated flights on {serviceDate}{station ? ` at ${station}` : ''}.</Well> : (
            <DeskSection title="Day board" count={total} actions={<span className="text-xs text-muted-foreground">Airport local time</span>}>
              <Panel><ul className="divide-y">{flights.map(flight => <FlightRowView key={flight.id} flight={flight} canManage={canManage} />)}</ul></Panel>
            </DeskSection>
          )}
        </>
      )}
    </Shell>
  )
}
