'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { Field, Notice, Panel, Pill, Track, deskInput } from '@/features/platform/components/desk'
import {
  createStationAssignment,
  setStationAssignmentStatus,
  updateStationAssignment,
} from '@/features/platform/stations/actions/stationAssignments'

export type StationCapabilities = { canCheckIn: boolean; canAcceptBags: boolean; canBoard: boolean }

export type StationAssignmentEditable = StationCapabilities & {
  id: string
  status: string | null
  validFrom: string | null
  validUntil: string | null
}

const CAPABILITIES: ReadonlyArray<{ key: keyof StationCapabilities; label: string }> = [
  { key: 'canCheckIn', label: 'Check-in' },
  { key: 'canAcceptBags', label: 'Bags' },
  { key: 'canBoard', label: 'Boarding' },
]

/** ISO instant to the browser-local value a datetime-local input expects. */
function toLocalInput(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Browser-local datetime-local value to an ISO instant. */
function fromLocalInput(value: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

function CapabilityToggles({ value, onChange }: { value: StationCapabilities; onChange: (next: StationCapabilities) => void }) {
  const labelId = React.useId()
  return (
    <div className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
      <span id={labelId}>Capabilities</span>
      <Track role="group" aria-labelledby={labelId} className="self-start">
        {CAPABILITIES.map(capability => (
          <Pill
            key={capability.key}
            size="sm"
            active={value[capability.key]}
            aria-pressed={value[capability.key]}
            onClick={() => onChange({ ...value, [capability.key]: !value[capability.key] })}
          >
            {capability.label}
          </Pill>
        ))}
      </Track>
    </div>
  )
}

function ValidityFields({ from, until, onFrom, onUntil }: { from: string; until: string; onFrom: (v: string) => void; onUntil: (v: string) => void }) {
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <Field label="Valid from">
        <input type="datetime-local" value={from} onChange={event => onFrom(event.target.value)} className={`${deskInput} font-mono tabular-nums`} />
      </Field>
      <Field label="Valid until">
        <input type="datetime-local" value={until} onChange={event => onUntil(event.target.value)} className={`${deskInput} font-mono tabular-nums`} />
      </Field>
    </div>
  )
}

export function NewStationAssignment({
  users,
  airports,
  defaultAirportId,
  defaultUserId,
}: {
  users: ReadonlyArray<{ id: string; name: string | null; email: string | null }>
  airports: ReadonlyArray<{ id: string; iataCode: string | null; name: string | null; city: string | null }>
  defaultAirportId?: string
  defaultUserId?: string
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [userId, setUserId] = React.useState(defaultUserId ?? '')
  const [airportId, setAirportId] = React.useState(defaultAirportId ?? '')
  const [capabilities, setCapabilities] = React.useState<StationCapabilities>({ canCheckIn: true, canAcceptBags: false, canBoard: false })
  const [from, setFrom] = React.useState('')
  const [until, setUntil] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  function openForm() {
    setError(null)
    setFrom(toLocalInput(new Date().toISOString()))
    setOpen(true)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createStationAssignment({
        userId,
        airportId,
        ...capabilities,
        validFrom: fromLocalInput(from),
        validUntil: fromLocalInput(until),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOpen(false)
      setUntil('')
      router.refresh()
    })
  }

  if (!open) {
    return (
      <Track>
        <Pill variant="primary" onClick={openForm}>New assignment</Pill>
      </Track>
    )
  }

  return (
    <Panel className="p-4">
      <form onSubmit={submit} className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">New assignment</h2>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <Field label="User">
            <select required value={userId} onChange={event => setUserId(event.target.value)} className={deskInput}>
              <option value="">Select user</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name || user.email || user.id}{user.name && user.email ? ` (${user.email})` : ''}</option>
              ))}
            </select>
          </Field>
          <Field label="Airport">
            <select required value={airportId} onChange={event => setAirportId(event.target.value)} className={`${deskInput} font-mono`}>
              <option value="">Select airport</option>
              {airports.map(airport => (
                <option key={airport.id} value={airport.id}>{airport.iataCode} {airport.city || airport.name || ''}</option>
              ))}
            </select>
          </Field>
        </div>
        <CapabilityToggles value={capabilities} onChange={setCapabilities} />
        <ValidityFields from={from} until={until} onFrom={setFrom} onUntil={setUntil} />
        {error && <Notice tone="bad">{error}</Notice>}
        <Track>
          <Pill type="submit" variant="primary" disabled={pending}>{pending ? 'Saving' : 'Create assignment'}</Pill>
          <Pill disabled={pending} onClick={() => setOpen(false)}>Cancel</Pill>
        </Track>
      </form>
    </Panel>
  )
}

