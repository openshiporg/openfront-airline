import { Prisma } from '@prisma/client'
import type { Context } from '.keystone/types'

import { requireFreshCarrierPermission, requireFreshPermission } from '../access'
import { assertLifecycleTransition } from '../lib/lifecycle'
import { assertInventoryCounts } from '../lib/validation'
import { runSerializableTransaction, throwIfKeystonePrismaError } from '../lib/transactions'
import { beginOperation, finishOperation, inspectOperation, normalizeIdempotencyKey, writeAudit } from './airlineOperations'
import { normalizeSearchDate } from './airlineWorkflows'
import { supportedCurrencyCode } from '../lib/currency-policy'
import { checkedMinorTotal } from '../lib/money'
import { DomainError } from '../lib/domain-error'

type ProvisioningResult = { resourceType: string; resourceId: string; status: string; changed: boolean; replayed: boolean }

const launchSeatColumns = ['A', 'B', 'C', 'D', 'E', 'F'] as const

export type DatedFlightRecordInput = {
  carrierId: string
  carrierCode: string
  scheduleId: string
  routeId: string
  originId: string
  destinationId: string
  operatingCarrierId: string
  flightNumber: string
  serviceDate: string
  scheduledDepartureAt: Date
  scheduledArrivalAt: Date
  cabinId: string
  cabinCode: string
  fareBrandId: string
  fareBrandCode: string
  capacity: number
  baseAmount: number
  taxAmount: number
  currencyCode: string
  departureTerminal?: string | null
  departureGate?: string | null
}

