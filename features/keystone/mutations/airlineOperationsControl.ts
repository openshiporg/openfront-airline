import { Prisma } from '@prisma/client'
import type { Context } from '.keystone/types'

import { requireFreshPermission } from '../access'
import { DomainError } from '../lib/domain-error'
import { assertLifecycleTransition, getLifecycleTarget } from '../lib/lifecycle'
import { runSerializableTransaction, throwIfKeystonePrismaError } from '../lib/transactions'
import { beginOperation, finishOperation, inspectOperation, normalizeIdempotencyKey, randomReference, writeAudit } from './airlineOperations'

type ControlResult = { resourceType: string; resourceId: string; status: string; changed: boolean; replayed: boolean }

// Operator commands for the jobs that had no command: adding a station to the network, running a dated flight on
// the day (gates, times, departed, arrived) and tracking checked bags after acceptance.

function validTimezone(value: string) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true } catch { return false }
}

function optionalText(value: string | null | undefined, label: string, max: number) {
  if (value === undefined) return undefined
  const text = (value ?? '').trim()
  if (text.length > max) throw new DomainError(`${label} must be at most ${max} characters.`)
  return text || null
}

function optionalInstant(value: string | null | undefined, label: string) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const instant = new Date(value)
  if (Number.isNaN(instant.getTime())) throw new DomainError(`${label} is not a valid time.`)
  return instant
}

