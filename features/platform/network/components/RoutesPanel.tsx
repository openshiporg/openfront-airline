'use client'

import * as React from 'react'
import Link from 'next/link'

import { Code, DeskSection, Panel, Pill, Route, StatusLabel, TitleLine, Track, Well, deskInput, statusTone } from '@/features/platform/components/desk'
import { createRouteAction, setRouteStatusAction, updateRouteAction } from '@/features/platform/network/actions/routes'
import { ROUTE_TRANSITIONS, wholeNumber } from '@/features/platform/network/lib/desk-shared'
import type { AirportOption, RouteRow } from '@/features/platform/network/lib/types'
import { CheckField, DeskRow, FormField, FormSheet, TransitionPills, useDeskAction } from './DeskForm'

type Values = { originId: string; destinationId: string; distance: string; connection: string; isInternational: boolean }
type Errors = Partial<Record<'originId' | 'destinationId' | 'distance' | 'connection', string>>

const EMPTY: Values = { originId: '', destinationId: '', distance: '', connection: '', isInternational: false }

function airportLabel(airport: AirportOption) {
  return `${airport.iataCode} ${airport.city}`
}

function RouteItem({ route, onEdit }: { route: RouteRow; onEdit: () => void }) {
  const action = useDeskAction()
  return (
    <DeskRow
      error={action.error}
      actions={
        <TransitionPills
          transitions={ROUTE_TRANSITIONS[route.status] ?? []}
          disabled={action.pending}
          onEdit={route.status === 'archived' ? undefined : onEdit}
          onTransition={to => action.run(() => setRouteStatusAction(route.id, to))}
        >
          <Pill asChild size="sm"><Link href={`/dashboard/platform/network?tab=schedules&route=${encodeURIComponent(route.id)}`}>Schedules</Link></Pill>
        </TransitionPills>
      }
    >
      <TitleLine tone={statusTone(route.status)} status={route.status} className="text-sm font-medium text-foreground">
        <Route from={route.origin?.iataCode} to={route.destination?.iataCode} />
        <span className="ml-2 text-muted-foreground">{route.origin?.city ?? ''}{route.destination ? ` to ${route.destination.city}` : ''}</span>
      </TitleLine>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <StatusLabel status={route.status} />
        <Code>{route.routeKey}</Code>
        <span className="font-mono tabular-nums">{route.distanceKilometers != null ? `${route.distanceKilometers.toLocaleString('en-US')} km` : 'No distance'}</span>
        <span>{route.isInternational ? 'International' : 'Domestic'}</span>
        {route.minimumConnectionMinutes != null && <span className="font-mono tabular-nums">MCT {route.minimumConnectionMinutes} min</span>}
        <span className="font-mono tabular-nums">{route.schedulesCount ?? 0} schedules</span>
      </div>
    </DeskRow>
  )
}

