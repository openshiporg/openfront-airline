'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Field, Notice, Pill, Route, StatusLabel, Track, deskInput } from '@/features/platform/components/desk'
import { updateFlightOperationsAction } from '@/features/platform/flight-ops/actions/flight-operations'
import { airportLocalToInstant, airportZoneLabel, instantToAirportLocal } from '@/features/platform/flight-ops/lib/airport-time'
import type { FlightOperationsInput } from '@/features/platform/flight-ops/lib/types'

export type FlightOpsFlight = {
  id: string
  flightNumber: string | null
  status: string | null
  originCode: string | null
  destinationCode: string | null
  originTimezone: string | null
  destinationTimezone: string | null
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
}

type StatusAction = { status: 'delayed' | 'departed' | 'arrived'; label: string; from: readonly string[] }

// Mirrors the flightInstance lifecycle: only transitions the command will accept are offered.
const STATUS_ACTIONS: readonly StatusAction[] = [
  { status: 'delayed', label: 'Mark delayed', from: ['scheduled', 'open_for_sale', 'closed_for_sale'] },
  { status: 'departed', label: 'Departed', from: ['closed_for_sale', 'delayed'] },
  { status: 'arrived', label: 'Arrived', from: ['departed'] },
]

const TEXT_FIELDS = ['departureTerminal', 'departureGate', 'arrivalTerminal', 'arrivalGate'] as const
const TIME_FIELDS = [
  { field: 'estimatedDepartureAt', label: 'Estimated departure', side: 'origin' },
  { field: 'actualDepartureAt', label: 'Actual departure', side: 'origin' },
  { field: 'estimatedArrivalAt', label: 'Estimated arrival', side: 'destination' },
  { field: 'actualArrivalAt', label: 'Actual arrival', side: 'destination' },
] as const

type TextField = (typeof TEXT_FIELDS)[number]
type TimeField = (typeof TIME_FIELDS)[number]['field']
type Draft = Record<TextField | TimeField, string>

function draftFor(flight: FlightOpsFlight): Draft {
  return {
    departureTerminal: flight.departureTerminal ?? '',
    departureGate: flight.departureGate ?? '',
    arrivalTerminal: flight.arrivalTerminal ?? '',
    arrivalGate: flight.arrivalGate ?? '',
    estimatedDepartureAt: instantToAirportLocal(flight.estimatedDepartureAt, flight.originTimezone),
    actualDepartureAt: instantToAirportLocal(flight.actualDepartureAt, flight.originTimezone),
    estimatedArrivalAt: instantToAirportLocal(flight.estimatedArrivalAt, flight.destinationTimezone),
    actualArrivalAt: instantToAirportLocal(flight.actualArrivalAt, flight.destinationTimezone),
  }
}