export async function createDatedFlightRecords(tx: any, input: DatedFlightRecordInput, query?: any) {
  const instanceKey = `${input.carrierCode}:${input.flightNumber}:${input.serviceDate}`
  const existing = await tx.flightInstance.findUnique({ where: { instanceKey }, select: { id: true, carrierId: true, scheduleId: true, routeId: true, originId: true, destinationId: true, operatingCarrierId: true, flightNumber: true, serviceDate: true, scheduledDepartureAt: true, scheduledArrivalAt: true, status: true } })
  if (existing) {
    if (existing.carrierId !== input.carrierId) throw new DomainError('Dated-flight identity belongs to another carrier.')
    const bucket = await tx.inventoryBucket.findUnique({ where: { bucketKey: `${instanceKey}:${input.cabinCode}:${input.fareBrandCode}` } })
    const seatMap = await tx.seatMap.findUnique({ where: { mapKey: `${instanceKey}:${input.cabinCode}` }, include: { _count: { select: { seats: true } } } })
    const retainedSeats = seatMap ? await tx.seat.findMany({ where: { seatMapId: seatMap.id }, orderBy: [{ rowNumber: 'asc' }, { columnCode: 'asc' }] }) : []
    const expectedSeats = Array.from({ length: input.capacity }, (_, index) => ({ rowNumber: Math.floor(index / launchSeatColumns.length) + 1, columnCode: launchSeatColumns[index % launchSeatColumns.length] }))
    const seatCatalogMatches = retainedSeats.length === expectedSeats.length && retainedSeats.every((seat: any, index: number) => {
      const expected = expectedSeats[index]
      const designator = `${expected.rowNumber}${expected.columnCode}`
      return seat.carrierId === input.carrierId && seat.seatMapId === seatMap?.id && seat.cabinId === input.cabinId
        && seat.seatKey === `${instanceKey}:${designator}` && seat.designator === designator && seat.rowNumber === expected.rowNumber && seat.columnCode === expected.columnCode
        && ['available', 'blocked', 'unavailable'].includes(seat.status) && seat.seatType === 'standard' && seat.surchargeAmount === 0 && seat.currencyCode === input.currencyCode
    })
    const layout = (seatMap?.layoutSnapshot ?? {}) as Record<string, unknown>
    const serviceDate = new Date(`${input.serviceDate}T00:00:00.000Z`)
    const sameInput = existing.scheduleId === input.scheduleId && existing.routeId === input.routeId && existing.originId === input.originId && existing.destinationId === input.destinationId
      && existing.operatingCarrierId === input.operatingCarrierId && existing.flightNumber === input.flightNumber && existing.serviceDate.getTime() === serviceDate.getTime()
      && existing.scheduledDepartureAt.getTime() === input.scheduledDepartureAt.getTime() && existing.scheduledArrivalAt.getTime() === input.scheduledArrivalAt.getTime()
      && ['scheduled', 'open_for_sale'].includes(existing.status)
      && bucket?.carrierId === input.carrierId && bucket?.flightInstanceId === existing.id && bucket?.bookingClassCode === input.cabinCode
      && bucket?.cabinId === input.cabinId && bucket?.fareBrandId === input.fareBrandId && bucket?.capacity === input.capacity && bucket?.status === 'open'
      && bucket?.authorized >= bucket?.sold + bucket?.held + bucket?.blocked && bucket?.authorized <= bucket?.capacity
      && bucket?.baseAmount === input.baseAmount && bucket?.taxAmount === input.taxAmount && bucket?.currencyCode === input.currencyCode
      && seatMap?.carrierId === input.carrierId && seatMap?.flightInstanceId === existing.id && seatMap?.status === 'published' && seatMap?.version === 1
      && seatMap?._count.seats === input.capacity && layout.rows === Math.ceil(input.capacity / launchSeatColumns.length)
      && Array.isArray(layout.columns) && JSON.stringify(layout.columns) === JSON.stringify(launchSeatColumns) && layout.generatedForCapacity === input.capacity && seatCatalogMatches
    if (!bucket || !seatMap || !sameInput) throw new DomainError('Existing dated service or retained seat/inventory catalog differs from this request; replay will not overwrite retained commercial records.')
    return { flight: existing, bucket, seatMap, changed: false }
  }
  const flightData = {
    carrier: { connect: { id: input.carrierId } }, instanceKey,
    schedule: { connect: { id: input.scheduleId } }, route: { connect: { id: input.routeId } },
    origin: { connect: { id: input.originId } }, destination: { connect: { id: input.destinationId } }, operatingCarrier: { connect: { id: input.operatingCarrierId } },
    flightNumber: input.flightNumber, serviceDate: `${input.serviceDate}T00:00:00.000Z`, scheduledDepartureAt: input.scheduledDepartureAt.toISOString(), scheduledArrivalAt: input.scheduledArrivalAt.toISOString(),
    departureTerminal: input.departureTerminal ?? '', departureGate: input.departureGate ?? '', status: 'open_for_sale',
  }
  const flight = query
    ? await query.FlightInstance.createOne({ data: flightData, query: 'id status' })
    : await tx.flightInstance.create({ data: { carrierId: input.carrierId, instanceKey, scheduleId: input.scheduleId, routeId: input.routeId, originId: input.originId, destinationId: input.destinationId, operatingCarrierId: input.operatingCarrierId, flightNumber: input.flightNumber, serviceDate: new Date(`${input.serviceDate}T00:00:00.000Z`), scheduledDepartureAt: input.scheduledDepartureAt, scheduledArrivalAt: input.scheduledArrivalAt, departureTerminal: input.departureTerminal ?? '', departureGate: input.departureGate ?? '', status: 'open_for_sale' } })
  const bucketData = { carrier: { connect: { id: input.carrierId } }, bucketKey: `${instanceKey}:${input.cabinCode}:${input.fareBrandCode}`, flightInstance: { connect: { id: flight.id } }, cabin: { connect: { id: input.cabinId } }, fareBrand: { connect: { id: input.fareBrandId } }, bookingClassCode: input.cabinCode, capacity: input.capacity, authorized: input.capacity, sold: 0, held: 0, blocked: 0, baseAmount: input.baseAmount, taxAmount: input.taxAmount, currencyCode: input.currencyCode, status: 'open' }
  const bucket = query
    ? await query.InventoryBucket.createOne({ data: bucketData, query: 'id status authorized sold held blocked capacity baseAmount taxAmount currencyCode' })
    : await tx.inventoryBucket.create({ data: { carrierId: input.carrierId, bucketKey: `${instanceKey}:${input.cabinCode}:${input.fareBrandCode}`, flightInstanceId: flight.id, cabinId: input.cabinId, fareBrandId: input.fareBrandId, bookingClassCode: input.cabinCode, capacity: input.capacity, authorized: input.capacity, sold: 0, held: 0, blocked: 0, baseAmount: input.baseAmount, taxAmount: input.taxAmount, currencyCode: input.currencyCode, status: 'open' } })
  const columns = [...launchSeatColumns]
  const rowCount = Math.ceil(input.capacity / columns.length)
  const seatMapData = { carrier: { connect: { id: input.carrierId } }, mapKey: `${instanceKey}:${input.cabinCode}`, flightInstance: { connect: { id: flight.id } }, version: 1, status: 'published', layoutSnapshot: { rows: rowCount, columns, generatedForCapacity: input.capacity } }
  const seatMap = query
    ? await query.SeatMap.createOne({ data: seatMapData, query: 'id status' })
    : await tx.seatMap.create({ data: { carrierId: input.carrierId, mapKey: `${instanceKey}:${input.cabinCode}`, flightInstanceId: flight.id, version: 1, status: 'published', layoutSnapshot: { rows: rowCount, columns, generatedForCapacity: input.capacity } } })
  let seatIndex = 0
  for (let row = 1; row <= rowCount && seatIndex < input.capacity; row += 1) {
    for (const columnCode of columns) {
      if (seatIndex >= input.capacity) break
      const designator = `${row}${columnCode}`
      const seatData = { carrier: { connect: { id: input.carrierId } }, seatKey: `${instanceKey}:${designator}`, seatMap: { connect: { id: seatMap.id } }, cabin: { connect: { id: input.cabinId } }, designator, rowNumber: row, columnCode, status: 'available', seatType: 'standard', characteristics: [], surchargeAmount: 0, currencyCode: input.currencyCode }
      if (query) await query.Seat.createOne({ data: seatData, query: 'id' })
      else await tx.seat.create({ data: { carrierId: input.carrierId, seatKey: `${instanceKey}:${designator}`, seatMapId: seatMap.id, cabinId: input.cabinId, designator, rowNumber: row, columnCode, status: 'available', seatType: 'standard', characteristics: [], surchargeAmount: 0, currencyCode: input.currencyCode } })
      seatIndex += 1
    }
  }
  return { flight, bucket, seatMap, changed: true }
}