// Airports are global reference data shared by every carrier: this adds a new IATA code and never changes an
// existing airport.
export async function registerAirport(
  _root: unknown,
  args: { iataCode: string; icaoCode?: string | null; name: string; city: string; countryCode: string; subdivisionCode?: string | null; timezone: string; idempotencyKey: string },
  context: Context,
): Promise<ControlResult> {
  return runSerializableTransaction(context, async transactionContext => {
    const actor = await requireFreshPermission(transactionContext, 'canManageNetwork')
    const iataCode = args.iataCode.trim().toUpperCase()
    const icaoCode = args.icaoCode?.trim().toUpperCase() || null
    const countryCode = args.countryCode.trim().toUpperCase()
    const name = args.name.trim()
    const city = args.city.trim()
    const timezone = args.timezone.trim()
    if (!/^[A-Z]{3}$/.test(iataCode)) throw new DomainError('IATA code must be three letters.')
    if (icaoCode && !/^[A-Z]{4}$/.test(icaoCode)) throw new DomainError('ICAO code must be four letters.')
    if (!/^[A-Z]{2}$/.test(countryCode)) throw new DomainError('Country must be a two-letter ISO code.')
    if (!name || name.length > 160 || !city || city.length > 120) throw new DomainError('Airport name and city are required.')
    if (!validTimezone(timezone)) throw new DomainError('Timezone must be an IANA zone such as America/New_York.')
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const request = { iataCode, icaoCode, name, city, countryCode, timezone }
    const sudo = transactionContext.sudo() as any
    const inspected = await inspectOperation(sudo, actor.carrierId, key, 'airport.register', request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as ControlResult
    const prisma = transactionContext.prisma as any
    const existing = await prisma.airport.findUnique({ where: { iataCode }, select: { id: true } })
    const claim = await beginOperation(sudo, transactionContext, actor.carrierId, key, 'airport.register', request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as ControlResult
    if (existing) {
      const result = { resourceType: 'Airport', resourceId: existing.id, status: 'existing', changed: false, replayed: false }
      await finishOperation(sudo, claim.record.id, result)
      return result
    }
    if (icaoCode && await prisma.airport.findUnique({ where: { icaoCode }, select: { id: true } })) throw new DomainError(`ICAO code ${icaoCode} belongs to another airport.`)
    const airport = await prisma.airport.create({ data: { iataCode, icaoCode, name, city, countryCode, subdivisionCode: args.subdivisionCode?.trim().toUpperCase() || '', timezone, isActive: true }, select: { id: true } })
    await writeAudit(sudo, transactionContext, { carrierId: actor.carrierId, key: claim.storageKey, action: 'airport.register', aggregateType: 'Airport', aggregateId: airport.id, after: request })
    const result = { resourceType: 'Airport', resourceId: airport.id, status: 'created', changed: true, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}

const OPERATIONAL_STATUSES = ['delayed', 'departed', 'arrived'] as const

// Day-of-operation control for one dated flight: terminals, gates, estimated and actual times, and the delayed,
// departed and arrived states. Customers see these on flight status and their boarding pass snapshots.
export async function updateFlightOperations(
  _root: unknown,
  args: {
    flightInstanceId: string
    departureTerminal?: string | null; departureGate?: string | null; arrivalTerminal?: string | null; arrivalGate?: string | null
    estimatedDepartureAt?: string | null; estimatedArrivalAt?: string | null; actualDepartureAt?: string | null; actualArrivalAt?: string | null
    status?: string | null
    idempotencyKey: string
  },
  context: Context,
): Promise<ControlResult> {
  return runSerializableTransaction(context, async transactionContext => {
    const actor = await requireFreshPermission(transactionContext, 'canManageAirportService')
    const prisma = transactionContext.prisma as any
    const lock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" = ${args.flightInstanceId} FOR UPDATE`)
    throwIfKeystonePrismaError(lock)
    const flight = await prisma.flightInstance.findUnique({ where: { id: args.flightInstanceId } })
    if (!flight || (flight.carrierId !== actor.carrierId && !actor.canManageCarriers)) throw new DomainError('Dated flight not found or inaccessible.')
    const data: Record<string, unknown> = {}
    const texts = { departureTerminal: ['Departure terminal', 20], departureGate: ['Departure gate', 20], arrivalTerminal: ['Arrival terminal', 20], arrivalGate: ['Arrival gate', 20] } as const
    for (const [field, [label, max]] of Object.entries(texts)) {
      const value = optionalText((args as any)[field], label, max)
      if (value !== undefined) data[field] = value ?? ''
    }
    for (const [field, label] of [['estimatedDepartureAt', 'Estimated departure'], ['estimatedArrivalAt', 'Estimated arrival'], ['actualDepartureAt', 'Actual departure'], ['actualArrivalAt', 'Actual arrival']] as const) {
      const value = optionalInstant(args[field], label)
      if (value !== undefined) data[field] = value
    }
    const status = args.status?.trim() || null
    if (status && !(OPERATIONAL_STATUSES as readonly string[]).includes(status)) throw new DomainError('Status must be delayed, departed or arrived.')
    const nextActualDeparture = (data.actualDepartureAt as Date | null | undefined) ?? flight.actualDepartureAt
    const nextActualArrival = (data.actualArrivalAt as Date | null | undefined) ?? flight.actualArrivalAt
    if (status === 'departed' && !nextActualDeparture) data.actualDepartureAt = new Date()
    if (status === 'arrived' && !nextActualArrival) data.actualArrivalAt = new Date()
    const departure = (data.actualDepartureAt as Date | null | undefined) ?? flight.actualDepartureAt
    const arrival = (data.actualArrivalAt as Date | null | undefined) ?? flight.actualArrivalAt
    if (departure && arrival && arrival <= departure) throw new DomainError('Actual arrival must be after actual departure.')
    if (status) {
      assertLifecycleTransition('flightInstance', flight.status, status)
      if (status !== flight.status) data.status = status
    }
    if (!Object.keys(data).length) throw new DomainError('Nothing to update.')
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const request = { flightInstanceId: flight.id, ...Object.fromEntries(Object.entries(data).map(([field, value]) => [field, value instanceof Date ? value.toISOString() : value])) }
    const sudo = transactionContext.sudo() as any
    const inspected = await inspectOperation(sudo, flight.carrierId, key, 'dated-flight.operations', request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as ControlResult
    const claim = await beginOperation(sudo, transactionContext, flight.carrierId, key, 'dated-flight.operations', request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as ControlResult
    await prisma.flightInstance.update({ where: { id: flight.id }, data })
    // A departed flight stops selling; its buckets close with it.
    if (data.status === 'departed') await prisma.inventoryBucket.updateMany({ where: { flightInstanceId: flight.id, status: 'open' }, data: { status: 'closed' } })
    await writeAudit(sudo, transactionContext, {
      carrierId: flight.carrierId, key: claim.storageKey, action: 'dated-flight.operations', aggregateType: 'FlightInstance', aggregateId: flight.id,
      before: { status: flight.status, departureGate: flight.departureGate, departureTerminal: flight.departureTerminal }, after: request,
    })
    const result = { resourceType: 'FlightInstance', resourceId: flight.id, status: String(data.status ?? flight.status), changed: true, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}

const BAG_EVENT_TYPES: Record<string, string> = { load: 'loaded', transfer: 'transferred', arrive: 'arrived', deliver: 'delivered', delay: 'exception', mishandle: 'exception', close: 'exception' }

// Moves a checked bag through its lifecycle and records the scan as a bag event at a station.
export async function recordBagEvent(
  _root: unknown,
  args: { bagId: string; action: string; airportCode?: string | null; note?: string | null; idempotencyKey: string },
  context: Context,
): Promise<ControlResult> {
  return runSerializableTransaction(context, async transactionContext => {
    const actor = await requireFreshPermission(transactionContext, 'canManageAirportService')
    const prisma = transactionContext.prisma as any
    const lock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "Bag" WHERE "id" = ${args.bagId} FOR UPDATE`)
    throwIfKeystonePrismaError(lock)
    const bag = await prisma.bag.findUnique({ where: { id: args.bagId }, select: { id: true, carrierId: true, status: true, tagNumber: true } })
    if (!bag || (bag.carrierId !== actor.carrierId && !actor.canManageCarriers)) throw new DomainError('Bag not found or inaccessible.')
    const eventType = BAG_EVENT_TYPES[args.action]
    if (!eventType) throw new DomainError('Unsupported bag action.')
    const nextStatus = getLifecycleTarget('bag', args.action)
    assertLifecycleTransition('bag', bag.status, nextStatus)
    const airportCode = args.airportCode?.trim().toUpperCase() || null
    const airport = airportCode ? await prisma.airport.findUnique({ where: { iataCode: airportCode }, select: { id: true } }) : null
    if (airportCode && !airport) throw new DomainError(`Airport ${airportCode} is not in the network.`)
    const note = optionalText(args.note, 'Note', 300) ?? null
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const request = { bagId: bag.id, action: args.action, airportCode, note }
    const sudo = transactionContext.sudo() as any
    const inspected = await inspectOperation(sudo, bag.carrierId, key, 'bag.event', request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as ControlResult
    const claim = await beginOperation(sudo, transactionContext, bag.carrierId, key, 'bag.event', request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as ControlResult
    const now = new Date()
    await prisma.bag.update({ where: { id: bag.id }, data: { status: nextStatus, ...(nextStatus === 'delivered' ? { deliveredAt: now } : {}) } })
    await prisma.bagEvent.create({
      data: {
        carrierId: bag.carrierId, bagId: bag.id, airportId: airport?.id ?? null, eventKey: `${bag.id}:${randomReference('', 12)}`,
        eventType, statusSnapshot: nextStatus, source: 'agent', occurredAt: now, providerReference: '', payloadSummary: note ? { note } : {},
      },
    })
    await writeAudit(sudo, transactionContext, { carrierId: bag.carrierId, key: claim.storageKey, action: 'bag.event', aggregateType: 'Bag', aggregateId: bag.id, before: { status: bag.status }, after: { status: nextStatus, eventType, airportCode } })
    const result = { resourceType: 'Bag', resourceId: bag.id, status: nextStatus, changed: nextStatus !== bag.status, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}
