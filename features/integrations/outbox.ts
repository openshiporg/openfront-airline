import crypto from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'

const MAX_ATTEMPTS = 8
const LEASE_MS = 5 * 60_000

// A lease is live only while it is younger than the reclaim window. Every completion, failure and renewal is a
// compare-and-set on id/status/owner/live lease, so an attempt that was reclaimed by another worker instance (the
// runtime gives each process its own instance identity) can never overwrite its successor's result.
function liveLease(id: string, workerId: string) {
  return { id, status: 'processing' as const, leaseOwner: workerId, leasedAt: { gt: new Date(Date.now() - LEASE_MS) } }
}

export async function claimOutboxEvents(prisma: PrismaClient, workerId: string = crypto.randomUUID(), limit = 25) {
  const boundedLimit = Math.max(1, Math.min(limit, 100))
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "OutboxEvent"
      WHERE (
        ("status" IN ('pending', 'failed') AND "availableAt" <= NOW())
        OR ("status" = 'processing' AND "leasedAt" < NOW() - INTERVAL '5 minutes')
      )
      ORDER BY "availableAt", "createdAt"
      LIMIT ${boundedLimit} FOR UPDATE SKIP LOCKED
    `)
    if (!rows.length) return []
    const ids = rows.map(row => row.id)
    // This opaque claim identity is new for every claim, even when the same logical worker reclaims its own row.
    const claimOwner = `${workerId}:${crypto.randomUUID()}`
    await tx.outboxEvent.updateMany({
      where: { id: { in: ids } },
      data: { status: 'processing', leasedAt: new Date(), leaseOwner: claimOwner, attemptCount: { increment: 1 } },
    })
    return tx.outboxEvent.findMany({ where: { id: { in: ids } }, orderBy: { createdAt: 'asc' } })
  })
}

/** Extends a live lease before more work is done under it; false means the attempt lost ownership. */
export async function renewOutboxLease(prisma: PrismaClient, id: string, workerId: string) {
  const result = await prisma.outboxEvent.updateMany({ where: liveLease(id, workerId), data: { leasedAt: new Date() } })
  return result.count === 1
}

export async function completeOutboxEvent(prisma: PrismaClient, id: string, workerId: string) {
  const result = await prisma.outboxEvent.updateMany({
    where: liveLease(id, workerId),
    data: { status: 'delivered', deliveredAt: new Date(), leasedAt: null, leaseOwner: '', lastError: '' },
  })
  if (result.count !== 1) throw new Error('Outbox lease is no longer owned by this worker.')
}

export async function failOutboxEvent(prisma: PrismaClient, id: string, claimOwner: string, _error: unknown) {
  return prisma.$transaction(async tx => {
    const event = await tx.outboxEvent.findFirst({ where: liveLease(id, claimOwner) })
    if (!event) throw new Error('Outbox lease is no longer owned by this worker.')
    const attemptCount = event.attemptCount ?? 0
    const deadLettered = attemptCount >= MAX_ATTEMPTS
    const availableAt = deadLettered ? event.availableAt : new Date(Date.now() + Math.min(60_000, 2 ** attemptCount * 1_000))
    // Error text from an external receiver can include secrets or private paths. Keep a bounded safe classification.
    const lastError = 'Delivery attempt failed; inspect the correlated event and receiver acknowledgement.'
    const result = await tx.outboxEvent.updateMany({
      where: liveLease(id, claimOwner),
      data: { status: deadLettered ? 'dead_lettered' : 'failed', leasedAt: null, leaseOwner: '', availableAt, lastError },
    })
    if (result.count !== 1) throw new Error('Outbox lease is no longer owned by this worker.')
    // The event CAS and related inbox failure commit together. No stale attempt can mutate the inbox after losing
    // its claim, and a committed financial inbox success is terminal even if acknowledgement later failed.
    if (['payment.webhook.received', 'integration.webhook.received'].includes(event.topic)) {
      await tx.webhookEvent.updateMany({
        where: { id: event.aggregateId, carrierId: event.carrierId, status: { in: ['pending', 'processing', 'failed'] } },
        data: { status: deadLettered ? 'dead_lettered' : 'failed', errorMessage: lastError, lastAttemptedAt: new Date(), nextAttemptAt: availableAt, attemptCount },
      })
    }
    return { deadLettered }
  })
}
