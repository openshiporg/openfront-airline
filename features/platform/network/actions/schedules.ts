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

const EXTEND_DAYS = 30

type ScheduleTemplate = {
  id: string
  status: string
  departureLocalTime: string
  arrivalLocalTime: string
  arrivalDayOffset: number | null
  daysOfWeek: unknown
  effectiveFrom: string | null
  effectiveTo: string | null
  instances: { serviceDate: string; inventoryBuckets: { capacity: number; baseAmount: number; taxAmount: number; currencyCode: string; cabin: { id: string } | null; fareBrand: { id: string } | null }[] }[]
}

// Creates the missing dated flights for the next 30 days of a published schedule, copying seats and fare from its
// largest existing dated flight. Runs when staff press the button; each day goes through provisionDatedFlight.
export async function extendScheduleAction(id: string): Promise<ActionResult> {
  const response = await operatorGraphql<{ flightSchedule: ScheduleTemplate | null }>(
    `query ScheduleToExtend($id:ID!){ flightSchedule(where:{ id:$id }){ id status departureLocalTime arrivalLocalTime arrivalDayOffset daysOfWeek effectiveFrom effectiveTo
      instances(orderBy:{ serviceDate:desc }, take:60){ serviceDate inventoryBuckets(take:1, orderBy:{ capacity:desc }){ capacity baseAmount taxAmount currencyCode cabin{ id } fareBrand{ id } } } } }`,
    { id },
  )
  if (!response.ok) return response
  const schedule = response.data.flightSchedule
  if (!schedule) return { ok: false, error: 'Schedule not found.' }
  if (schedule.status !== 'published') return { ok: false, error: 'Publish the schedule before creating flights.' }
  const template = schedule.instances.flatMap(instance => instance.inventoryBuckets).sort((a, b) => b.capacity - a.capacity)[0]
  if (!template?.cabin || !template.fareBrand) return { ok: false, error: 'This schedule has no dated flight to copy seats and fare from. Create one flight first.' }
  const existing = new Set(schedule.instances.map(instance => instance.serviceDate.slice(0, 10)))
  const days = Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek.map(Number) : []
  const from = schedule.effectiveFrom?.slice(0, 10)
  const to = schedule.effectiveTo?.slice(0, 10)
  const offset = schedule.arrivalDayOffset ?? 0
  let created = 0
  for (let ahead = 0; ahead <= EXTEND_DAYS; ahead += 1) {
    const day = new Date(Date.now() + ahead * 86_400_000)
    const date = day.toISOString().slice(0, 10)
    const isoDay = day.getUTCDay() || 7
    if (existing.has(date) || (days.length && !days.includes(isoDay)) || (from && date < from) || (to && date > to)) continue
    const arrival = new Date(`${date}T12:00:00.000Z`)
    arrival.setUTCDate(arrival.getUTCDate() + offset)
    const result = await operatorGraphql(
      `mutation ExtendSchedule($schedule:ID!,$cabin:ID!,$brand:ID!,$date:String!,$dep:String!,$arr:String!,$capacity:Int!,$base:Int!,$tax:Int!,$currency:String!,$key:String!){
        provisionDatedFlight(scheduleId:$schedule,cabinId:$cabin,fareBrandId:$brand,serviceDate:$date,scheduledDepartureAt:$dep,scheduledArrivalAt:$arr,capacity:$capacity,baseAmount:$base,taxAmount:$tax,currencyCode:$currency,idempotencyKey:$key){ resourceId }
      }`,
      {
        schedule: schedule.id, cabin: template.cabin.id, brand: template.fareBrand.id, date,
        dep: `${date}T${schedule.departureLocalTime}`, arr: `${arrival.toISOString().slice(0, 10)}T${schedule.arrivalLocalTime}`,
        capacity: template.capacity, base: template.baseAmount, tax: template.taxAmount, currency: template.currencyCode,
        key: `extend:${schedule.id}:${date}`,
      },
    )
    // A day whose departure has already passed is skipped; any other refusal stops with its message.
    if (!result.ok) {
      if (/must be in the future/i.test(result.error) && ahead === 0) continue
      revalidatePath(NETWORK_PATH)
      return { ok: false, error: `${created} flights created. ${result.error}` }
    }
    created += 1
  }
  revalidatePath(NETWORK_PATH)
  revalidatePath('/dashboard/platform/schedules')
  revalidatePath('/')
  revalidatePath('/destinations')
  return { ok: true }
}
