import crypto from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

import { claimOutboxEvents, completeOutboxEvent, failOutboxEvent, renewOutboxLease } from './outbox'
import { processPaymentWebhookEvent } from './payment/process-webhook'
import { assertExternalWebhookUrl, assertPublicWebhookDestination } from './webhook-url'

export { assertExternalWebhookUrl } from './webhook-url'

/** An endpoint receives only topics it lists; [] means none and "*" is an explicit subscription to every topic. */
export function endpointSubscribesTo(eventTypes: unknown, topic: string) {
  const types = Array.isArray(eventTypes) ? eventTypes.filter((type): type is string => typeof type === 'string') : []
  return types.includes('*') || types.includes(topic)
}

export async function dispatchExternalEndpoints(prisma: PrismaClient, event: any, mayDispatch: () => Promise<boolean> = async () => true) {
  const endpoints = await prisma.webhookEndpoint.findMany({ where: { carrierId: event.carrierId, status: 'active' } })
  for (const endpoint of endpoints) {
    if (!endpointSubscribesTo(endpoint.eventTypes, event.topic)) continue
    if (!await mayDispatch()) throw new Error('Delivery lease lost or worker stopping.')
    const url = new URL(endpoint.url)
    assertExternalWebhookUrl(url)
    await assertPublicWebhookDestination(url)
    const timestamp = Math.floor(Date.now() / 1000)
    const body = JSON.stringify({ id: event.eventKey, type: event.topic, aggregateType: event.aggregateType, aggregateId: event.aggregateId, data: event.payload })
    const signature = crypto.createHmac('sha256', endpoint.secret).update(`${timestamp}.`).update(body).digest('hex')
    // Redirects are refused: the signed payload goes only to the admitted origin. The response body is never read.
    const response = await fetch(url, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/json', 'x-openfront-signature': `t=${timestamp},v1=${signature}`, 'x-openfront-event-id': event.eventKey }, body, signal: AbortSignal.timeout(10_000) })
    await response.body?.cancel().catch(() => undefined)
    const delivered = response.status >= 200 && response.status < 300
    if (!await mayDispatch()) throw new Error('Delivery lease lost after dispatch; acknowledgement remains unresolved.')
    await prisma.webhookEndpoint.update({ where: { id: endpoint.id }, data: delivered ? { lastAttemptedAt: new Date(), lastDeliveredAt: new Date(), failureCount: 0 } : { lastAttemptedAt: new Date(), failureCount: { increment: 1 } } })
    if (!delivered) throw new Error(response.status >= 300 && response.status < 400 ? `Webhook endpoint redirected (HTTP ${response.status}); redirects are not followed.` : `Webhook endpoint returned HTTP ${response.status}.`)
  }
}

export async function dispatchOutboxEvent(prisma: PrismaClient, event: any, mayDispatch: () => Promise<boolean> = async () => true) {
  if (event.topic === 'payment.webhook.received') {
    await processPaymentWebhookEvent(prisma, event.aggregateId, typeof event.payload?.providerId === 'string' ? event.payload.providerId : null)
    return
  }
  if (event.topic === 'integration.webhook.received') throw new Error('No domain adapter is installed for this retained integration event; provider success was not recorded.')
  await dispatchExternalEndpoints(prisma, event, mayDispatch)
}

export async function runOutboxWorkerCycle(prisma: PrismaClient, workerId: string, limit = 25, shouldStop: () => boolean = () => false) {
  const events = await claimOutboxEvents(prisma, workerId, limit)
  for (const event of events) {
    // Stop between deliveries on shutdown; unprocessed claims are reclaimed after the lease window.
    if (shouldStop()) break
    if (!await renewOutboxLease(prisma, event.id, event.leaseOwner)) continue
    try {
      await dispatchOutboxEvent(prisma, event, async () => !shouldStop() && await renewOutboxLease(prisma, event.id, event.leaseOwner))
      await completeOutboxEvent(prisma, event.id, event.leaseOwner)
    } catch (error) {
      try {
        await failOutboxEvent(prisma, event.id, event.leaseOwner, error)
      } catch {
        continue // The lease was lost; the current owner records the outcome.
      }
    }
  }
  return events.length
}
