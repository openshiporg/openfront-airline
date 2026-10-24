'use client'

import * as React from 'react'
import Link from 'next/link'

import { Code, DeskSection, Panel, Pill, Route, StatusLabel, TitleLine, Track, Well, deskInput, statusTone } from '@/features/platform/components/desk'
import { createScheduleAction, setScheduleStatusAction, updateScheduleAction } from '@/features/platform/network/actions/schedules'
import { dateInput, FLIGHT_NUMBER_PATTERN, SCHEDULE_TRANSITIONS, TIME_PATTERN, WEEKDAYS } from '@/features/platform/network/lib/desk-shared'
import type { RouteOption, ScheduleRow } from '@/features/platform/network/lib/types'
import { cn } from '@/lib/utils'
import { DeskRow, FormField, FormSheet, TransitionPills, useDeskAction } from './DeskForm'

type Values = {
  routeId: string
  flightNumber: string
  departureLocalTime: string
  arrivalLocalTime: string
  arrivalDayOffset: string
  daysOfWeek: number[]
  effectiveFrom: string
  effectiveTo: string
}
type Errors = Partial<Record<keyof Values, string>>

const ALL_DAYS = WEEKDAYS.map(day => day.value)

function scheduleDays(value: unknown): number[] {
  const days = Array.isArray(value) ? value.filter((day): day is number => Number.isInteger(day) && day >= 1 && day <= 7) : []
  return days.length ? days : ALL_DAYS
}

function DayChips({ days }: { days: number[] }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`Operates ${WEEKDAYS.filter(day => days.includes(day.value)).map(day => day.short).join(' ')}`}>
      {WEEKDAYS.map(day => (
        <span
          key={day.value}
          aria-hidden="true"
          className={cn(
            'inline-flex h-5 w-8 items-center justify-center rounded-md font-mono text-[10px] font-medium tabular-nums',
            days.includes(day.value) ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground/60',
          )}
        >
          {day.short}
        </span>
      ))}
    </span>
  )
}

function ScheduleItem({ schedule, onEdit }: { schedule: ScheduleRow; onEdit: () => void }) {
  const action = useDeskAction()
  const offset = schedule.arrivalDayOffset ?? 0
  return (
    <DeskRow
      error={action.error}
      actions={
        <TransitionPills
          transitions={SCHEDULE_TRANSITIONS[schedule.status] ?? []}
          disabled={action.pending}
          onEdit={schedule.status === 'retired' ? undefined : onEdit}
          onTransition={to => action.run(() => setScheduleStatusAction(schedule.id, to))}
        />
      }
    >
      <TitleLine tone={statusTone(schedule.status)} status={schedule.status} className="text-sm font-medium text-foreground">
        <span className="font-mono font-semibold tabular-nums tracking-wide">{schedule.flightNumber}</span>
        <Route from={schedule.route?.origin?.iataCode} to={schedule.route?.destination?.iataCode} className="ml-2" />
      </TitleLine>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <StatusLabel status={schedule.status} />
        <span className="font-mono tabular-nums text-foreground">
          {schedule.departureLocalTime} - {schedule.arrivalLocalTime}{offset !== 0 ? ` ${offset > 0 ? '+' : ''}${offset}` : ''}
        </span>
        <DayChips days={scheduleDays(schedule.daysOfWeek)} />
        <span className="font-mono tabular-nums">{dateInput(schedule.effectiveFrom) || 'Open'} / {dateInput(schedule.effectiveTo) || 'Open'}</span>
        <span className="font-mono tabular-nums">{schedule.instancesCount ?? 0} flights</span>
        <Code>{schedule.scheduleKey}</Code>
      </div>
    </DeskRow>
  )
}

