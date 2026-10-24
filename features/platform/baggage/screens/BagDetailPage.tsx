import Link from 'next/link'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { safeDeskReturn } from '@/features/platform/lib/desk-return'
import { Shell } from '@/features/platform/screens/Canonical/PlatformDeskPages'
import { Code, DeskSection, Facts, Notice, Panel, Pill, Route, TitleLine, Track, Well } from '@/features/platform/components/desk'
import { BagStatusLabel, bagTone } from '@/features/platform/baggage/components/BagStatus'
import { BagActions } from '@/features/platform/baggage/components/BagActions'
import { allowedBagActions, formatKg } from '@/features/platform/baggage/lib/bag-actions'
import { airportZoneLabel, instantToAirportLocal } from '@/features/platform/flight-ops/lib/airport-time'

type Params = Promise<{ id: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

type Actor = {
  carrier?: { id: string } | null
  role?: { canReadAirportService: boolean | null; canManageAirportService: boolean | null; canManageCarriers: boolean | null } | null
} | null

type AirportRef = { iataCode: string | null; timezone: string | null } | null

type BagEventRow = {
  id: string
  eventType: string | null
  statusSnapshot: string | null
  occurredAt: string | null
  source: string | null
  airport: AirportRef
  payloadSummary: { note?: unknown } | null
}

type BagDetail = {
  id: string
  tagNumber: string | null
  status: string | null
  bagType: string | null
  weightGrams: number | null
  acceptedAt: string | null
  deliveredAt: string | null
  passenger: { givenName: string | null; familyName: string | null } | null
  booking: { recordLocator: string | null } | null
  flightInstance: { flightNumber: string | null; serviceDate: string | null; origin: AirportRef; destination: AirportRef } | null
  origin: AirportRef
  destination: AirportRef
  events: BagEventRow[] | null
  eventsCount: number | null
}

const ACTOR_QUERY = `query PlatformBagActor { authenticatedItem { ... on User { carrier { id } role { canReadAirportService canManageAirportService canManageCarriers } } } }`

const BAG_QUERY = `query PlatformBag($id: ID!) {
  bag(where: { id: $id }) {
    id tagNumber status bagType weightGrams acceptedAt deliveredAt
    passenger { givenName familyName }
    booking { recordLocator }
    flightInstance { flightNumber serviceDate origin { iataCode timezone } destination { iataCode timezone } }
    origin { iataCode timezone }
    destination { iataCode timezone }
    events(orderBy: [{ occurredAt: desc }, { id: desc }], take: 100) { id eventType statusSnapshot occurredAt source airport { iataCode timezone } payloadSummary }
    eventsCount
  }
}`

function StationTime({ iso, airport }: { iso: string | null; airport: AirportRef }) {
  if (!iso) return <>--</>
  const timezone = airport?.timezone ?? 'UTC'
  return <>{instantToAirportLocal(iso, timezone).replace('T', ' ')} <span className="text-muted-foreground">{airportZoneLabel(iso, timezone)}</span></>
}

export async function BagDetailPage({ params, searchParams }: { params: Params; searchParams?: SearchParams }) {
  const { id } = await params
  const query = searchParams ? await searchParams : {}
  const backHref = safeDeskReturn('baggage', query.returnTo)
  const back = <Track><Pill asChild size="sm"><Link href={backHref}>Baggage</Link></Pill></Track>
  const parent = { title: 'Baggage', href: backHref }

  const actorResponse = await keystoneClient<{ authenticatedItem: Actor }>(ACTOR_QUERY)
  if (!actorResponse.success) {
    return <Shell title="Bag" eyebrow="Baggage" parent={parent} actions={back}><Notice tone="bad">Bag could not be loaded. Try again.</Notice></Shell>
  }
  const actor = actorResponse.data.authenticatedItem
  const role = actor?.role
  const canRead = Boolean((role?.canReadAirportService || role?.canManageAirportService) && (role?.canManageCarriers || actor?.carrier?.id))
  if (!canRead) {
    return <Shell title="Bag" eyebrow="Baggage" tone="bad" status="Unavailable" parent={parent} actions={back}><Notice tone="bad" role="alert">Bag records are unavailable under your current access.</Notice></Shell>
  }

  const response = await keystoneClient<{ bag: BagDetail | null }>(BAG_QUERY, { id })
  if (!response.success) {
    return <Shell title="Bag" eyebrow="Baggage" parent={parent} actions={back}><Notice tone="bad">Bag could not be loaded. Try again.</Notice></Shell>
  }
  const bag = response.data.bag
  if (!bag) {
    return <Shell title="Bag" eyebrow="Baggage" tone="bad" status="Not found" parent={parent} actions={back}><Notice tone="bad" role="alert">Bag not found or outside your stations.</Notice></Shell>
  }

  const events = bag.events ?? []
  const actions = role?.canManageAirportService ? allowedBagActions(bag.status) : []
  const passengerName = [bag.passenger?.givenName, bag.passenger?.familyName].filter(Boolean).join(' ')
  const locator = bag.booking?.recordLocator
  const defaultStation = events[0]?.airport?.iataCode ?? bag.origin?.iataCode ?? ''
  const flight = bag.flightInstance

  return (
    <Shell
      title={bag.tagNumber ?? 'Bag'}
      eyebrow="Baggage"
      tone={bagTone(bag.status)}
      status={bag.status ?? undefined}
      parent={parent}
      actions={back}
      meta={<span className="inline-flex flex-wrap items-baseline gap-3"><BagStatusLabel status={bag.status} /><Route from={bag.origin?.iataCode} to={bag.destination?.iataCode} /></span>}
    >
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="min-w-0 space-y-6">
          <DeskSection title="Bag">
            <Facts items={[
              { label: 'Tag number', value: bag.tagNumber ?? '--', mono: true },
              { label: 'Status', value: <BagStatusLabel status={bag.status} /> },
              { label: 'Type', value: <span className="capitalize">{(bag.bagType ?? '--').replaceAll('_', ' ')}</span> },
              { label: 'Weight', value: formatKg(bag.weightGrams), mono: true },
              { label: 'Passenger', value: passengerName || '--' },
              { label: 'Booking', value: locator ? <Link href={`/dashboard/platform/bookings?locator=${encodeURIComponent(locator)}`} className="font-mono font-medium underline underline-offset-4">{locator}</Link> : '--' },
              { label: 'Flight', value: flight ? <span className="font-mono tabular-nums">{flight.flightNumber ?? '--'} {flight.serviceDate?.slice(0, 10) ?? ''}</span> : '--' },
              { label: 'Route', value: <Route from={bag.origin?.iataCode} to={bag.destination?.iataCode} /> },
              { label: 'Accepted', value: <StationTime iso={bag.acceptedAt} airport={bag.origin} />, mono: true },
              bag.deliveredAt ? { label: 'Delivered', value: <StationTime iso={bag.deliveredAt} airport={bag.destination} />, mono: true } : null,
            ]} />
          </DeskSection>
          {actions.length > 0 && (
            <DeskSection title="Record event">
              <BagActions key={bag.status ?? ''} bagId={bag.id} actions={actions} defaultStation={defaultStation} />
            </DeskSection>
          )}
          {!role?.canManageAirportService && <Notice>Read only. Airport service access required for changes.</Notice>}
        </div>
        <DeskSection title="Timeline" count={bag.eventsCount ?? events.length}>
          {events.length === 0 ? <Well>No bag events.</Well> : (
            <Panel>
              <ol className="divide-y">
                {events.map(event => {
                  const note = typeof event.payloadSummary?.note === 'string' ? event.payloadSummary.note : ''
                  return (
                    <li key={event.id} className="min-w-0 space-y-1 px-4 py-3">
                      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <TitleLine as="h3" tone={bagTone(event.statusSnapshot)} status={event.statusSnapshot ?? undefined} className="text-sm font-medium capitalize">
                          {(event.eventType ?? 'event').replaceAll('_', ' ')}
                        </TitleLine>
                        <span className="font-mono text-xs tabular-nums text-foreground"><StationTime iso={event.occurredAt} airport={event.airport} /></span>
                      </div>
                      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 pl-4">
                        <BagStatusLabel status={event.statusSnapshot} />
                        <Code>{event.airport?.iataCode ?? 'No station'}</Code>
                        {event.source && <span className="text-xs capitalize text-muted-foreground">{event.source}</span>}
                      </div>
                      {note && <p className="break-words pl-4 text-sm text-foreground">{note}</p>}
                    </li>
                  )
                })}
              </ol>
            </Panel>
          )}
        </DeskSection>
      </div>
    </Shell>
  )
}