export function RoutesPanel({
  routes,
  total,
  airports,
  carrierCode,
  statusTabs,
  pager,
}: {
  routes: RouteRow[]
  total: number
  airports: AirportOption[]
  carrierCode: string
  statusTabs: React.ReactNode
  pager: React.ReactNode
}) {
  const [editing, setEditing] = React.useState<RouteRow | 'new' | null>(null)
  const [values, setValues] = React.useState<Values>(EMPTY)
  const [errors, setErrors] = React.useState<Errors>({})
  const action = useDeskAction()
  const byId = React.useMemo(() => new Map(airports.map(airport => [airport.id, airport])), [airports])

  const options = React.useMemo(() => {
    // Keep a route's current airports selectable even if they fall outside the loaded airport list.
    const extra: AirportOption[] = []
    if (editing && editing !== 'new') {
      for (const airport of [editing.origin, editing.destination]) if (airport && !byId.has(airport.id)) extra.push(airport)
    }
    return [...extra, ...airports]
  }, [airports, byId, editing])

  const locked = editing !== null && editing !== 'new' && (editing.schedulesCount ?? 0) > 0

  function open(route: RouteRow | 'new') {
    setErrors({})
    action.setError(null)
    setValues(route === 'new' ? EMPTY : {
      originId: route.origin?.id ?? '',
      destinationId: route.destination?.id ?? '',
      distance: route.distanceKilometers != null ? String(route.distanceKilometers) : '',
      connection: route.minimumConnectionMinutes != null ? String(route.minimumConnectionMinutes) : '',
      isInternational: route.isInternational,
    })
    setEditing(route)
  }

  function pickAirport(field: 'originId' | 'destinationId', id: string) {
    setValues(current => {
      const next = { ...current, [field]: id }
      const origin = options.find(airport => airport.id === next.originId)
      const destination = options.find(airport => airport.id === next.destinationId)
      if (origin && destination) next.isInternational = origin.countryCode !== destination.countryCode
      return next
    })
  }

  function submit() {
    const nextErrors: Errors = {}
    if (!values.originId) nextErrors.originId = 'Required.'
    if (!values.destinationId) nextErrors.destinationId = 'Required.'
    if (values.originId && values.originId === values.destinationId) nextErrors.destinationId = 'Must differ from origin.'
    const distance = wholeNumber(values.distance, { max: 25_000 })
    if (!distance.ok) nextErrors.distance = distance.error
    const connection = wholeNumber(values.connection, { max: 1_440 })
    if (!connection.ok) nextErrors.connection = connection.error
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length || !distance.ok || !connection.ok) return
    const input = {
      originId: values.originId,
      destinationId: values.destinationId,
      distanceKilometers: distance.value,
      minimumConnectionMinutes: connection.value,
      isInternational: values.isInternational,
    }
    const target = editing
    action.run(() => target && target !== 'new' ? updateRouteAction(target.id, input) : createRouteAction(input), () => setEditing(null))
  }

  const origin = options.find(airport => airport.id === values.originId)
  const destination = options.find(airport => airport.id === values.destinationId)

  return (
    <DeskSection title="Routes" count={total} actions={<Track><Pill variant="primary" size="sm" onClick={() => open('new')}>New route</Pill></Track>}>
      <div className="space-y-3">
        {statusTabs}
        {routes.length === 0 ? (
          <Well>No routes</Well>
        ) : (
          <Panel>
            <ul className="divide-y">
              {routes.map(route => <RouteItem key={route.id} route={route} onEdit={() => open(route)} />)}
            </ul>
          </Panel>
        )}
        {pager}
      </div>

      <FormSheet
        open={editing !== null}
        onOpenChange={next => { if (!next) setEditing(null) }}
        title={editing === 'new' ? 'New route' : 'Edit route'}
        submitLabel={editing === 'new' ? 'Create route' : 'Save route'}
        pending={action.pending}
        error={action.error}
        onSubmit={submit}
      >
        <FormField label="Origin" error={errors.originId} htmlFor="route-origin">
          <select id="route-origin" value={values.originId} disabled={locked} onChange={event => pickAirport('originId', event.target.value)} className={`${deskInput} font-mono`} aria-invalid={Boolean(errors.originId)}>
            <option value="">Select airport</option>
            {options.map(airport => <option key={airport.id} value={airport.id}>{airportLabel(airport)}</option>)}
          </select>
        </FormField>
        <FormField label="Destination" error={errors.destinationId} htmlFor="route-destination">
          <select id="route-destination" value={values.destinationId} disabled={locked} onChange={event => pickAirport('destinationId', event.target.value)} className={`${deskInput} font-mono`} aria-invalid={Boolean(errors.destinationId)}>
            <option value="">Select airport</option>
            {options.map(airport => <option key={airport.id} value={airport.id}>{airportLabel(airport)}</option>)}
          </select>
        </FormField>
        <FormField label="Route key">
          <Code className="text-[13px] text-foreground">{carrierCode || '--'}:{origin?.iataCode ?? '---'}:{destination?.iataCode ?? '---'}</Code>
        </FormField>
        {locked && <p className="text-xs text-muted-foreground">Airports locked: schedules use this route.</p>}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Distance (km)" error={errors.distance} htmlFor="route-distance">
            <input id="route-distance" inputMode="numeric" value={values.distance} onChange={event => setValues(current => ({ ...current, distance: event.target.value }))} className={`${deskInput} font-mono tabular-nums`} aria-invalid={Boolean(errors.distance)} />
          </FormField>
          <FormField label="Min. connection (min)" error={errors.connection} htmlFor="route-connection">
            <input id="route-connection" inputMode="numeric" value={values.connection} onChange={event => setValues(current => ({ ...current, connection: event.target.value }))} className={`${deskInput} font-mono tabular-nums`} aria-invalid={Boolean(errors.connection)} />
          </FormField>
        </div>
        <CheckField label="International" checked={values.isInternational} onChange={checked => setValues(current => ({ ...current, isInternational: checked }))} />
      </FormSheet>
    </DeskSection>
  )
}
