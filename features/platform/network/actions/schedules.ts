'use server'

import { revalidatePath } from 'next/cache'

import { operatorCarrier, operatorGraphql } from '@/features/platform/network/lib/operator-graphql'
import {
  allowedTransition,
  DATE_PATTERN,
  dateToTimestamp,
  FLIGHT_NUMBER_PATTERN,
  SCHEDULE_TRANSITIONS,
  TIME_PATTERN,
  type ActionResult,
} from '@/features/platform/network/lib/desk-shared'
import type { ScheduleInput } from '@/features/platform/network/lib/types'

const NETWORK_PATH = '/dashboard/platform/network'

function scheduleData(input: ScheduleInput): { ok: true; data: Record<string, unknown>; flightNumber: string } | { ok: false; error: string } {
  if (!input?.routeId) return { ok: false, error: 'Choose a route.' }
  const flightNumber = String(input.flightNumber ?? '').trim().toUpperCase()
  if (!FLIGHT_NUMBER_PATTERN.test(flightNumber)) return { ok: false, error: 'Flight number must be a carrier designator and service number, such as XY101.' }
  if (!TIME_PATTERN.test(input.departureLocalTime ?? '')) return { ok: false, error: 'Departure time must be HH:MM.' }
  if (!TIME_PATTERN.test(input.arrivalLocalTime ?? '')) return { ok: false, error: 'Arrival time must be HH:MM.' }
  const offset = Number(input.arrivalDayOffset ?? 0)
  if (!Number.isInteger(offset) || offset < -1 || offset > 2) return { ok: false, error: 'Arrival day offset must be between -1 and 2.' }
  const days = Array.isArray(input.daysOfWeek) ? input.daysOfWeek : []
  if (days.some(day => !Number.isInteger(day) || day < 1 || day > 7) || new Set(days).size !== days.length) return { ok: false, error: 'Days of week are invalid.' }
  if (days.length === 0) return { ok: false, error: 'Choose at least one day of week.' }
  const from = String(input.effectiveFrom ?? '')
  const to = String(input.effectiveTo ?? '')
  if (from && !DATE_PATTERN.test(from)) return { ok: false, error: 'Effective from must be a date.' }
  if (to && !DATE_PATTERN.test(to)) return { ok: false, error: 'Effective to must be a date.' }
  if (from && to && to < from) return { ok: false, error: 'Effective to must be on or after effective from.' }
  return {
    ok: true,
    flightNumber,
    data: {
      route: { connect: { id: input.routeId } },
      flightNumber,
      departureLocalTime: input.departureLocalTime,
      arrivalLocalTime: input.arrivalLocalTime,
      arrivalDayOffset: offset,
      daysOfWeek: [...days].sort((a, b) => a - b),
      effectiveFrom: dateToTimestamp(from),
      effectiveTo: dateToTimestamp(to),
    },
  }
}

export async function createScheduleAction(input: ScheduleInput): Promise<ActionResult> {
  const checked = scheduleData(input)
  if (!checked.ok) return checked
  const carrier = await operatorCarrier()
  if (!carrier.ok) return carrier
  const season = input.effectiveFrom ? input.effectiveFrom.replaceAll('-', '') : 'OPEN'
  const response = await operatorGraphql(
    'mutation CreateFlightSchedule($data:FlightScheduleCreateInput!){ createFlightSchedule(data:$data){ id } }',
    {
      data: {
        ...checked.data,
        carrier: { connect: { id: carrier.data.id } },
        operatingCarrier: { connect: { id: carrier.data.id } },
        scheduleKey: `${carrier.data.code}:${checked.flightNumber.replace(/\s+/g, '')}:${season}`,
        status: 'draft',
      },
    },
  )
  if (!response.ok) return response
  revalidatePath(NETWORK_PATH)
  return { ok: true }
}

export async function updateScheduleAction(id: string, input: ScheduleInput): Promise<ActionResult> {
  const checked = scheduleData(input)
  if (!checked.ok) return checked
  const current = await operatorGraphql<{ flightSchedule: { route: { id: string } | null } | null }>(
    'query ScheduleForUpdate($id:ID!){ flightSchedule(where:{ id:$id }){ route { id } } }',
    { id },
  )
  if (!current.ok) return current
  if (!current.data.flightSchedule) return { ok: false, error: 'Schedule not found.' }
  const data = { ...checked.data }
  if (current.data.flightSchedule.route?.id === input.routeId) delete data.route
  const response = await operatorGraphql(
    'mutation UpdateFlightSchedule($id:ID!,$data:FlightScheduleUpdateInput!){ updateFlightSchedule(where:{ id:$id }, data:$data){ id } }',
    { id, data },
  )
  if (!response.ok) return response
  revalidatePath(NETWORK_PATH)
  return { ok: true }
}

export async function setScheduleStatusAction(id: string, to: string): Promise<ActionResult> {
  const current = await operatorGraphql<{ flightSchedule: { status: string } | null }>('query ScheduleStatus($id:ID!){ flightSchedule(where:{ id:$id }){ status } }', { id })
  if (!current.ok) return current
  const from = current.data.flightSchedule?.status
  if (!from) return { ok: false, error: 'Schedule not found.' }
  if (!allowedTransition(SCHEDULE_TRANSITIONS, from, to)) return { ok: false, error: `Schedule cannot move from ${from} to ${to}.` }
  const response = await operatorGraphql(
    'mutation SetScheduleStatus($id:ID!,$status:FlightScheduleStatusType!){ updateFlightSchedule(where:{ id:$id }, data:{ status:$status }){ id } }',
    { id, status: to },
  )
  if (!response.ok) return response
  revalidatePath(NETWORK_PATH)
  revalidatePath('/dashboard/platform/schedules')
  return { ok: true }
}
