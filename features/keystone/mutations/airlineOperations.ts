import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'
import type { Context } from '.keystone/types'

import { requireFreshCarrierPermission, requireFreshPermission, requireStationCapability } from '../access'
import type { Permission } from '../models/fields'
import {
  assertLifecycleTransition,
  type LifecycleName,
} from '../lib/lifecycle'
import {
  buildBookingLineSnapshot,
  buildBookingSegmentSnapshot,
} from '../lib/snapshots'
import { hasCurrentStorefrontBookingAccess, isStorefrontContext } from '../lib/storefront-session'
import { frozenAcceptanceVersion } from '../lib/passenger-service-allocation'
import { acceptedBookingSnapshot, assertHeldBookingSnapshot, bookingAcceptanceDigest, bookingInventoryConversionPlan, BOOKING_ACCEPTANCE_OFFER_QUERY, BOOKING_ACCEPTANCE_PASSENGER_QUERY, normalizedBookingPassengerIds, publicBookingReceipt } from '../lib/booking-acceptance'
import { cancellationArtifactBlockers, hasUnresolvedCancelledBookingArtifacts } from '../lib/service-eligibility'
import {
  runSerializableTransaction,
  sortUniqueIds,
  throwIfKeystonePrismaError,
} from '../lib/transactions'
import { DomainError } from '../lib/domain-error'
import { passengerTypeOn } from '../lib/passenger-age'

const sensitiveAuditKey = /authorization|cookie|credential|document|password|payload|secret|token/i

export function sanitizeAuditMetadata(value: unknown, depth = 0): any {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'string') return value.slice(0, 500)
  if (depth >= 3) return '[TRUNCATED]'
  if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitizeAuditMetadata(item, depth + 1))
  if (typeof value !== 'object') return String(value).slice(0, 500)

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).slice(0, 30).map(([key, item]) => [
      key.slice(0, 100),
      sensitiveAuditKey.test(key) ? '[REDACTED]' : sanitizeAuditMetadata(item, depth + 1),
    ]),
  )
}

export function normalizeIdempotencyKey(value: string) {
  const key = value?.trim()
  if (!key || key.length < 12 || key.length > 200) {
    throw new DomainError('A 12-to-200 character idempotency key is required.')
  }
  return key
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, entry]) => [name, canonicalize(entry)]),
    )
  }
  return value
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

/**
 * Store a one-way, tenant-and-operation-scoped key instead of a caller's raw
 * idempotency value. This prevents equal keys in different carriers/scopes
 * from colliding or replaying another tenant's result.
 */
export function idempotencyStorageKey(carrierId: string, scope: string, key: string) {
  return sha256(`${carrierId}\u0000${scope}\u0000${key}`)
}

function idempotencyRequestHash(request: unknown) {
  return sha256(JSON.stringify(canonicalize(request)))
}

type IdempotencyRecord = {
  id: string
  key: string
  scope: string
  requestHash: string
  status: string
  result?: Record<string, unknown> | null
  carrier?: { id: string } | null
}

type OperationInspection =
  | { storageKey: string; requestHash: string; replay: IdempotencyRecord }
  | { storageKey: string; requestHash: string; replay?: undefined }

type OperationClaim =
  | { storageKey: string; requestHash: string; replay: IdempotencyRecord; record?: never }
  | { storageKey: string; requestHash: string; replay?: undefined; record: IdempotencyRecord }

async function findIdempotencyRecord(sudo: any, storageKey: string): Promise<IdempotencyRecord | null> {
  const records = await sudo.query.IdempotencyKey.findMany({
    where: { key: { equals: storageKey } },
    take: 1,
    query: 'id key scope requestHash status resourceType resourceId result carrier { id }',
  })
  return records[0] ?? null
}

export async function inspectOperation(
  sudo: any,
  carrierId: string,
  key: string,
  scope: string,
  request: unknown,
): Promise<OperationInspection> {
  const storageKey = idempotencyStorageKey(carrierId, scope, key)
  const requestHash = idempotencyRequestHash(request)
  const existing = await findIdempotencyRecord(sudo, storageKey)
  if (!existing) return { storageKey, requestHash }
  if (
    existing.carrier?.id !== carrierId ||
    existing.scope !== scope ||
    existing.requestHash !== requestHash
  ) {
    throw new DomainError('This idempotency key was already used for a different request.')
  }
  if (existing.status === 'completed') return { storageKey, requestHash, replay: existing }
  throw new DomainError('An operation with this idempotency key is already in progress or failed.')
}

export async function beginOperation(
  sudo: any,
  context: Context,
  carrierId: string,
  key: string,
  scope: string,
  request: unknown,
): Promise<OperationClaim> {
  const inspected = await inspectOperation(sudo, carrierId, key, scope, request)
  if (inspected.replay) return inspected

  const record = await sudo.query.IdempotencyKey.createOne({
    data: {
      carrier: { connect: { id: carrierId } },
      key: inspected.storageKey,
      scope,
      requestHash: inspected.requestHash,
      status: 'started',
      actor: context.session?.itemId ? { connect: { id: context.session.itemId } } : undefined,
      approvedAgent: context.session?.data?.approvedAgent?.id
        ? { connect: { id: context.session.data.approvedAgent.id } }
        : undefined,
      lockedAt: new Date().toISOString(),
    },
    query: 'id key status',
  })
  return { ...inspected, record }
}

export async function finishOperation(sudo: any, recordId: string, result: Record<string, unknown>) {
  await sudo.query.IdempotencyKey.updateOne({
    where: { id: recordId },
    data: {
      status: 'completed',
      resourceType: String(result.resourceType ?? ''),
      resourceId: String(result.resourceId ?? ''),
      result,
      completedAt: new Date().toISOString(),
    },
  })
}

async function failOperation(sudo: any, recordId: string | undefined) {
  if (!recordId) return
  await sudo.query.IdempotencyKey.updateOne({
    where: { id: recordId },
    data: { status: 'failed', completedAt: new Date().toISOString() },
  })
}

