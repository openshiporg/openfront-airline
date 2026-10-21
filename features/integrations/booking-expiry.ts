import { Prisma, type PrismaClient } from '@prisma/client'

function dueBookingQuery() {
  return Prisma.sql`
    SELECT "id"
    FROM "Booking"
    WHERE "status" = 'pending'
      AND "paymentStatus" IN ('unpaid', 'failed')
      AND CASE
        WHEN COALESCE("metadata"->>'paymentDueAt', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{1,6})?Z$'
        THEN ("metadata"->>'paymentDueAt')::timestamptz
        ELSE NULL
      END <= NOW()
      AND NOT EXISTS (SELECT 1 FROM "Payment" payment WHERE payment."booking" = "Booking"."id" AND payment."status" IN ('authorized', 'captured', 'partially_refunded'))
      AND NOT EXISTS (SELECT 1 FROM "ManualPaymentEvidence" evidence WHERE evidence."booking" = "Booking"."id" AND evidence."status" IN ('submitted', 'approved', 'consumed'))
      AND NOT EXISTS (SELECT 1 FROM "Ticket" ticket WHERE ticket."booking" = "Booking"."id")
      AND NOT EXISTS (SELECT 1 FROM "CheckIn" checkin WHERE checkin."booking" = "Booking"."id")
      AND COALESCE("metadata"->>'expiryBlockedAt', '') = ''
    ORDER BY ("metadata"->>'paymentDueAt'), "id"
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  `
}

/** Expire unpaid storefront bookings without deleting immutable commercial evidence. */
export async function expireUnpaidBookings(prisma: PrismaClient, limit = 25) {
  let expiredBookings = 0
  let skippedBookings = 0
  for (let index = 0; index < limit; index += 1) {
    let candidateId: string | undefined
    const outcome = await prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>(dueBookingQuery())
      const id = rows[0]?.id
      if (!id) return 'empty' as const
      candidateId = id
      const booking = await tx.booking.findUnique({
        where: { id },
        include: {
          passengers: { select: { id: true } },
          segments: { select: { id: true, status: true, inventoryBucketId: true } },
          payments: { select: { status: true } },
          paymentSessions: { select: { id: true, status: true } },
          seatAssignments: { select: { id: true, status: true } },
          tickets: { select: { id: true } },
          checkIns: { select: { id: true } },
          manualPaymentEvidence: { select: { id: true, status: true } },
        },
      })
      if (!booking || booking.status !== 'pending' || !['unpaid', 'failed'].includes(String(booking.paymentStatus))) return 'skipped' as const
      if (booking.payments.some(payment => ['authorized', 'captured', 'partially_refunded'].includes(String(payment.status))) || booking.tickets.length || booking.checkIns.length || booking.manualPaymentEvidence.some(evidence => ['submitted', 'approved', 'consumed'].includes(String(evidence.status)))) return 'skipped' as const

      const activeSegments = booking.segments.filter(segment => segment.inventoryBucketId && !['reaccommodated', 'cancelled', 'refunded'].includes(String(segment.status)))
      const bucketIds = [...new Set(activeSegments.map(segment => segment.inventoryBucketId as string))].sort()
      if (bucketIds.length) {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "InventoryBucket" WHERE "id" IN (${Prisma.join(bucketIds)}) ORDER BY "id" FOR UPDATE`)
        for (const bucketId of bucketIds) {
          const quantity = activeSegments.filter(segment => segment.inventoryBucketId === bucketId).length * booking.passengers.length
          const released = await tx.inventoryBucket.updateMany({ where: { id: bucketId, carrierId: booking.carrierId, sold: { gte: quantity } }, data: { sold: { decrement: quantity } } })
          if (released.count !== 1) throw new Error(`Expired booking ${booking.id} could not safely release sold inventory.`)
        }
      }

      const now = new Date()
      await tx.paymentSession.updateMany({ where: { id: { in: booking.paymentSessions.filter(session => ['created', 'pending', 'authorized'].includes(String(session.status))).map(session => session.id) } }, data: { status: 'cancelled', completedAt: now } })
      await tx.seatAssignment.updateMany({ where: { id: { in: booking.seatAssignments.filter(seat => ['held', 'assigned', 'confirmed'].includes(String(seat.status))).map(seat => seat.id) } }, data: { status: 'cancelled', occupancyKey: null, releasedAt: now } })
      await tx.bookingSegment.updateMany({ where: { id: { in: activeSegments.map(segment => segment.id) } }, data: { status: 'cancelled' } })
      const cancelled = await tx.booking.updateMany({ where: { id: booking.id, status: 'pending', paymentStatus: { in: ['unpaid', 'failed'] } }, data: { status: 'cancelled', cancelledAt: now, metadata: { ...(booking.metadata as Record<string, unknown> ?? {}), expiredUnpaidAt: now.toISOString() } } })
      if (cancelled.count !== 1) throw new Error(`Expired booking ${booking.id} changed while being compensated.`)
      const eventKey = `booking-unpaid-expired:${booking.id}`
      await tx.auditEvent.upsert({ where: { eventKey }, update: {}, create: { carrierId: booking.carrierId, eventKey, action: 'booking.unpaid-expire', aggregateType: 'Booking', aggregateId: booking.id, source: 'system', beforeSummary: { status: 'pending', paymentStatus: booking.paymentStatus }, afterSummary: { status: 'cancelled' }, metadata: { releasedPassengerSegments: activeSegments.length * booking.passengers.length }, occurredAt: now } })
      await tx.outboxEvent.upsert({ where: { eventKey }, update: {}, create: { carrierId: booking.carrierId, eventKey, topic: 'booking.unpaid-expired', aggregateType: 'Booking', aggregateId: booking.id, payload: {}, status: 'pending', availableAt: now } })
      return 'expired' as const
    }).catch(async error => {
      if (!candidateId) throw error
      // The oldest due booking is selected first, so one booking that cannot be compensated would otherwise be
      // retried forever and stall expiry, outbox delivery, and the worker heartbeat. Park it for operator review.
      await markExpiryBlocked(prisma, candidateId, error)
      return 'blocked' as const
    })
    if (outcome === 'empty') break
    if (outcome === 'expired') expiredBookings += 1
    else skippedBookings += 1
  }
  return { expiredBookings, skippedBookings }
}

async function markExpiryBlocked(prisma: PrismaClient, bookingId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ component: 'unpaid-booking-expiry', status: 'blocked', bookingId, error: message }))
  await prisma.$transaction(async tx => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { carrierId: true, metadata: true } })
    if (!booking) return
    const blockedAt = new Date()
    const metadata = booking.metadata && typeof booking.metadata === 'object' && !Array.isArray(booking.metadata) ? booking.metadata : {}
    await tx.booking.update({ where: { id: bookingId }, data: { metadata: { ...metadata, expiryBlockedAt: blockedAt.toISOString(), expiryBlockedReason: message.slice(0, 500) } } })
    const eventKey = `booking-unpaid-expiry-blocked:${bookingId}:${blockedAt.getTime()}`
    await tx.auditEvent.create({ data: { carrierId: booking.carrierId, eventKey, action: 'booking.unpaid-expire-blocked', aggregateType: 'Booking', aggregateId: bookingId, source: 'system', beforeSummary: {}, afterSummary: { expiryBlockedAt: blockedAt.toISOString() }, metadata: { reason: message.slice(0, 500) }, occurredAt: blockedAt } })
  })
}