export function serviceDateInTimezone(value: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value)
    const part = (type: 'year' | 'month' | 'day') => parts.find(entry => entry.type === type)?.value ?? ''
    const result = `${part('year')}-${part('month')}-${part('day')}`
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new DomainError('invalid formatted date')
    return result
  } catch {
    throw new DomainError('Carrier timezone must be a valid IANA timezone for dated service.')
  }
}

function dateTime(value: string, label: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new DomainError(`${label} must be a valid date-time.`)
  return parsed
}

export function zonedLocalDateTime(value: string, timezone: string, label: string) {
  if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return dateTime(value, label)
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) throw new DomainError(`${label} must be a local date-time or an ISO date-time with offset.`)
  const target = match.slice(1).map((part, index) => index === 5 && !part ? 0 : Number(part))
  const targetUtc = Date.UTC(target[0], target[1] - 1, target[2], target[3], target[4], target[5] ?? 0)
  let instant = targetUtc
  let formatter: Intl.DateTimeFormat
  try { formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
  catch { throw new DomainError(`${label} is not valid in the carrier timezone.`) }
  const partsAt = (timestamp: number) => {
    const parts = formatter.formatToParts(new Date(timestamp))
    const part = (type: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second') => Number(parts.find(entry => entry.type === type)?.value)
    return [part('year'), part('month'), part('day'), part('hour'), part('minute'), part('second')]
  }
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const rendered = partsAt(instant)
      const renderedUtc = Date.UTC(rendered[0], rendered[1] - 1, rendered[2], rendered[3], rendered[4], rendered[5])
      instant += targetUtc - renderedUtc
    }
    const rendered = partsAt(instant)
    if (rendered.some((part, index) => part !== target[index])) throw new DomainError('nonexistent local time')
    if ([-3_600_000, 3_600_000].some(delta => partsAt(instant + delta).every((part, index) => part === target[index]))) throw new DomainError('ambiguous local time')
    return new Date(instant)
  } catch {
    throw new DomainError(`${label} is not valid in the carrier timezone.`)
  }
}