export async function writeAudit(
  sudo: any,
  context: Context,
  input: {
    carrierId: string
    key: string
    action: string
    aggregateType: string
    aggregateId: string
    before?: Record<string, unknown>
    after?: Record<string, unknown>
    metadata?: Record<string, unknown>
  },
) {
  await sudo.query.AuditEvent.createOne({
    data: {
      carrier: { connect: { id: input.carrierId } },
      eventKey: `audit:${input.key}`,
      action: input.action,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      actor: context.session?.itemId ? { connect: { id: context.session.itemId } } : undefined,
      approvedAgent: context.session?.data?.approvedAgent?.id
        ? { connect: { id: context.session.data.approvedAgent.id } }
        : undefined,
      source: isStorefrontContext(context) ? 'storefront' : context.session?.data?.approvedAgent?.id ? 'agent' : 'platform',
      idempotencyKey: input.key,
      beforeSummary: sanitizeAuditMetadata(input.before ?? {}),
      afterSummary: sanitizeAuditMetadata(input.after ?? {}),
      metadata: sanitizeAuditMetadata(input.metadata ?? {}),
      occurredAt: new Date().toISOString(),
    },
  })
  await sudo.query.OutboxEvent.createOne({
    data: {
      carrier: { connect: { id: input.carrierId } },
      eventKey: `outbox:${input.key}`,
      topic: input.action,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: sanitizeAuditMetadata({ before: input.before ?? {}, after: input.after ?? {}, metadata: input.metadata ?? {} }),
      status: 'pending',
      availableAt: new Date().toISOString(),
    },
  })
}

type TransitionResult = {
  resourceType: string
  resourceId: string
  status: string
  changed: boolean
  replayed: boolean
}

