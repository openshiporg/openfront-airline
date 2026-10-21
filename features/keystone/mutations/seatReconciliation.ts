import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'
import type { Context } from '.keystone/types'

import { requireFreshCarrierPermission } from '../access'
import { runSerializableTransaction, throwIfKeystonePrismaError } from '../lib/transactions'
import { beginOperation, finishOperation, inspectOperation, normalizeIdempotencyKey, writeAudit } from './airlineOperations'
import { DomainError } from '../lib/domain-error'

// Customers can no longer pick seats before ticketing (assignCustomerSeat), but bookings from before that gate can
// hold free pre-ticket seats, and initial ticket issuance refuses any seat artifact. This narrow, audited operator
// command validates every retained seat row of one never-ticketed booking; issuance then admits exactly that
// unchanged, reconciled set. Nothing is deleted, no payment is implied, and paid or conflicting seats still block.
export const PRE_TICKET_SEAT_RECONCILIATION = 'seat.pre-ticket-reconcile'
const activeStatuses = ['held', 'assigned', 'confirmed']

type SeatRowIdentity = { id: string; status: string; updatedAt: Date | string }

/** Digest of a booking's seat rows; any later change to the set (new row, status change) invalidates it. */
export function seatAssignmentSetDigest(rows: SeatRowIdentity[]) {
  const lines = rows.map(row => `${row.id}:${row.status}:${new Date(row.updatedAt).toISOString()}`).sort()
  return crypto.createHash('sha256').update(lines.join('\n')).digest('hex')
}