export async function provisionDatedFlight(
  _root: unknown,
  args: {
    scheduleId: string
    cabinId: string
    fareBrandId: string
    serviceDate: string
    scheduledDepartureAt: string
    scheduledArrivalAt: string
    capacity: number
    baseAmount: number
    taxAmount: number
    currencyCode: string
    departureTerminal?: string | null
    departureGate?: string | null
    idempotencyKey: string
  },
  context: Context,
): Promise<ProvisioningResult> {
  return runSerializableTransaction(context, async transactionContext => {
    const actor = await requireFreshPermission(transactionContext, 'canManageNetwork')
    await requireFreshPermission(transactionContext, 'canManageInventory')
    let schedule = await (transactionContext.prisma as any).flightSchedule.findUnique({
      where: { id: args.scheduleId },
      include: { carrier: true, route: true, operatingCarrier: true },
    })
    const cabin = await (transactionContext.prisma as any).cabin.findUnique({ where: { id: args.cabinId } })
    const fareBrand = await (transactionContext.prisma as any).fareBrand.findUnique({ where: { id: args.fareBrandId } })
    if (!schedule?.carrierId || !schedule.route || !schedule.operatingCarrierId || !cabin || !fareBrand || schedule.carrierId !== actor.carrierId || cabin.carrierId !== actor.carrierId || fareBrand.carrierId !== actor.carrierId || fareBrand.cabinId !== cabin.id) throw new DomainError('Provisioning catalog records were not found in the current carrier.')
    const serviceDate = normalizeSearchDate(args.serviceDate)
    const currencyCode = String(args.currencyCode).trim().toUpperCase()
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const request = { ...args, serviceDate, currencyCode }
    const sudo = transactionContext.sudo() as any
    await requireFreshCarrierPermission(transactionContext, 'canManageNetwork', schedule.carrierId)
    const inspected = await inspectOperation(sudo, actor.carrierId, key, 'dated-flight.provision', request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as ProvisioningResult
    if (fareBrand.status !== 'active') throw new DomainError('Dated service requires an active fare brand.')
    await requireFreshCarrierPermission(transactionContext, 'canManageNetwork', schedule.carrierId)
    if (schedule.status !== 'published') throw new DomainError('Only a published schedule can create sellable dated service.')
    const serviceDay = new Date(`${serviceDate}T00:00:00.000Z`)
    if (serviceDay < new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z') || serviceDay > new Date(Date.now() + 550 * 86_400_000)) throw new DomainError('Service date must be today through 18 months from now.')
    if (schedule.effectiveFrom && serviceDay < schedule.effectiveFrom || schedule.effectiveTo && serviceDay > schedule.effectiveTo) throw new DomainError('Service date is outside the schedule effective period.')
    const days = Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek.map(Number) : []
    const isoDay = serviceDay.getUTCDay() || 7
    if (days.length && !days.includes(isoDay)) throw new DomainError('The schedule does not operate on this service day.')
    const departure = zonedLocalDateTime(args.scheduledDepartureAt, schedule.carrier.defaultTimezone, 'Scheduled departure')
    const arrival = zonedLocalDateTime(args.scheduledArrivalAt, schedule.carrier.defaultTimezone, 'Scheduled arrival')
    if (departure <= new Date() || arrival <= departure || arrival.getTime() - departure.getTime() > 24 * 60 * 60_000) throw new DomainError('Scheduled departure must be in the future and arrival must be after departure within 24 hours.')
    if (serviceDateInTimezone(departure, schedule.carrier.defaultTimezone) !== serviceDate) throw new DomainError('Scheduled departure must fall on the service date in the carrier timezone.')
    if (!Number.isSafeInteger(args.capacity) || args.capacity < 1 || args.capacity > 300) throw new DomainError('Capacity must be an integer between 1 and 300.')
    if (![args.baseAmount, args.taxAmount].every(value => Number.isSafeInteger(value) && value >= 0)) throw new DomainError('Amounts must be non-negative minor-unit integers.')
    // A nine-traveler party total must still fit the 32-bit amount columns and GraphQL Int results.
    checkedMinorTotal([args.baseAmount, args.taxAmount], 9)
    supportedCurrencyCode(currencyCode)
    if (currencyCode !== schedule.carrier.defaultCurrencyCode) throw new DomainError('Currency must match the carrier default currency.')
    const scheduleLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "FlightSchedule" WHERE "id" = ${schedule.id} FOR UPDATE`)
    throwIfKeystonePrismaError(scheduleLock)
    schedule = await (transactionContext.prisma as any).flightSchedule.findUnique({ where: { id: args.scheduleId }, include: { carrier: true, route: true, operatingCarrier: true } })
    if (!schedule?.carrierId || schedule.carrierId !== actor.carrierId || !schedule.route || !schedule.operatingCarrierId || schedule.status !== 'published') throw new DomainError('The published schedule changed while provisioning dated service.')
    if (schedule.effectiveFrom && serviceDay < schedule.effectiveFrom || schedule.effectiveTo && serviceDay > schedule.effectiveTo) throw new DomainError('Service date is outside the current schedule effective period.')
    const currentDays = Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek.map(Number) : []
    if (currentDays.length && !currentDays.includes(isoDay)) throw new DomainError('The schedule no longer operates on this service day.')
    if (currencyCode !== schedule.carrier.defaultCurrencyCode) throw new DomainError('Currency must match the current carrier default currency.')
    const cabinLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "Cabin" WHERE "id" = ${args.cabinId} FOR UPDATE`)
    throwIfKeystonePrismaError(cabinLock)
    const fareLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "FareBrand" WHERE "id" = ${args.fareBrandId} FOR UPDATE`)
    throwIfKeystonePrismaError(fareLock)
    const [currentCabin, currentFareBrand] = await Promise.all([
      (transactionContext.prisma as any).cabin.findUnique({ where: { id: args.cabinId } }),
      (transactionContext.prisma as any).fareBrand.findUnique({ where: { id: args.fareBrandId } }),
    ])
    if (!currentCabin || !currentFareBrand || currentCabin.carrierId !== actor.carrierId || currentFareBrand.carrierId !== actor.carrierId || currentFareBrand.cabinId !== currentCabin.id || currentFareBrand.status !== 'active') throw new DomainError('The active provisioning cabin/fare catalog changed while acquiring locks.')
    const claim = await beginOperation(sudo, transactionContext, actor.carrierId, key, 'dated-flight.provision', request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as ProvisioningResult
    const records = await createDatedFlightRecords(transactionContext.prisma as any, {
      carrierId: actor.carrierId,
      carrierCode: schedule.carrier.code,
      scheduleId: schedule.id,
      routeId: schedule.routeId,
      originId: schedule.route.originId,
      destinationId: schedule.route.destinationId,
      operatingCarrierId: schedule.operatingCarrierId,
      flightNumber: schedule.flightNumber,
      serviceDate,
      scheduledDepartureAt: departure,
      scheduledArrivalAt: arrival,
      cabinId: currentCabin.id,
      cabinCode: currentCabin.code,
      fareBrandId: currentFareBrand.id,
      fareBrandCode: currentFareBrand.code,
      capacity: args.capacity,
      baseAmount: args.baseAmount,
      taxAmount: args.taxAmount,
      currencyCode,
      departureTerminal: args.departureTerminal?.trim().slice(0, 20) || null,
      departureGate: args.departureGate?.trim().slice(0, 20) || null,
    }, sudo.query)
    await writeAudit(sudo, transactionContext, { carrierId: actor.carrierId, key: claim.storageKey, action: 'dated-flight.provision', aggregateType: 'FlightInstance', aggregateId: records.flight.id, after: { status: records.flight.status, serviceDate, capacity: args.capacity, currencyCode }, metadata: { bucketId: records.bucket.id, seatMapId: records.seatMap.id } })
    const result = { resourceType: 'FlightInstance', resourceId: records.flight.id, status: records.flight.status, changed: records.changed, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}

export type DatedFlightSalesStatus = 'open_for_sale' | 'closed_for_sale'

export function assertDatedFlightSalesStatus(value: unknown): asserts value is DatedFlightSalesStatus {
  if (value !== 'open_for_sale' && value !== 'closed_for_sale') {
    throw new DomainError('Sales status must be open_for_sale or closed_for_sale.')
  }
}

export async function setDatedFlightSalesStatus(
  _root: unknown,
  args: { flightInstanceId: string; status: DatedFlightSalesStatus; idempotencyKey: string },
  context: Context,
): Promise<ProvisioningResult> {
  assertDatedFlightSalesStatus(args.status)
  return runSerializableTransaction(context, async transactionContext => {
    const actor = await requireFreshPermission(transactionContext, 'canManageInventory')
    let flight = await (transactionContext.prisma as any).flightInstance.findUnique({ where: { id: args.flightInstanceId }, include: { inventoryBuckets: true } })
    if (!flight || flight.carrierId !== actor.carrierId) throw new DomainError('Dated flight not found or inaccessible.')
    const lock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" = ${flight.id} FOR UPDATE`)
    throwIfKeystonePrismaError(lock)
    flight = await (transactionContext.prisma as any).flightInstance.findUnique({ where: { id: flight.id }, include: { inventoryBuckets: true } })
    if (!flight || flight.carrierId !== actor.carrierId) throw new DomainError('Dated flight changed while updating sales status.')
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const request = { flightInstanceId: flight.id, status: args.status }
    const sudo = transactionContext.sudo() as any
    const inspected = await inspectOperation(sudo, actor.carrierId, key, 'dated-flight.sales-status', request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as ProvisioningResult
    const transition = assertLifecycleTransition('flightInstance', flight.status, args.status)
    const claim = await beginOperation(sudo, transactionContext, actor.carrierId, key, 'dated-flight.sales-status', request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as ProvisioningResult
    if (transition.changed) {
      await (transactionContext.prisma as any).flightInstance.update({ where: { id: flight.id }, data: { status: args.status } })
      await (transactionContext.prisma as any).inventoryBucket.updateMany({ where: { flightInstanceId: flight.id }, data: { status: args.status === 'open_for_sale' ? 'open' : 'closed' } })
      await writeAudit(sudo, transactionContext, { carrierId: actor.carrierId, key: claim.storageKey, action: 'dated-flight.sales-status', aggregateType: 'FlightInstance', aggregateId: flight.id, before: { status: flight.status }, after: { status: args.status } })
    }
    const result = { resourceType: 'FlightInstance', resourceId: flight.id, status: args.status, changed: transition.changed, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}

export async function setInventoryAuthorization(
  _root: unknown,
  args: { inventoryBucketId: string; authorized: number; idempotencyKey: string },
  context: Context,
): Promise<ProvisioningResult> {
  return runSerializableTransaction(context, async transactionContext => {
    const actor = await requireFreshPermission(transactionContext, 'canManageInventory')
    let bucket = await (transactionContext.prisma as any).inventoryBucket.findUnique({ where: { id: args.inventoryBucketId } })
    if (!bucket || bucket.carrierId !== actor.carrierId) throw new DomainError('Inventory bucket not found or inaccessible.')
    const lock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "InventoryBucket" WHERE "id" = ${bucket.id} FOR UPDATE`)
    throwIfKeystonePrismaError(lock)
    bucket = await (transactionContext.prisma as any).inventoryBucket.findUnique({ where: { id: bucket.id } })
    if (!bucket || bucket.carrierId !== actor.carrierId) throw new DomainError('Inventory bucket changed while updating authorization.')
    assertInventoryCounts({ capacity: bucket.capacity, authorized: args.authorized, sold: bucket.sold, held: bucket.held, blocked: bucket.blocked })
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const request = { inventoryBucketId: bucket.id, authorized: args.authorized }
    const sudo = transactionContext.sudo() as any
    const inspected = await inspectOperation(sudo, actor.carrierId, key, 'inventory.authorize', request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as ProvisioningResult
    const claim = await beginOperation(sudo, transactionContext, actor.carrierId, key, 'inventory.authorize', request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as ProvisioningResult
    const changed = bucket.authorized !== args.authorized
    if (changed) {
      await (transactionContext.prisma as any).inventoryBucket.update({ where: { id: bucket.id }, data: { authorized: args.authorized } })
      await writeAudit(sudo, transactionContext, { carrierId: actor.carrierId, key: claim.storageKey, action: 'inventory.authorize', aggregateType: 'InventoryBucket', aggregateId: bucket.id, before: { authorized: bucket.authorized }, after: { authorized: args.authorized } })
    }
    const result = { resourceType: 'InventoryBucket', resourceId: bucket.id, status: bucket.status, changed, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}