export async function transitionBookingStatus(
  _root: unknown,
  args: { bookingId: string; status: string; idempotencyKey: string; reason?: string | null },
  context: Context,
): Promise<TransitionResult> {
  await requireFreshPermission(context, 'canManageBookings')
  if (args.status === 'cancelled') throw new DomainError('Use the aggregate booking cancellation command.')
  const sudo = context.sudo() as any
  const booking = await sudo.query.Booking.findOne({
    where: { id: args.bookingId },
    query: 'id bookingKey recordLocator status carrier { id }',
  })
  if (!booking) throw new DomainError('Booking not found.')
  await requireFreshCarrierPermission(context, 'canManageBookings', booking.carrier.id)
  const key = normalizeIdempotencyKey(args.idempotencyKey)
  const scope = 'booking.transition'
  const request = {
    bookingId: args.bookingId,
    status: args.status,
    reason: args.reason?.trim() || null,
  }
  const inspected = await inspectOperation(sudo, booking.carrier.id, key, scope, request)
  if (inspected.replay) {
    return { ...(inspected.replay.result ?? {}), replayed: true } as TransitionResult
  }

  const transition = assertLifecycleTransition('booking', booking.status, args.status)
  const claim = await beginOperation(sudo, context, booking.carrier.id, key, scope, request)
  if (claim.replay) {
    return { ...(claim.replay.result ?? {}), replayed: true } as TransitionResult
  }

  try {
    if (!transition.changed) {
      const result = { resourceType: 'Booking', resourceId: booking.id, status: booking.status, changed: false, replayed: false }
      await finishOperation(sudo, claim.record.id, result)
      return result
    }

    const timestampField: Record<string, string> = {
      confirmed: 'confirmedAt', ticketed: 'ticketedAt', cancelled: 'cancelledAt', completed: 'completedAt',
    }
    const data: Record<string, unknown> = { status: args.status }
    if (timestampField[args.status]) data[timestampField[args.status]] = new Date().toISOString()
    await sudo.query.Booking.updateOne({ where: { id: booking.id }, data, query: 'id status' })
    await writeAudit(sudo, context, {
      carrierId: booking.carrier.id,
      key: claim.storageKey,
      action: 'booking.status.transition',
      aggregateType: 'Booking',
      aggregateId: booking.id,
      before: { status: booking.status },
      after: { status: args.status },
      metadata: { reason: args.reason?.trim() || null },
    })
    const result = { resourceType: 'Booking', resourceId: booking.id, status: args.status, changed: true, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  } catch (error) {
    // After a database error the serializable transaction is aborted and this update fails too; it must never
    // replace the original error, which the P2002/serialization retry paths inspect.
    await failOperation(sudo, claim.record?.id).catch(() => undefined)
    throw error
  }
}

export async function cancelBooking(
  _root: unknown,
  args: { bookingId: string; idempotencyKey: string; reason: string; customerBookingId?: string; customerAccessTokenHash?: string },
  context: Context,
): Promise<TransitionResult> {
  const storefrontBookingId = isStorefrontContext(context) ? (context.session as any)?.data?.storefrontBookingId : undefined
  if (!storefrontBookingId || storefrontBookingId !== args.customerBookingId) await requireFreshPermission(context, 'canManageBookings')

  return runSerializableTransaction(context, async transactionContext => {
    const prisma = transactionContext.prisma as any
    const readCancellationState = () => prisma.booking.findUnique({
      where: { id: args.bookingId },
      include: {
        carrier: { select: { id: true } },
        passengers: { select: { id: true } },
        segments: { select: { id: true, status: true, inventoryBucketId: true } },
        paymentSessions: { select: { id: true, status: true } },
        payments: { select: { id: true, status: true, metadata: true } },
        tickets: { include: { coupons: { include: { serviceObligation: true } } } },
        seatAssignments: { select: { id: true, status: true, amount: true } },
        checkIns: { include: { boardingPasses: { select: { id: true, status: true } } } },
        bags: { select: { id: true } },
        serviceObligations: { select: { id: true, status: true } },
      },
    })
    let booking = await readCancellationState()
    if (!booking || (storefrontBookingId && booking.id !== storefrontBookingId)) throw new DomainError('Booking not found or inaccessible.')
    if (!storefrontBookingId) await requireFreshCarrierPermission(transactionContext, 'canManageBookings', booking.carrier.id)

    const bookingLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id} FOR UPDATE`)
    throwIfKeystonePrismaError(bookingLock)
    booking = await readCancellationState()
    if (!booking || (storefrontBookingId && (booking.id !== storefrontBookingId || !hasCurrentStorefrontBookingAccess(booking, args.customerAccessTokenHash)))) throw new DomainError('Booking changed or access was revoked while preparing cancellation.')
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const reason = args.reason?.trim()
    if (!reason || reason.length > 500) throw new DomainError('A cancellation reason of at most 500 characters is required.')
    const request = { bookingId: booking.id, reason }
    const sudo = transactionContext.sudo() as any
    const inspected = await inspectOperation(sudo, booking.carrier.id, key, 'booking.cancel', request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as TransitionResult
    const activeAncillaryCouponCount = await prisma.electronicMiscCoupon.count({
      where: { document: { bookingId: booking.id }, OR: [{ status: { in: ['open', 'used'] } }, { status: null }] },
    })
    const artifactState = {
      segments: booking.segments,
      tickets: booking.tickets,
      checkIns: booking.checkIns,
      seatAssignments: booking.seatAssignments,
      bagCount: booking.bags.length,
      activeAncillaryCouponCount,
    }
    if (booking.status === 'cancelled') {
      const blockers = cancellationArtifactBlockers(artifactState)
      if (blockers.length || hasUnresolvedCancelledBookingArtifacts({ ...artifactState, serviceObligations: booking.serviceObligations })) {
        throw new DomainError(`Cancelled booking has unresolved passenger-service artifacts; audited reconciliation is required before further cancellation processing${blockers.length ? ` (${blockers.join(', ')})` : ''}.`)
      }
      const claim = await beginOperation(sudo, transactionContext, booking.carrier.id, key, 'booking.cancel', request)
      if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as TransitionResult
      const reconciledTicketing = booking.tickets.length > 0 && booking.ticketingStatus !== 'voided'
      if (reconciledTicketing) {
        await prisma.booking.update({ where: { id: booking.id }, data: { ticketingStatus: 'voided' } })
        await writeAudit(sudo, transactionContext, { carrierId: booking.carrier.id, key: claim.storageKey, action: 'booking.cancelled-ticketing.reconcile', aggregateType: 'Booking', aggregateId: booking.id, before: { status: 'cancelled', ticketingStatus: booking.ticketingStatus }, after: { status: 'cancelled', ticketingStatus: 'voided' }, metadata: { reason } })
      }
      const result = { resourceType: 'Booking', resourceId: booking.id, status: 'cancelled', changed: reconciledTicketing, replayed: false }
      await finishOperation(sudo, claim.record.id, result)
      return result
    }
    const unsettledFarePayment = booking.payments.find((payment: any) => {
      const metadata = (payment.metadata ?? {}) as Record<string, unknown>
      return metadata.purchaseKind !== 'seat' && ['captured', 'partially_refunded'].includes(payment.status)
    })
    if (unsettledFarePayment || ['paid', 'partially_refunded'].includes(booking.paymentStatus)) throw new DomainError('Refund captured airfare before cancelling this booking.')
    const unsettledSeatPayment = booking.payments.find((payment: any) => {
      const metadata = (payment.metadata ?? {}) as Record<string, unknown>
      return metadata.purchaseKind === 'seat' && ['captured', 'partially_refunded'].includes(payment.status)
    })
    if (unsettledSeatPayment) throw new DomainError('Paid-seat value requires its separately authorized audited disposition before booking cancellation.')
    const blockers = cancellationArtifactBlockers(artifactState)
    if (blockers.length) throw new DomainError(`Cancellation is blocked pending authorized disposition or reconciliation of: ${blockers.join(', ')}.`)

    const claim = await beginOperation(sudo, transactionContext, booking.carrier.id, key, 'booking.cancel', request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as TransitionResult
    const now = new Date()
    const passengerCount = booking.passengers.length
    const activeSegments = booking.segments.filter((segment: any) => segment.inventoryBucketId && !['reaccommodated', 'cancelled', 'refunded'].includes(segment.status))
    const bucketIds = sortUniqueIds(activeSegments.map((segment: any) => segment.inventoryBucketId as string))
    if (bucketIds.length) {
      const bucketLocks = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "InventoryBucket" WHERE "id" IN (${Prisma.join(bucketIds)}) ORDER BY "id" FOR UPDATE`)
      throwIfKeystonePrismaError(bucketLocks)
      for (const bucketId of bucketIds) {
        const quantity = activeSegments.filter((segment: any) => segment.inventoryBucketId === bucketId).length * passengerCount
        const released = await (transactionContext.prisma as any).inventoryBucket.updateMany({ where: { id: bucketId, carrierId: booking.carrier.id, sold: { gte: quantity } }, data: { sold: { decrement: quantity } } })
        if (released.count !== 1) throw new DomainError('Cancellation could not safely release sold inventory.')
      }
    }

    await Promise.all(booking.paymentSessions.filter((session: any) => ['created', 'pending', 'authorized'].includes(session.status)).map((session: any) =>
      (transactionContext.prisma as any).paymentSession.update({ where: { id: session.id }, data: { status: 'cancelled', completedAt: now } }),
    ))
    await (transactionContext.prisma as any).manualPaymentEvidence.updateMany({ where: { bookingId: booking.id, status: { in: ['submitted', 'approved'] } }, data: { status: 'rejected', rejectionReason: `Booking cancelled: ${reason}`.slice(0, 500) } })
    await Promise.all(booking.seatAssignments.filter((seat: any) => ['held', 'assigned', 'confirmed'].includes(seat.status)).map((seat: any) =>
      (transactionContext.prisma as any).seatAssignment.update({ where: { id: seat.id }, data: { status: 'cancelled', occupancyKey: null, releasedAt: now } }),
    ))
    for (const checkIn of booking.checkIns) {
      for (const pass of checkIn.boardingPasses ?? []) {
        if (['issued', 'reissued'].includes(pass.status)) {
          await (transactionContext.prisma as any).boardingPass.update({ where: { id: pass.id }, data: { status: 'revoked', revokedAt: now } })
        }
      }
      if (!['boarded', 'cancelled'].includes(checkIn.status)) await (transactionContext.prisma as any).checkIn.update({ where: { id: checkIn.id }, data: { status: 'cancelled' } })
    }
    for (const ticket of booking.tickets) {
      for (const coupon of ticket.coupons) {
        if (['open', 'checked_in', 'suspended'].includes(coupon.status)) await (transactionContext.prisma as any).ticketCoupon.update({ where: { id: coupon.id }, data: { status: 'voided' } })
      }
      if (['pending', 'issued', 'suspended'].includes(ticket.status)) await (transactionContext.prisma as any).ticket.update({ where: { id: ticket.id }, data: { status: 'voided', voidedAt: now } })
    }
    const retiredObligations = await prisma.serviceObligation.updateMany({ where: { bookingId: booking.id, status: 'active' }, data: { status: 'retired' } })
    throwIfKeystonePrismaError(retiredObligations)
    await Promise.all(booking.segments.filter((segment: any) => !['cancelled', 'refunded', 'flown'].includes(segment.status)).map((segment: any) =>
      (transactionContext.prisma as any).bookingSegment.update({ where: { id: segment.id }, data: { status: 'cancelled' } }),
    ))
    await (transactionContext.prisma as any).booking.update({ where: { id: booking.id }, data: { status: 'cancelled', cancelledAt: now, ...(booking.tickets.length ? { ticketingStatus: 'voided' } : {}) } })
    await writeAudit(sudo, transactionContext, {
      carrierId: booking.carrier.id,
      key: claim.storageKey,
      action: 'booking.cancel',
      aggregateType: 'Booking',
      aggregateId: booking.id,
      before: { status: booking.status },
      after: { status: 'cancelled' },
      metadata: { reason, releasedPassengerSegments: activeSegments.length * passengerCount },
    })
    const result = { resourceType: 'Booking', resourceId: booking.id, status: 'cancelled', changed: true, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}

const passengerServiceResources = {
  checkIn: { list: 'CheckIn', machine: 'checkIn', permission: 'canManageAirportService' },
  boardingPass: { list: 'BoardingPass', machine: 'boardingPass', permission: 'canManageAirportService' },
  bag: { list: 'Bag', machine: 'bag', permission: 'canManageAirportService' },
  seatAssignment: { list: 'SeatAssignment', machine: 'seatAssignment', permission: 'canManageAirportService' },
  disruption: { list: 'Disruption', machine: 'disruption', permission: 'canManageDisruptions' },
  reaccommodation: { list: 'Reaccommodation', machine: 'reaccommodation', permission: 'canManageDisruptions' },
} as const satisfies Record<string, { list: string; machine: LifecycleName; permission: Permission }>

export async function transitionPassengerService(
  _root: unknown,
  args: { resourceType: keyof typeof passengerServiceResources; resourceId: string; status: string; idempotencyKey: string; metadata?: unknown },
  context: Context,
): Promise<TransitionResult> {
  const config = passengerServiceResources[args.resourceType]
  if (!config) throw new DomainError('Unsupported passenger-service resource.')
  if (args.status === 'boarded' && ['boardingPass', 'checkIn', 'seatAssignment'].includes(args.resourceType)) throw new DomainError('Use the aggregate passenger boarding command.')
  if (args.status === 'offloaded' && args.resourceType === 'checkIn') throw new DomainError('Use the aggregate passenger offload command.')
  await requireFreshPermission(context, config.permission)
  const sudo = context.sudo() as any
  const stationQuery: Partial<Record<keyof typeof passengerServiceResources, { query: string; capability: 'canCheckIn' | 'canAcceptBags' | 'canBoard'; airport: (item: any) => string }>> = {
    checkIn: { query: 'id status carrier { id } flightInstance { origin { id } }', capability: 'canCheckIn', airport: item => item.flightInstance.origin.id },
    boardingPass: { query: 'id status carrier { id } bookingSegment { flightInstance { origin { id } } }', capability: 'canBoard', airport: item => item.bookingSegment.flightInstance.origin.id },
    bag: { query: 'id status carrier { id } origin { id }', capability: 'canAcceptBags', airport: item => item.origin.id },
    seatAssignment: { query: 'id status carrier { id } bookingSegment { flightInstance { origin { id } } }', capability: 'canCheckIn', airport: item => item.bookingSegment.flightInstance.origin.id },
  }
  const station = stationQuery[args.resourceType]
  const item = await sudo.query[config.list].findOne({ where: { id: args.resourceId }, query: station?.query ?? 'id status carrier { id }' })
  if (!item) throw new DomainError('Resource not found or inaccessible.')
  if (station) await requireStationCapability(context, config.permission, item.carrier.id, station.airport(item), station.capability)
  else await requireFreshCarrierPermission(context, config.permission, item.carrier.id)
  const key = normalizeIdempotencyKey(args.idempotencyKey)
  const scope = `passenger-service.${args.resourceType}`
  const inspected = await inspectOperation(sudo, item.carrier.id, key, scope, args)
  if (inspected.replay) {
    return { ...(inspected.replay.result ?? {}), replayed: true } as TransitionResult
  }

  const transition = assertLifecycleTransition(config.machine, item.status, args.status)
  const claim = await beginOperation(sudo, context, item.carrier.id, key, scope, args)
  if (claim.replay) {
    return { ...(claim.replay.result ?? {}), replayed: true } as TransitionResult
  }

  try {
    if (transition.changed) {
      await sudo.query[config.list].updateOne({
        where: { id: item.id },
        data: { status: args.status, ...(args.resourceType === 'seatAssignment' && ['released', 'cancelled'].includes(args.status) ? { occupancyKey: null } : {}) },
        query: 'id status',
      })
      await writeAudit(sudo, context, {
        carrierId: item.carrier.id, key: claim.storageKey,
        action: `${args.resourceType}.status.transition`,
        aggregateType: config.list, aggregateId: item.id,
        before: { status: item.status }, after: { status: args.status },
        metadata: typeof args.metadata === 'object' && args.metadata ? args.metadata as Record<string, unknown> : {},
      })
    }
    const result = { resourceType: config.list, resourceId: item.id, status: args.status, changed: transition.changed, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  } catch (error) {
    // After a database error the serializable transaction is aborted and this update fails too; it must never
    // replace the original error, which the P2002/serialization retry paths inspect.
    await failOperation(sudo, claim.record?.id).catch(() => undefined)
    throw error
  }
}

export function randomReference(prefix: string, length: number) {
  return `${prefix}${crypto.randomBytes(length).toString('hex').toUpperCase().slice(0, length)}`
}

type CreateBookingFromOfferArgs = {
  offerId: string
  passengerIds: string[]
  idempotencyKey: string
  shoppingSessionHash?: string
  bookingAccessTokenHash?: string
  recoverOnly?: boolean
}

export type CreateBookingFromOfferResult = {
  resourceType: 'Booking'
  resourceId: string
  bookingId: string
  recordLocator: string
  orderNumber: string
  status: string
  changed: boolean
  replayed: boolean
  receiptVersion?: number
  acceptedSnapshot?: any
  acceptedDigest?: string
  bookingReceipt?: ReturnType<typeof publicBookingReceipt>
}

async function assertOfferAccess(context: Context, carrierId: string, storedSessionHash?: string | null, suppliedSessionHash?: string) {
  if (isStorefrontContext(context)) {
    if (!storedSessionHash || storedSessionHash !== suppliedSessionHash || (context.session as any)?.data?.carrier?.id !== carrierId) {
      throw new DomainError('This shopping session does not own the offer.')
    }
    return
  }
  await requireFreshCarrierPermission(context, 'canManageBookings', carrierId)
}

async function lockOfferInventory(
  context: Context,
  offerId: string,
  shoppingSessionHash?: string,
) {
  const sudo = context.sudo() as any
  const offerReference = await sudo.query.Offer.findOne({
    where: { id: offerId },
    query: 'id shoppingSessionId carrier { id }',
  })
  if (!offerReference) throw new DomainError('Offer not found.')
  await assertOfferAccess(context, offerReference.carrier.id, offerReference.shoppingSessionId, shoppingSessionHash)

  const offerLockResult = await context.prisma.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Offer" WHERE "id" = ${offerId} FOR UPDATE`,
  )
  throwIfKeystonePrismaError(offerLockResult)

  const lockReferences = await sudo.query.Offer.findOne({
    where: { id: offerId },
    query: 'id shoppingSessionId carrier { id } items { flightInstance { id } } inventoryHolds { id inventoryBucket { id } }',
  })
  if (!lockReferences) throw new DomainError('Offer not found.')
  await assertOfferAccess(context, lockReferences.carrier.id, lockReferences.shoppingSessionId, shoppingSessionHash)

  const flightIds = sortUniqueIds((lockReferences.items ?? []).map((item: any) => item.flightInstance?.id ?? ''))
  if (flightIds.length) {
    const flightLockResult = await context.prisma.$queryRaw(
      Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" IN (${Prisma.join(flightIds)}) ORDER BY "id" FOR UPDATE`,
    )
    throwIfKeystonePrismaError(flightLockResult)
  }

  const bucketIds = sortUniqueIds(
    (lockReferences.inventoryHolds ?? [])
      .map((hold: any) => hold.inventoryBucket?.id ?? ''),
  )
  if (bucketIds.length) {
    const bucketLockResult = await context.prisma.$queryRaw(
      Prisma.sql`SELECT "id" FROM "InventoryBucket" WHERE "id" IN (${Prisma.join(bucketIds)}) ORDER BY "id" FOR UPDATE`,
    )
    throwIfKeystonePrismaError(bucketLockResult)
  }

  const holdIds = sortUniqueIds(
    (lockReferences.inventoryHolds ?? []).map((hold: any) => hold.id),
  )
  if (holdIds.length) {
    const holdLockResult = await context.prisma.$queryRaw(
      Prisma.sql`SELECT "id" FROM "InventoryHold" WHERE "id" IN (${Prisma.join(holdIds)}) ORDER BY "id" FOR UPDATE`,
    )
    throwIfKeystonePrismaError(holdLockResult)
  }

  const releaseResult = await context.prisma.$executeRaw(Prisma.sql`
    WITH expired AS (
      UPDATE "InventoryHold"
      SET "status" = 'expired', "updatedAt" = NOW()
      WHERE "offer" = ${offerId} AND "status" = 'active' AND "expiresAt" <= NOW()
      RETURNING "inventoryBucket", "quantity"
    ), totals AS (
      SELECT "inventoryBucket", SUM("quantity")::integer AS quantity
      FROM expired GROUP BY "inventoryBucket"
    )
    UPDATE "InventoryBucket" bucket
    SET "held" = GREATEST(0, bucket."held" - totals.quantity), "updatedAt" = NOW()
    FROM totals WHERE bucket."id" = totals."inventoryBucket"
  `)
  throwIfKeystonePrismaError(releaseResult)
}

export async function operatorBookingReceipt(_root: unknown, args: { bookingId: string }, context: Context) {
  return runSerializableTransaction(context, async tx => {
    // Normal List read applies fresh read/manage and tenant policy before the
    // narrow protected-result lookup. No new permission or raw result grant.
    const visible = await tx.query.Booking.findOne({ where: { id: args.bookingId }, query: 'id carrier { id }' })
    if (!visible?.carrier?.id) throw new DomainError('Booking not found or inaccessible.')
    const booking = await (tx.prisma as any).booking.findUnique({ where: { id: visible.id } })
    if (!booking || booking.carrierId !== visible.carrier.id) throw new DomainError('Booking not found or inaccessible.')
    const retained = await (tx.prisma as any).idempotencyKey.findUnique({ where: { key: booking.idempotencyKey } })
    if (retained?.carrierId !== booking.carrierId || retained.scope !== 'booking.create-from-offer' || retained.status !== 'completed'
      || retained.result?.resourceId !== booking.id) return { version: 0, state: 'legacy_or_incomplete', message: 'Original acceptance receipt requires reconciliation; no terms were reconstructed from the current catalog.' }
    try { return publicBookingReceipt(retained.result, booking, 'operator') }
    catch { return { version: 0, state: 'legacy_or_incomplete', message: 'Original acceptance receipt requires reconciliation; current state is not historical evidence.' } }
  })
}

async function inspectBookingReceipt(context: Context, args: CreateBookingFromOfferArgs, offer: any, key: string, request: any) {
  await assertOfferAccess(context, offer.carrier.id, offer.shoppingSessionId, args.shoppingSessionHash)
  const sudo = context.sudo() as any
  const storageKey = idempotencyStorageKey(offer.carrier.id, 'booking.create-from-offer', key)
  const retained = await findIdempotencyRecord(sudo, storageKey)
  if (!retained) return null
  if (retained.result?.receiptVersion !== 1) {
    // Validate the original minimal command before giving precise legacy feedback.
    await inspectOperation(sudo, offer.carrier.id, key, 'booking.create-from-offer', retained.requestHash === idempotencyRequestHash(request)
      ? request : { offerId: args.offerId, passengerIds: args.passengerIds, storefront: Boolean(args.shoppingSessionHash) })
    throw new DomainError('Legacy booking receipt lacks frozen acceptance evidence; operator reconciliation is required. Retain the original key, not a replacement booking.')
  }
  const inspected = await inspectOperation(sudo, offer.carrier.id, key, 'booking.create-from-offer', request)
  if (!inspected.replay) return null
  const result = inspected.replay.result as CreateBookingFromOfferResult
  const lock = await context.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${result.bookingId} FOR UPDATE`)
  throwIfKeystonePrismaError(lock)
  const booking = await (context.prisma as any).booking.findUnique({ where: { id: result.bookingId } })
  if (!booking || booking.carrierId !== offer.carrier.id || booking.sourceOfferId !== offer.id
    || booking.idempotencyKey !== storageKey || result.resourceId !== booking.id) throw new DomainError('Booking receipt is incomplete or outside current authority; reconciliation is required.')
  await assertOfferAccess(context, booking.carrierId, offer.shoppingSessionId, args.shoppingSessionHash)
  if (isStorefrontContext(context) && !hasCurrentStorefrontBookingAccess(booking, args.bookingAccessTokenHash)) {
    throw new DomainError('Original booking access was rotated, revoked, or expired. Use the current booking credential; the original command remains recorded and must not be replaced.')
  }
  return { ...result, status: booking.status, changed: false, replayed: true, bookingReceipt: publicBookingReceipt(result, booking, isStorefrontContext(context) ? 'current' : 'operator') }
}

function requiredCabinCode(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new DomainError('The held fare has no cabin; the offer must be repriced.')
  return value.trim()
}

async function createBookingFromOfferInTransaction(
  _root: unknown,
  args: CreateBookingFromOfferArgs,
  context: Context,
  admission?: (tx: Context, carrier: { id: string; code: string }) => Promise<void>,
): Promise<CreateBookingFromOfferResult> {
  if (!isStorefrontContext(context)) await requireFreshPermission(context, 'canManageBookings')
  const sudo = context.sudo() as any
  const key = normalizeIdempotencyKey(args.idempotencyKey)
  args = { ...args, offerId: args.offerId.trim(), passengerIds: normalizedBookingPassengerIds(args.passengerIds) }
  const reference = await sudo.query.Offer.findOne({ where: { id: args.offerId }, query: 'id shoppingSessionId carrier { id code }' })
  if (!reference) throw new DomainError('Offer not found or inaccessible.')
  await assertOfferAccess(context, reference.carrier.id, reference.shoppingSessionId, args.shoppingSessionHash)
  const request = { version: 2, offerId: args.offerId, passengerIds: args.passengerIds,
    authority: isStorefrontContext(context) ? { kind: 'guest', shoppingSessionHash: args.shoppingSessionHash, initialAccessHash: args.bookingAccessTokenHash }
      : { kind: 'operator', actorId: context.session?.itemId, carrierId: reference.carrier.id } }
  const fastReplay = await inspectBookingReceipt(context, args, reference, key, request)
  if (fastReplay) return fastReplay
  if (args.recoverOnly) throw new DomainError('No committed booking receipt exists for this exact command. Keep the original intent; no booking was created by this recovery read.')
  if (isStorefrontContext(context)) {
    if (!admission || !args.bookingAccessTokenHash) throw new DomainError('Storefront booking admission is required for a new reservation.')
    await admission(context, reference.carrier)
  }
  await lockOfferInventory(context, args.offerId, args.shoppingSessionHash)
  const offer = await sudo.query.Offer.findOne({ where: { id: args.offerId }, query: BOOKING_ACCEPTANCE_OFFER_QUERY })
  if (!offer) throw new DomainError('Offer not found.')
  await assertOfferAccess(context, offer.carrier.id, offer.shoppingSessionId, args.shoppingSessionHash)
  const scope = 'booking.create-from-offer'
  const lockedReplay = await inspectBookingReceipt(context, args, offer, key, request)
  if (lockedReplay) return lockedReplay

  if (isStorefrontContext(context) && args.shoppingSessionHash) {
    const reservationLock = await context.prisma.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${`airline:pending-reservation:${offer.carrier.id}:${args.shoppingSessionHash}`}, 0)) AS locked`)
    throwIfKeystonePrismaError(reservationLock)
    if (!Array.isArray(reservationLock) || reservationLock[0]?.locked !== true) throw new DomainError('This shopping session is currently creating a reservation. Retry shortly.')
    const activeUnpaidReservations = await (context.prisma as any).booking.count({
      where: {
        carrierId: offer.carrier.id,
        sourceOffer: { shoppingSessionId: args.shoppingSessionHash },
        status: { notIn: ['cancelled', 'completed'] },
        paymentStatus: { in: ['unpaid', 'failed'] },
      },
    })
    if (activeUnpaidReservations >= 1) {
      throw new DomainError('This shopping session already has an unpaid reservation. Complete the disclosed external-settlement handoff or cancel that reservation before creating another.')
    }
  }

  if (!['available', 'held'].includes(offer.status)) throw new DomainError('Offer is not sellable.')
  if (!offer.expiresAt || new Date(offer.expiresAt) <= new Date()) throw new DomainError('Offer has expired.')
  if (!offer.items?.length) throw new DomainError('Offer has no priced items.')
  if (!args.passengerIds?.length || new Set(args.passengerIds).size !== args.passengerIds.length) {
    throw new DomainError('At least one unique passenger is required.')
  }
  const offeredPassengerIds = (offer.passengers ?? []).map((passenger: any) => passenger.id).sort()
  const requestedPassengerIds = [...args.passengerIds].sort()
  if (offeredPassengerIds.length !== requestedPassengerIds.length || offeredPassengerIds.some((id: string, index: number) => id !== requestedPassengerIds[index])) {
    throw new DomainError('Booking passengers must exactly match the accepted offer.')
  }
  if (offer.customer?.carrier?.id && offer.customer.carrier.id !== offer.carrier.id) {
    throw new DomainError('Offer customer is outside the offer carrier.')
  }
  if (offer.approvedAgent?.carrier?.id && offer.approvedAgent.carrier.id !== offer.carrier.id) {
    throw new DomainError('Offer agent is outside the offer carrier.')
  }
  for (const item of offer.items) {
    if (item.carrier?.id !== offer.carrier.id) throw new DomainError('Offer item is outside the offer carrier.')
    if (item.currencyCode !== offer.currencyCode) throw new DomainError('Offer item currency does not match the offer.')
    if (item.flightInstance?.carrier?.id && item.flightInstance.carrier.id !== offer.carrier.id) {
      throw new DomainError('Offer flight is outside the offer carrier.')
    }
    if (item.flightInstance && (!['scheduled', 'open_for_sale', 'delayed'].includes(item.flightInstance.status) || new Date(item.flightInstance.scheduledDepartureAt) <= new Date())) {
      throw new DomainError('Offer flight is no longer open for future sale.')
    }
    if (item.inventoryBucket?.carrier?.id && item.inventoryBucket.carrier.id !== offer.carrier.id) {
      throw new DomainError('Offer inventory is outside the offer carrier.')
    }
    if (item.ancillaryProduct?.carrier?.id && item.ancillaryProduct.carrier.id !== offer.carrier.id) {
      throw new DomainError('Offer ancillary is outside the offer carrier.')
    }
  }
  for (const hold of offer.inventoryHolds ?? []) {
    if (
      hold.carrier?.id !== offer.carrier.id ||
      hold.inventoryBucket?.carrier?.id !== offer.carrier.id
    ) {
      throw new DomainError('Offer hold is outside the offer carrier.')
    }
  }
  const itemTotal = offer.items.reduce(
    (sum: number, item: any) => sum + (item.itemType === 'discount' ? -1 : 1) * Number(item.totalAmount),
    0,
  )
  if (itemTotal !== offer.totalAmount) throw new DomainError('Offer item totals do not match the offer total.')
  for (const item of offer.items.filter((candidate: any) => candidate.itemType === 'flight')) {
    if (!item.inventoryBucket) throw new DomainError('Flight offer item is missing an inventory bucket.')
    const heldQuantity = (offer.inventoryHolds ?? [])
      .filter((hold: any) => hold.inventoryBucket?.id === item.inventoryBucket.id)
      .reduce((sum: number, hold: any) => sum + Number(hold.quantity), 0)
    if (heldQuantity < item.quantity) throw new DomainError('Flight offer item is not fully covered by inventory holds.')
  }
  for (const hold of offer.inventoryHolds ?? []) {
    if (hold.status !== 'active' || new Date(hold.expiresAt) <= new Date()) {
      throw new DomainError('Offer inventory hold is not active.')
    }
    if (
      !hold.inventoryBucket ||
      hold.inventoryBucket.held < hold.quantity ||
      hold.inventoryBucket.sold + hold.quantity > hold.inventoryBucket.authorized
    ) {
      throw new DomainError('Offer inventory hold no longer fits authorized inventory.')
    }
  }

  const passengers = await sudo.query.Passenger.findMany({
    where: { id: { in: args.passengerIds }, carrier: { id: { equals: offer.carrier.id } } },
    orderBy: [{ id: 'asc' }], take: 9,
    query: BOOKING_ACCEPTANCE_PASSENGER_QUERY,
  })
  if (passengers.length !== args.passengerIds.length) throw new DomainError('One or more passengers are missing or outside this carrier.')

  const heldOperation = offer.idempotencyKey ? await findIdempotencyRecord(sudo, offer.idempotencyKey) : null
  if (!heldOperation || heldOperation.carrier?.id !== offer.carrier.id || heldOperation.scope !== 'offer.create' || heldOperation.status !== 'completed') throw new DomainError('The original held-offer receipt is unavailable; reconcile the offer before accepting.')
  const acceptanceVersion = frozenAcceptanceVersion(heldOperation.result?.heldSnapshot)
  const acceptedSnapshot = acceptedBookingSnapshot(offer, passengers, acceptanceVersion)
  assertHeldBookingSnapshot(heldOperation.result?.heldSnapshot, acceptedSnapshot)
  const conversionPlan = bookingInventoryConversionPlan(offer, passengers.length, acceptanceVersion)
  const claim = await beginOperation(sudo, context, offer.carrier.id, key, scope, request)
  if (claim.replay) {
    const replay = await inspectBookingReceipt(context, args, offer, key, request)
    if (!replay) throw new DomainError('Booking receipt changed while claiming conversion.')
    return replay
  }

  try {
    const recordLocator = randomReference('', 6)
    const orderNumber = randomReference(`${offer.carrier.code}-`, 12)
    const booking = await sudo.query.Booking.createOne({
      data: {
        carrier: { connect: { id: offer.carrier.id } },
        bookingKey: `${offer.carrier.id}:${orderNumber}`,
        recordLocator,
        orderNumber,
        idempotencyKey: claim.storageKey,
        accessTokenHash: args.bookingAccessTokenHash,
        accessTokenExpiresAt: args.bookingAccessTokenHash ? new Date(Date.now() + 365 * 24 * 60 * 60_000).toISOString() : undefined,
        status: isStorefrontContext(context) ? 'pending' : 'confirmed', paymentStatus: 'unpaid', ticketingStatus: 'not_ticketed',
        source: offer.approvedAgent ? 'agent' : offer.source === 'website' ? 'website' : 'direct',
        contactEmail: passengers[0].email ?? '', contactPhone: passengers[0].phone ?? '',
        baseAmount: offer.baseAmount, taxAmount: offer.taxAmount, feeAmount: offer.feeAmount,
        discountAmount: offer.discountAmount, totalAmount: offer.totalAmount, currencyCode: offer.currencyCode,
        customer: offer.customer ? { connect: { id: offer.customer.id } } : undefined,
        approvedAgent: offer.approvedAgent ? { connect: { id: offer.approvedAgent.id } } : undefined,
        sourceOffer: { connect: { id: offer.id } }, confirmedAt: isStorefrontContext(context) ? undefined : new Date().toISOString(),
        metadata: isStorefrontContext(context) ? { paymentDueAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(), settlementMode: 'external_evidence' } : {},
      },
      query: 'id recordLocator orderNumber status',
    })

    // Fare type (adult, child, infant with seat) is fixed by age on the first departure of the itinerary.
    const departures = offer.items.map((item: any) => Date.parse(item.flightInstance?.scheduledDepartureAt ?? '')).filter(Number.isFinite)
    const firstDeparture = new Date(departures.length ? Math.min(...departures) : Date.now())
    for (const passenger of passengers) {
      await sudo.query.BookingPassenger.createOne({
        data: {
          carrier: { connect: { id: offer.carrier.id } }, booking: { connect: { id: booking.id } },
          passenger: { connect: { id: passenger.id } }, bookingPassengerKey: `${booking.id}:${passenger.id}`,
          passengerType: passengerTypeOn(passenger.dateOfBirth, firstDeparture), isPrimaryContact: passenger.id === passengers[0].id,
          passengerSnapshot: {
            passengerKey: passenger.passengerKey, title: passenger.title, givenName: passenger.givenName,
            middleNames: passenger.middleNames, familyName: passenger.familyName, suffix: passenger.suffix,
            dateOfBirth: passenger.dateOfBirth, nationalityCode: passenger.nationalityCode,
          },
          loyaltySnapshot: passenger.loyaltyPrograms ?? [],
        },
        query: 'id',
      })
    }

    const flightItems = offer.items
      .filter((item: any) => item.itemType === 'flight' && item.flightInstance)
      .sort((left: any, right: any) =>
        new Date(left.flightInstance.scheduledDepartureAt).getTime() -
        new Date(right.flightInstance.scheduledDepartureAt).getTime(),
      )
    let journey: any = null
    if (flightItems.length) {
      const first = flightItems[0].flightInstance
      const last = flightItems[flightItems.length - 1].flightInstance
      journey = await sudo.query.Journey.createOne({
        data: {
          carrier: { connect: { id: offer.carrier.id } }, booking: { connect: { id: booking.id } },
          journeyKey: `${booking.id}:1`, sequence: 1,
          origin: { connect: { id: first.origin.id } }, destination: { connect: { id: last.destination.id } }, status: 'planned',
        }, query: 'id',
      })
    }

    const flightSequenceById = new Map(
      flightItems.map((item: any, index: number) => [item.id, index + 1]),
    )
    for (const item of offer.items) {
      let segmentId: string | undefined
      if (item.itemType === 'flight' && item.flightInstance && journey) {
        const segmentSequence = flightSequenceById.get(item.id) as number
        const flight = item.flightInstance
        const compactFlightNumber = String(flight.flightNumber).toUpperCase().replace(/\s+/g, '')
        const serviceNumber = compactFlightNumber.startsWith(flight.carrier.code)
          ? compactFlightNumber.slice(flight.carrier.code.length)
          : compactFlightNumber
        const snapshot = buildBookingSegmentSnapshot({
          sourceOfferItemId: item.id,
          marketingCarrierCode: flight.carrier.code,
          operatingCarrierCode: flight.operatingCarrier?.code ?? flight.carrier.code,
          flightNumber: serviceNumber,
          originCode: flight.origin.iataCode, destinationCode: flight.destination.iataCode,
          scheduledDepartureAt: flight.scheduledDepartureAt, scheduledArrivalAt: flight.scheduledArrivalAt,
          // The held bucket's cabin is authoritative; older offers snapshotted a fixed 'Y'.
          cabinCode: requiredCabinCode(item.inventoryBucket?.cabin?.code ?? item.segmentSnapshot?.cabinCode),
          bookingClassCode: item.segmentSnapshot?.bookingClassCode ?? 'Y',
          fareBrandCode: item.segmentSnapshot?.fareBrandCode ?? 'STANDARD',
          fareBasisCode: item.segmentSnapshot?.fareBasisCode ?? 'STANDARD',
          includedBaggage: item.segmentSnapshot?.includedBaggage,
        })
        const segment = await sudo.query.BookingSegment.createOne({
          data: {
            carrier: { connect: { id: offer.carrier.id } }, booking: { connect: { id: booking.id } },
            journey: { connect: { id: journey.id } }, sourceOfferItem: { connect: { id: item.id } },
            flightInstance: { connect: { id: flight.id } }, inventoryBucket: item.inventoryBucket ? { connect: { id: item.inventoryBucket.id } } : undefined, segmentKey: `${booking.id}:${segmentSequence}`,
            sequence: segmentSequence, status: 'confirmed',
            origin: { connect: { id: flight.origin.id } }, destination: { connect: { id: flight.destination.id } },
            marketingCarrierCode: snapshot.marketingCarrierCode,
            operatingCarrierCode: snapshot.operatingCarrierCode,
            marketingFlightNumber: snapshot.flightNumber,
            originCode: snapshot.originCode,
            destinationCode: snapshot.destinationCode,
            scheduledDepartureAt: snapshot.scheduledDepartureAt,
            scheduledArrivalAt: snapshot.scheduledArrivalAt,
            cabinCode: snapshot.cabinCode,
            bookingClassCode: snapshot.bookingClassCode,
            fareBrandCode: snapshot.fareBrandCode,
            fareBasisCode: snapshot.fareBasisCode,
            itinerarySnapshot: item.segmentSnapshot ?? {},
            includedBaggageSnapshot: snapshot.includedBaggage,
          }, query: 'id',
        })
        segmentId = segment.id
      }

      const line = buildBookingLineSnapshot({
        sourceOfferItemId: item.id, itemType: item.itemType, description: item.description,
        quantity: item.quantity, unitAmount: item.unitAmount, baseAmount: item.baseAmount,
        taxAmount: item.taxAmount, feeAmount: item.feeAmount, totalAmount: item.totalAmount,
        currencyCode: item.currencyCode, product: item.productSnapshot ?? {},
      })
      await sudo.query.BookingLineItem.createOne({
        data: {
          carrier: { connect: { id: offer.carrier.id } }, booking: { connect: { id: booking.id } },
          sourceOfferItem: { connect: { id: item.id } },
          bookingSegment: segmentId ? { connect: { id: segmentId } } : undefined,
          ancillaryProduct: item.ancillaryProduct ? { connect: { id: item.ancillaryProduct.id } } : undefined,
          lineItemKey: `${booking.id}:${item.itemKey}`,
          itemType: line.itemType,
          description: line.description,
          quantity: line.quantity,
          unitAmount: line.unitAmount,
          baseAmount: line.baseAmount,
          taxAmount: line.taxAmount,
          feeAmount: line.feeAmount,
          totalAmount: line.totalAmount,
          currencyCode: line.currencyCode,
          productSnapshot: line.productSnapshot, pricingSnapshot: {
            sourceOfferNumber: offer.offerNumber, sourceOfferItemKey: item.itemKey,
          },
        },
      })
    }

    for (const hold of offer.inventoryHolds ?? []) {
      await sudo.query.InventoryHold.updateOne({ where: { id: hold.id }, data: { status: 'converted', convertedAt: new Date().toISOString() } })
    }
    for (const bucket of conversionPlan) {
      await sudo.query.InventoryBucket.updateOne({ where: { id: bucket.id }, data: { held: bucket.held - bucket.quantity, sold: bucket.sold + bucket.quantity } })
    }
    await sudo.query.Offer.updateOne({ where: { id: offer.id }, data: { status: 'accepted', booking: { connect: { id: booking.id } } } })
    await writeAudit(sudo, context, {
      carrierId: offer.carrier.id, key: claim.storageKey, action: 'booking.create-from-offer',
      aggregateType: 'Booking', aggregateId: booking.id,
      after: { status: booking.status, recordLocator: booking.recordLocator, totalAmount: offer.totalAmount, currencyCode: offer.currencyCode },
      metadata: { offerId: offer.id, passengerCount: passengers.length, lineItemCount: offer.items.length },
    })
    const result: CreateBookingFromOfferResult = {
      resourceType: 'Booking', resourceId: booking.id, bookingId: booking.id,
      recordLocator, orderNumber, status: booking.status, changed: true, replayed: false,
      receiptVersion: 1, acceptedSnapshot, acceptedDigest: bookingAcceptanceDigest(acceptedSnapshot),
    }
    await finishOperation(sudo, claim.record.id, result)
    const current = await (context.prisma as any).booking.findUnique({ where: { id: booking.id } })
    return { ...result, bookingReceipt: publicBookingReceipt(result, current, isStorefrontContext(context) ? 'current' : 'operator') }
  } catch (error) {
    // After a database error the serializable transaction is aborted and this update fails too; it must never
    // replace the original error, which the P2002/serialization retry paths inspect.
    await failOperation(sudo, claim.record?.id).catch(() => undefined)
    throw error
  }
}

export async function createBookingFromOffer(
  root: unknown,
  args: CreateBookingFromOfferArgs,
  context: Context,
  admission?: (tx: Context, carrier: { id: string; code: string }) => Promise<void>,
): Promise<CreateBookingFromOfferResult> {
  try {
    return await runSerializableTransaction(context, tx => createBookingFromOfferInTransaction(root, args, tx, admission))
  } catch (error) {
    // A uniqueness conflict aborted the transaction. Only acknowledge a proven
    // completed SAME command in a fresh transaction, never try a new creation.
    const code = (error as any)?.code ?? (error as any)?.extensions?.prisma?.code
    if (code !== 'P2002') throw error
    return runSerializableTransaction(context, tx => createBookingFromOfferInTransaction(root, { ...args, recoverOnly: true }, tx, admission))
  }
}