export function SchedulesPanel({
  schedules,
  total,
  routes,
  carrierCode,
  statusTabs,
  pager,
  routeFilter,
}: {
  schedules: ScheduleRow[]
  total: number
  routes: RouteOption[]
  carrierCode: string
  statusTabs: React.ReactNode
  pager: React.ReactNode
  routeFilter?: { label: string; clearHref: string } | null
}) {
  const [editing, setEditing] = React.useState<ScheduleRow | 'new' | null>(null)
  const [values, setValues] = React.useState<Values | null>(null)
  const [errors, setErrors] = React.useState<Errors>({})
  const action = useDeskAction()

  const routeOptions = React.useMemo(() => {
    const list = routes.filter(route => route.status !== 'archived')
    if (editing && editing !== 'new' && editing.route && !list.some(route => route.id === editing.route?.id)) return [editing.route, ...list]
    return list
  }, [routes, editing])

  function open(schedule: ScheduleRow | 'new') {
    setErrors({})
    action.setError(null)
    setValues(schedule === 'new'
      ? { routeId: '', flightNumber: carrierCode, departureLocalTime: '', arrivalLocalTime: '', arrivalDayOffset: '0', daysOfWeek: ALL_DAYS, effectiveFrom: '', effectiveTo: '' }
      : {
        routeId: schedule.route?.id ?? '',
        flightNumber: schedule.flightNumber,
        departureLocalTime: schedule.departureLocalTime,
        arrivalLocalTime: schedule.arrivalLocalTime,
        arrivalDayOffset: String(schedule.arrivalDayOffset ?? 0),
        daysOfWeek: scheduleDays(schedule.daysOfWeek),
        effectiveFrom: dateInput(schedule.effectiveFrom),
        effectiveTo: dateInput(schedule.effectiveTo),
      })
    setEditing(schedule)
  }

  function update<K extends keyof Values>(field: K, value: Values[K]) {
    setValues(current => current ? { ...current, [field]: value } : current)
  }

  function toggleDay(day: number) {
    setValues(current => {
      if (!current) return current
      const days = current.daysOfWeek.includes(day) ? current.daysOfWeek.filter(value => value !== day) : [...current.daysOfWeek, day].sort((a, b) => a - b)
      return { ...current, daysOfWeek: days }
    })
  }

  function submit() {
    if (!values) return
    const flightNumber = values.flightNumber.trim().toUpperCase()
    const nextErrors: Errors = {}
    if (!values.routeId) nextErrors.routeId = 'Required.'
    if (!FLIGHT_NUMBER_PATTERN.test(flightNumber)) nextErrors.flightNumber = 'Designator and number, such as XY101.'
    if (!TIME_PATTERN.test(values.departureLocalTime)) nextErrors.departureLocalTime = 'HH:MM, 24-hour.'
    if (!TIME_PATTERN.test(values.arrivalLocalTime)) nextErrors.arrivalLocalTime = 'HH:MM, 24-hour.'
    if (!values.daysOfWeek.length) nextErrors.daysOfWeek = 'Choose at least one day.'
    if (values.effectiveFrom && values.effectiveTo && values.effectiveTo < values.effectiveFrom) nextErrors.effectiveTo = 'On or after effective from.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    const input = { ...values, flightNumber, arrivalDayOffset: Number(values.arrivalDayOffset) }
    const target = editing
    action.run(() => target && target !== 'new' ? updateScheduleAction(target.id, input) : createScheduleAction(input), () => setEditing(null))
  }

  return (
    <DeskSection
      title="Schedules"
      count={total}
      actions={
        <Track>
          <Pill asChild size="sm"><Link href="/dashboard/platform/schedules">Dated flights</Link></Pill>
          <Pill variant="primary" size="sm" onClick={() => open('new')}>New schedule</Pill>
        </Track>
      }
    >
      <div className="space-y-3">
        {routeFilter && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Route</span>
            <span className="font-mono font-semibold tabular-nums">{routeFilter.label}</span>
            <Track><Pill asChild size="sm"><Link href={routeFilter.clearHref}>All routes</Link></Pill></Track>
          </div>
        )}
        {statusTabs}
        {schedules.length === 0 ? (
          <Well>No schedules</Well>
        ) : (
          <Panel>
            <ul className="divide-y">
              {schedules.map(schedule => <ScheduleItem key={schedule.id} schedule={schedule} onEdit={() => open(schedule)} />)}
            </ul>
          </Panel>
        )}
        {pager}
      </div>

      <FormSheet
        open={editing !== null && values !== null}
        onOpenChange={next => { if (!next) setEditing(null) }}
        title={editing === 'new' ? 'New schedule' : 'Edit schedule'}
        submitLabel={editing === 'new' ? 'Create schedule' : 'Save schedule'}
        pending={action.pending}
        error={action.error}
        onSubmit={submit}
      >
        {values && (
          <>
            <FormField label="Route" error={errors.routeId} htmlFor="schedule-route">
              <select id="schedule-route" value={values.routeId} onChange={event => update('routeId', event.target.value)} className={`${deskInput} font-mono`} aria-invalid={Boolean(errors.routeId)}>
                <option value="">Select route</option>
                {routeOptions.map(route => (
                  <option key={route.id} value={route.id}>{route.origin?.iataCode ?? '---'}-{route.destination?.iataCode ?? '---'} ({route.status})</option>
                ))}
              </select>
            </FormField>
            <FormField label="Flight number" error={errors.flightNumber} htmlFor="schedule-flight">
              <input id="schedule-flight" value={values.flightNumber} onChange={event => update('flightNumber', event.target.value)} maxLength={9} autoComplete="off" className={`${deskInput} font-mono uppercase tabular-nums`} aria-invalid={Boolean(errors.flightNumber)} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Departure (local)" error={errors.departureLocalTime} htmlFor="schedule-departure">
                <input id="schedule-departure" type="time" value={values.departureLocalTime} onChange={event => update('departureLocalTime', event.target.value.slice(0, 5))} className={`${deskInput} font-mono tabular-nums`} aria-invalid={Boolean(errors.departureLocalTime)} />
              </FormField>
              <FormField label="Arrival (local)" error={errors.arrivalLocalTime} htmlFor="schedule-arrival">
                <input id="schedule-arrival" type="time" value={values.arrivalLocalTime} onChange={event => update('arrivalLocalTime', event.target.value.slice(0, 5))} className={`${deskInput} font-mono tabular-nums`} aria-invalid={Boolean(errors.arrivalLocalTime)} />
              </FormField>
            </div>
            <FormField label="Arrival day">
              <Track aria-label="Arrival day offset" block>
                {['-1', '0', '1', '2'].map(offset => (
                  <Pill key={offset} size="sm" active={values.arrivalDayOffset === offset} aria-pressed={values.arrivalDayOffset === offset} onClick={() => update('arrivalDayOffset', offset)} className="font-mono tabular-nums">
                    {offset === '0' ? 'Same day' : offset === '-1' ? '-1' : `+${offset}`}
                  </Pill>
                ))}
              </Track>
            </FormField>
            <FormField label="Days of week" error={errors.daysOfWeek}>
              <Track aria-label="Days of week" block>
                {WEEKDAYS.map(day => (
                  <Pill key={day.value} size="sm" active={values.daysOfWeek.includes(day.value)} aria-pressed={values.daysOfWeek.includes(day.value)} onClick={() => toggleDay(day.value)} className="px-1.5 font-mono">
                    {day.short}
                  </Pill>
                ))}
              </Track>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Effective from" htmlFor="schedule-from">
                <input id="schedule-from" type="date" value={values.effectiveFrom} onChange={event => update('effectiveFrom', event.target.value)} className={`${deskInput} font-mono tabular-nums`} />
              </FormField>
              <FormField label="Effective to" error={errors.effectiveTo} htmlFor="schedule-to">
                <input id="schedule-to" type="date" value={values.effectiveTo} onChange={event => update('effectiveTo', event.target.value)} className={`${deskInput} font-mono tabular-nums`} aria-invalid={Boolean(errors.effectiveTo)} />
              </FormField>
            </div>
          </>
        )}
      </FormSheet>
    </DeskSection>
  )
}
