'use client'

import * as React from 'react'

import { Code, DeskSection, Notice, Panel, Pill, TitleLine, Track, Well, deskInput } from '@/features/platform/components/desk'
import { registerAirportAction } from '@/features/platform/network/actions/airports'
import { newIdempotencyKey } from '@/features/platform/network/lib/desk-shared'
import type { AirportInput, AirportRow } from '@/features/platform/network/lib/types'
import { FormField, FormSheet, useDeskAction } from './DeskForm'

const EMPTY: Omit<AirportInput, 'idempotencyKey'> = { iataCode: '', icaoCode: '', name: '', city: '', countryCode: '', subdivisionCode: '', timezone: '' }

function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return value.includes('/') || value === 'UTC'
  } catch {
    return false
  }
}

function validate(values: typeof EMPTY) {
  const errors: Partial<Record<keyof typeof EMPTY, string>> = {}
  if (!/^[A-Z]{3}$/.test(values.iataCode.trim().toUpperCase())) errors.iataCode = 'Three letters.'
  if (values.icaoCode.trim() && !/^[A-Z]{4}$/.test(values.icaoCode.trim().toUpperCase())) errors.icaoCode = 'Four letters.'
  if (!values.name.trim()) errors.name = 'Required.'
  else if (values.name.trim().length > 160) errors.name = 'At most 160 characters.'
  if (!values.city.trim()) errors.city = 'Required.'
  else if (values.city.trim().length > 120) errors.city = 'At most 120 characters.'
  if (!/^[A-Z]{2}$/.test(values.countryCode.trim().toUpperCase())) errors.countryCode = 'Two-letter ISO code.'
  if (!validTimezone(values.timezone.trim())) errors.timezone = 'IANA timezone, such as Europe/London.'
  return errors
}

export function AirportsPanel({ airports, total, canRegister }: { airports: AirportRow[]; total: number; canRegister: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [values, setValues] = React.useState(EMPTY)
  const [errors, setErrors] = React.useState<ReturnType<typeof validate>>({})
  const [result, setResult] = React.useState<string | null>(null)
  // One key per distinct submission: a retry of the same values reuses it, changed values get a new one.
  const attempt = React.useRef<{ digest: string; key: string } | null>(null)
  const action = useDeskAction()

  const set = (field: keyof typeof EMPTY) => (event: React.ChangeEvent<HTMLInputElement>) => setValues(current => ({ ...current, [field]: event.target.value }))

  function openForm() {
    setValues(EMPTY)
    setResult(null)
    setErrors({})
    action.setError(null)
    attempt.current = null
    setOpen(true)
  }

  function submit() {
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    const digest = JSON.stringify(values)
    if (!attempt.current || attempt.current.digest !== digest) attempt.current = { digest, key: newIdempotencyKey('airport') }
    const key = attempt.current.key
    action.run(async () => {
      const response = await registerAirportAction({ ...values, idempotencyKey: key })
      if (response.ok) setResult(response.status === 'existing' ? `${values.iataCode.toUpperCase()} is already registered.` : `${values.iataCode.toUpperCase()} registered.`)
      return response
    }, () => { attempt.current = null; setOpen(false) })
  }

  return (
    <DeskSection
      title="Airports"
      count={total}
      actions={canRegister ? <Track><Pill variant="primary" size="sm" onClick={openForm}>Register airport</Pill></Track> : undefined}
    >
      <div className="space-y-3">
        {result && <Notice tone="ok">{result}</Notice>}
        {airports.length === 0 ? (
          <Well>No airports</Well>
        ) : (
          <Panel>
            <ul className="divide-y">
              {airports.map(airport => (
                <li key={airport.id} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
                  <div className="min-w-0 flex-1 basis-48">
                    <TitleLine tone={airport.isActive ? 'ok' : 'idle'} status={airport.isActive ? 'Active' : 'Inactive'} className="text-sm font-medium text-foreground">
                      <span className="tabular-nums font-semibold  tracking-wide">{airport.iataCode}</span>
                      {airport.icaoCode && <Code className="ml-2">{airport.icaoCode}</Code>}
                      <span className="ml-2">{airport.name}</span>
                    </TitleLine>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {airport.city}{airport.subdivisionCode ? `, ${airport.subdivisionCode}` : ''} <span className="tabular-nums ">{airport.countryCode}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-3 text-xs text-muted-foreground">
                    <span className="tabular-nums ">{airport.timezone}</span>
                    <span>{airport.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      <FormSheet open={open} onOpenChange={setOpen} title="Register airport" submitLabel="Register" pending={action.pending} error={action.error} onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="IATA code" error={errors.iataCode} htmlFor="airport-iata">
            <input id="airport-iata" value={values.iataCode} onChange={set('iataCode')} maxLength={3} autoComplete="off" className={`${deskInput} tabular-nums uppercase`} aria-invalid={Boolean(errors.iataCode)} />
          </FormField>
          <FormField label="ICAO code" error={errors.icaoCode} htmlFor="airport-icao">
            <input id="airport-icao" value={values.icaoCode} onChange={set('icaoCode')} maxLength={4} autoComplete="off" className={`${deskInput} tabular-nums uppercase`} aria-invalid={Boolean(errors.icaoCode)} />
          </FormField>
        </div>
        <FormField label="Name" error={errors.name} htmlFor="airport-name">
          <input id="airport-name" value={values.name} onChange={set('name')} maxLength={160} className={deskInput} aria-invalid={Boolean(errors.name)} />
        </FormField>
        <FormField label="City" error={errors.city} htmlFor="airport-city">
          <input id="airport-city" value={values.city} onChange={set('city')} maxLength={120} className={deskInput} aria-invalid={Boolean(errors.city)} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Country" error={errors.countryCode} htmlFor="airport-country">
            <input id="airport-country" value={values.countryCode} onChange={set('countryCode')} maxLength={2} autoComplete="off" className={`${deskInput} tabular-nums uppercase`} aria-invalid={Boolean(errors.countryCode)} />
          </FormField>
          <FormField label="Subdivision" htmlFor="airport-subdivision">
            <input id="airport-subdivision" value={values.subdivisionCode} onChange={set('subdivisionCode')} maxLength={6} autoComplete="off" className={`${deskInput} tabular-nums uppercase`} />
          </FormField>
        </div>
        <FormField label="Timezone" error={errors.timezone} htmlFor="airport-timezone">
          <input id="airport-timezone" value={values.timezone} onChange={set('timezone')} maxLength={64} autoComplete="off" placeholder="Europe/London" className={`${deskInput} tabular-nums`} aria-invalid={Boolean(errors.timezone)} />
        </FormField>
      </FormSheet>
    </DeskSection>
  )
}