export function FlightOpsControls({ flight, canManage }: { flight: FlightOpsFlight; canManage: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => draftFor(flight))
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()
  // One key per attempt: a retry of the same request reuses it, a different request gets a new one.
  const attempt = useRef<{ body: string; key: string } | null>(null)

  const status = flight.status ?? ''
  const statusActions = STATUS_ACTIONS.filter(action => action.from.includes(status))
  const terminal = status === 'cancelled'

  function send(changes: Omit<FlightOperationsInput, 'flightInstanceId' | 'idempotencyKey'>, onDone?: () => void) {
    const body = JSON.stringify(changes)
    if (!attempt.current || attempt.current.body !== body) attempt.current = { body, key: `flight-ops-${crypto.randomUUID()}` }
    const key = attempt.current.key
    setMessage(null)
    startTransition(async () => {
      const result = await updateFlightOperationsAction({ flightInstanceId: flight.id, ...changes, idempotencyKey: key })
      if (!result.success) {
        setMessage({ tone: 'bad', text: result.error })
        return
      }
      attempt.current = null
      setMessage({ tone: 'ok', text: `Saved. Status ${result.status.replaceAll('_', ' ')}.` })
      onDone?.()
      router.refresh()
    })
  }

  function changedFields() {
    const original = draftFor(flight)
    const changes: Omit<FlightOperationsInput, 'flightInstanceId' | 'idempotencyKey'> = {}
    for (const field of TEXT_FIELDS) {
      const next = draft[field].trim()
      if (next !== original[field].trim()) changes[field] = next
    }
    for (const { field, label, side } of TIME_FIELDS) {
      if (draft[field] === original[field]) continue
      if (!draft[field]) { changes[field] = null; continue }
      const iso = airportLocalToInstant(draft[field], side === 'origin' ? flight.originTimezone : flight.destinationTimezone)
      if (!iso) throw new Error(`${label} is not a valid time.`)
      changes[field] = iso
    }
    return changes
  }

  function save(event: React.FormEvent) {
    event.preventDefault()
    let changes
    try { changes = changedFields() } catch (error) {
      setMessage({ tone: 'bad', text: error instanceof Error ? error.message : 'Invalid time.' })
      return
    }
    if (!Object.keys(changes).length) { setMessage({ tone: 'bad', text: 'Nothing to update.' }); return }
    send(changes, () => setOpen(false))
  }

  function changeStatus(action: StatusAction) {
    if (!window.confirm(`${action.label}: ${flight.flightNumber ?? 'flight'} ${flight.originCode ?? ''}-${flight.destinationCode ?? ''}?`)) return
    send({ status: action.status })
  }

  if (!canManage) return null

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {!terminal && (
          <Track>
            <Pill size="sm" disabled={pending} onClick={() => { setDraft(draftFor(flight)); setMessage(null); setOpen(true) }}>Gates and times</Pill>
          </Track>
        )}
        {statusActions.length > 0 && (
          <Track role="group" aria-label="Flight status">
            {statusActions.map(action => (
              <Pill key={action.status} size="sm" disabled={pending} onClick={() => changeStatus(action)}>{action.label}</Pill>
            ))}
          </Track>
        )}
      </div>
      {message && !open && <Notice tone={message.tone}>{message.text}</Notice>}

      <Sheet open={open} onOpenChange={next => { if (!pending) setOpen(next) }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="pr-8 text-left">
            <SheetTitle className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono tabular-nums">{flight.flightNumber}</span>
              <Route from={flight.originCode} to={flight.destinationCode} />
            </SheetTitle>
            <SheetDescription asChild>
              <div><StatusLabel status={flight.status} /></div>
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={save} className="mt-4 space-y-5">
            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-semibold text-foreground">Departure <span className="font-mono text-xs font-normal text-muted-foreground">{flight.originCode} {airportZoneLabel(flight.scheduledDepartureAt, flight.originTimezone)}</span></legend>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Terminal"><input value={draft.departureTerminal} maxLength={20} onChange={e => setDraft({ ...draft, departureTerminal: e.target.value })} className={`${deskInput} font-mono uppercase`} /></Field>
                <Field label="Gate"><input value={draft.departureGate} maxLength={20} onChange={e => setDraft({ ...draft, departureGate: e.target.value })} className={`${deskInput} font-mono uppercase`} /></Field>
              </div>
              {TIME_FIELDS.filter(entry => entry.side === 'origin').map(entry => (
                <Field key={entry.field} label={entry.label}><input type="datetime-local" value={draft[entry.field]} onChange={e => setDraft({ ...draft, [entry.field]: e.target.value })} className={`${deskInput} font-mono tabular-nums`} /></Field>
              ))}
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-semibold text-foreground">Arrival <span className="font-mono text-xs font-normal text-muted-foreground">{flight.destinationCode} {airportZoneLabel(flight.scheduledArrivalAt, flight.destinationTimezone)}</span></legend>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Terminal"><input value={draft.arrivalTerminal} maxLength={20} onChange={e => setDraft({ ...draft, arrivalTerminal: e.target.value })} className={`${deskInput} font-mono uppercase`} /></Field>
                <Field label="Gate"><input value={draft.arrivalGate} maxLength={20} onChange={e => setDraft({ ...draft, arrivalGate: e.target.value })} className={`${deskInput} font-mono uppercase`} /></Field>
              </div>
              {TIME_FIELDS.filter(entry => entry.side === 'destination').map(entry => (
                <Field key={entry.field} label={entry.label}><input type="datetime-local" value={draft[entry.field]} onChange={e => setDraft({ ...draft, [entry.field]: e.target.value })} className={`${deskInput} font-mono tabular-nums`} /></Field>
              ))}
            </fieldset>
            {message && <Notice tone={message.tone}>{message.text}</Notice>}
            <Track>
              <Pill type="submit" variant="primary" disabled={pending}>{pending ? 'Saving' : 'Save'}</Pill>
              <Pill disabled={pending} onClick={() => setOpen(false)}>Cancel</Pill>
            </Track>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