export async function reconcilePreTicketSeatAssignments(
  _root: unknown,
  args: { bookingId: string; idempotencyKey: string },
  context: Context,
) {
  return runSerializableTransaction(context, async transactionContext => {
    const prisma = transactionContext.prisma as any
    const located = await prisma.booking.findUnique({ where: { id: args.bookingId }, select: { id: true, carrierId: true } })
    if (!located?.carrierId) throw new DomainError('Booking not found or inaccessible.')
    await requireFreshCarrierPermission(transactionContext, 'canManageTicketing', located.carrierId)
    const bookingLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${located.id} FOR UPDATE`)
    throwIfKeystonePrismaError(bookingLock)
    const sudo = transactionContext.sudo() as any
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const request = { bookingId: located.id }
    const inspected = await inspectOperation(sudo, located.carrierId, key, PRE_TICKET_SEAT_RECONCILIATION, request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true }

    const booking = await prisma.booking.findUnique({ where: { id: located.id }, select: { id: true, carrierId: true, ticketingStatus: true, currencyCode: true } })
    if (!booking || booking.carrierId !== located.carrierId) throw new DomainError('Booking changed while preparing seat reconciliation.')
    if (booking.ticketingStatus !== 'not_ticketed') throw new DomainError('Only a never-ticketed booking needs pre-ticket seat reconciliation.')
    const [ticketCount, checkInCount, boardingPassCount, bagCount, ancillaryCouponCount] = await Promise.all([
      prisma.ticket.count({ where: { bookingId: booking.id } }),
      prisma.checkIn.count({ where: { bookingId: booking.id } }),
      prisma.boardingPass.count({ where: { checkIn: { bookingId: booking.id } } }),
      prisma.bag.count({ where: { bookingId: booking.id } }),
      prisma.electronicMiscCoupon.count({ where: { document: { bookingId: booking.id } } }),
    ])
    if (ticketCount + checkInCount + boardingPassCount + bagCount + ancillaryCouponCount > 0) {
      throw new DomainError('Seats can only be reconciled before any ticket, check-in, boarding, bag, or ancillary artifact exists.')
    }
    const rows = await prisma.seatAssignment.findMany({
      where: { bookingId: booking.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 51,
      include: { seat: { include: { seatMap: true, cabin: true } }, bookingSegment: true, bookingPassenger: true },
    })
    if (!rows.length) throw new DomainError('This booking has no seat assignments to reconcile.')
    if (rows.length > 50) throw new DomainError('Seat-assignment history exceeds the bounded reconciliation review.')
    const currentTravelerSegments = new Set<string>()
    for (const row of rows) {
      if (row.amount !== 0) throw new DomainError('Paid seat assignments need their own audited entitlement review; this reconciliation covers free seats only.')
      if (row.currencyCode !== booking.currencyCode) throw new DomainError('A seat assignment is priced in a currency other than the booking currency.')
      if (row.bookingPassenger?.bookingId !== booking.id || row.bookingSegment?.bookingId !== booking.id || row.carrierId !== booking.carrierId) {
        throw new DomainError('A seat assignment is not bound to this booking’s travelers and itinerary.')
      }
      if (!activeStatuses.includes(row.status)) {
        if (!['released', 'cancelled'].includes(row.status)) throw new DomainError('A seat assignment is in a state that reconciliation does not support.')
        continue
      }
      const travelerSegment = `${row.bookingPassengerId}:${row.bookingSegmentId}`
      if (currentTravelerSegments.has(travelerSegment)) throw new DomainError('A traveler holds more than one active seat on the same flight.')
      currentTravelerSegments.add(travelerSegment)
      const segment = row.bookingSegment
      if (segment.status !== 'confirmed') throw new DomainError('An active seat belongs to an itinerary segment that is no longer current.')
      if (row.seat?.seatMap?.flightInstanceId !== segment.flightInstanceId || row.seat.seatMap.status !== 'published' || row.seat.status !== 'available') {
        throw new DomainError('An active seat is not on the published seat map of its dated flight.')
      }
      if (row.seat.cabin?.code !== segment.cabinCode) throw new DomainError('An active seat is in a different cabin from the booked fare.')
      if (row.occupancyKey !== `${segment.flightInstanceId}:${row.seatId}`) throw new DomainError('An active seat has inconsistent occupancy.')
      const occupants = await prisma.seatAssignment.count({ where: { seatId: row.seatId, status: { in: activeStatuses }, bookingSegment: { flightInstanceId: segment.flightInstanceId } } })
      if (occupants !== 1) throw new DomainError('An active seat is also held by another assignment.')
    }
    const claim = await beginOperation(sudo, transactionContext, booking.carrierId, key, PRE_TICKET_SEAT_RECONCILIATION, request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true }
    await writeAudit(sudo, transactionContext, {
      carrierId: booking.carrierId, key: claim.storageKey, action: PRE_TICKET_SEAT_RECONCILIATION, aggregateType: 'Booking', aggregateId: booking.id,
      after: { seatAssignmentSetDigest: seatAssignmentSetDigest(rows) },
      metadata: { activeAssignments: currentTravelerSegments.size, historicalAssignments: rows.length - currentTravelerSegments.size },
    })
    const result = { resourceType: 'Booking', resourceId: booking.id, status: 'seats_reconciled', changed: true, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}

/** Initial ticket issuance admits a booking's seat rows only when the latest audited reconciliation covers exactly them. */
export async function hasReconciledPreTicketSeats(prisma: any, booking: { id: string; currencyCode: string }) {
  const rows = await prisma.seatAssignment.findMany({ where: { bookingId: booking.id }, select: { id: true, status: true, amount: true, currencyCode: true, updatedAt: true }, take: 51 })
  if (!rows.length || rows.length > 50 || rows.some((row: any) => row.amount !== 0 || row.currencyCode !== booking.currencyCode)) return false
  const audit = await prisma.auditEvent.findFirst({
    where: { action: PRE_TICKET_SEAT_RECONCILIATION, aggregateType: 'Booking', aggregateId: booking.id },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    select: { afterSummary: true },
  })
  return audit?.afterSummary?.seatAssignmentSetDigest === seatAssignmentSetDigest(rows)
}
