import { Prisma } from '@prisma/client'
import type { Context } from '.keystone/types'

import { requireFreshCarrierPermission } from '../access'
import { runSerializableTransaction, throwIfKeystonePrismaError } from '../lib/transactions'
import { beginOperation, finishOperation, inspectOperation, normalizeIdempotencyKey, writeAudit } from './airlineOperations'
import { DomainError } from '../lib/domain-error'

export const DEAD_LETTER_REQUEUE = 'outbox.dead-letter.requeue'

/** A requeue reason is operator evidence: bounded, non-empty text kept in the audit record. */
export function deadLetterRequeueReason(value: unknown) {
  const reason = String(value ?? '').trim()
  if (reason.length < 8 || reason.length > 500) throw new DomainError('Give a reason of 8 to 500 characters for requeueing this event.')
  return reason
}

/**
 * Schedules exactly one new delivery claim for a dead-lettered outbox event of the operator's own carrier. The event
 * keeps its identity (eventKey, payload, attempt count and last error), so a payment event is retried under the same
 * money identity; a payment inbox that already succeeded is completed idempotently by the worker instead of settling
 * again. Events with no installed handler cannot be requeued, since a new attempt could only fail the same way.
 */
export async function requeueDeadLetteredOutboxEvent(
  _root: unknown,
  args: { outboxEventId: string; expectedAttemptCount: number; reason: string; idempotencyKey: string },
  context: Context,
) {
  const reason = deadLetterRequeueReason(args.reason)
  return runSerializableTransaction(context, async transactionContext => {
    const prisma = transactionContext.prisma as any
    const located = await prisma.outboxEvent.findUnique({ where: { id: args.outboxEventId }, select: { id: true, carrierId: true } })
    if (!located?.carrierId) throw new DomainError('Resource not found or inaccessible.')
    await requireFreshCarrierPermission(transactionContext, 'canManageIntegrations', located.carrierId)
    const lock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "OutboxEvent" WHERE "id" = ${located.id} FOR UPDATE`)
    throwIfKeystonePrismaError(lock)
    const sudo = transactionContext.sudo() as any
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const request = { outboxEventId: located.id, expectedAttemptCount: args.expectedAttemptCount, reason }
    const inspected = await inspectOperation(sudo, located.carrierId, key, DEAD_LETTER_REQUEUE, request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true }

    const event = await prisma.outboxEvent.findUnique({ where: { id: located.id }, select: { id: true, carrierId: true, topic: true, aggregateId: true, status: true, attemptCount: true, lastError: true } })
    if (!event || event.carrierId !== located.carrierId) throw new DomainError('Resource not found or inaccessible.')
    if (event.status !== 'dead_lettered') throw new DomainError('Only a dead-lettered event can be requeued.')
    if (event.attemptCount !== args.expectedAttemptCount) throw new DomainError('This event changed since it was reviewed. Reload it before requeueing.')
    if (event.topic === 'integration.webhook.received') throw new DomainError('No domain adapter is installed for this integration event, so a new attempt cannot succeed.')

    let inbox: { status: string } | null = null
    if (event.topic === 'payment.webhook.received') {
      inbox = await prisma.webhookEvent.findFirst({ where: { id: event.aggregateId, carrierId: event.carrierId }, select: { status: true } })
      if (!inbox) throw new DomainError('The payment inbox record for this event was not found.')
      // A dead-lettered inbox becomes eligible again; its error and attempt history are kept. A succeeded inbox is
      // left as it is: the worker acknowledges it without a second settlement.
      if (inbox.status === 'dead_lettered') {
        await prisma.webhookEvent.updateMany({ where: { id: event.aggregateId, carrierId: event.carrierId, status: 'dead_lettered' }, data: { status: 'failed', nextAttemptAt: new Date() } })
      }
    }

    const claim = await beginOperation(sudo, transactionContext, event.carrierId, key, DEAD_LETTER_REQUEUE, request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true }
    const requeued = await prisma.outboxEvent.updateMany({
      where: { id: event.id, carrierId: event.carrierId, status: 'dead_lettered', attemptCount: event.attemptCount },
      data: { status: 'pending', availableAt: new Date(), leasedAt: null, leaseOwner: '' },
    })
    if (requeued.count !== 1) throw new DomainError('This event changed since it was reviewed. Reload it before requeueing.')
    await writeAudit(sudo, transactionContext, {
      carrierId: event.carrierId, key: claim.storageKey, action: DEAD_LETTER_REQUEUE, aggregateType: 'OutboxEvent', aggregateId: event.id,
      before: { status: 'dead_lettered', attemptCount: event.attemptCount, lastError: event.lastError ?? '', inboxStatus: inbox?.status ?? null },
      after: { status: 'pending' },
      metadata: { topic: event.topic, reason },
    })
    const result = { resourceType: 'OutboxEvent', resourceId: event.id, status: 'pending', changed: true, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}