export function StationAssignmentActions({ assignment }: { assignment: StationAssignmentEditable }) {
  const router = useRouter()
  const [editing, setEditing] = React.useState(false)
  const [capabilities, setCapabilities] = React.useState<StationCapabilities>({
    canCheckIn: Boolean(assignment.canCheckIn),
    canAcceptBags: Boolean(assignment.canAcceptBags),
    canBoard: Boolean(assignment.canBoard),
  })
  const [from, setFrom] = React.useState('')
  const [until, setUntil] = React.useState('')
  const [confirmRevoke, setConfirmRevoke] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  function startEdit() {
    setError(null)
    setCapabilities({ canCheckIn: Boolean(assignment.canCheckIn), canAcceptBags: Boolean(assignment.canAcceptBags), canBoard: Boolean(assignment.canBoard) })
    setFrom(toLocalInput(assignment.validFrom))
    setUntil(toLocalInput(assignment.validUntil))
    setEditing(true)
  }

  function transition(status: 'active' | 'suspended' | 'revoked') {
    setError(null)
    startTransition(async () => {
      const result = await setStationAssignmentStatus(assignment.id, status)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setConfirmRevoke(false)
      router.refresh()
    })
  }

  function save(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await updateStationAssignment({
        id: assignment.id,
        ...capabilities,
        validFrom: fromLocalInput(from),
        validUntil: fromLocalInput(until),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  const status = assignment.status ?? 'active'
  if (status === 'revoked') return null

  return (
    <div className="min-w-0 space-y-3">
      {!editing && (
        <Track aria-label="Assignment actions">
          <Pill size="sm" disabled={pending} onClick={startEdit}>Edit</Pill>
          {status === 'active' && <Pill size="sm" disabled={pending} onClick={() => transition('suspended')}>Suspend</Pill>}
          {status === 'suspended' && <Pill size="sm" disabled={pending} onClick={() => transition('active')}>Reactivate</Pill>}
          {confirmRevoke ? (
            <>
              <Pill size="sm" variant="danger" disabled={pending} onClick={() => transition('revoked')}>Confirm revoke</Pill>
              <Pill size="sm" disabled={pending} onClick={() => setConfirmRevoke(false)}>Keep</Pill>
            </>
          ) : (
            <Pill size="sm" disabled={pending} onClick={() => setConfirmRevoke(true)}>Revoke</Pill>
          )}
        </Track>
      )}
      {editing && (
        <form onSubmit={save} className="space-y-3 rounded-lg border bg-background p-3">
          <CapabilityToggles value={capabilities} onChange={setCapabilities} />
          <ValidityFields from={from} until={until} onFrom={setFrom} onUntil={setUntil} />
          <Track>
            <Pill type="submit" size="sm" variant="primary" disabled={pending}>{pending ? 'Saving' : 'Save'}</Pill>
            <Pill size="sm" disabled={pending} onClick={() => setEditing(false)}>Cancel</Pill>
          </Track>
        </form>
      )}
      {error && <Notice tone="bad">{error}</Notice>}
    </div>
  )
}
