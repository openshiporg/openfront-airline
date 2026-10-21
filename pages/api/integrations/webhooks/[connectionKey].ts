import crypto from 'node:crypto'
import type { NextApiRequest, NextApiResponse } from 'next'

import { keystoneContext } from '../../../../features/keystone/context'
import { verifyTimestampedWebhook, webhookSecretFromEnvironment } from '../../../../features/integrations/webhook-security'

export const config = { api: { bodyParser: false } }

async function readBoundedBody(req: NextApiRequest, maxBytes = 1_048_576) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > maxBytes) throw new Error('Payload too large.')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

const INSTALLED_INTEGRATION_EVENT_HANDLER = false

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  try {
    const connectionKey = String(req.query.connectionKey ?? '')
    const connection = await (keystoneContext.prisma as any).providerConnection.findUnique({
      where: { connectionKey },
      include: { carrier: true, provider: true },
    })
    if (!connection || connection.status !== 'active') return res.status(404).json({ error: 'Endpoint not found.' })
    const configuration = (connection.configuration ?? {}) as Record<string, unknown>
    const credentials = (connection.credentials ?? {}) as Record<string, unknown>
    const envName = String(configuration.webhookSecretEnv ?? '')
    const secret = envName ? webhookSecretFromEnvironment(envName) : process.env.NODE_ENV === 'production' ? undefined : String(credentials.webhookSecret ?? '')
    if (!secret) throw new Error('Webhook secret is not configured.')
    const body = await readBoundedBody(req)
    if (!verifyTimestampedWebhook(body, String(req.headers['x-openfront-signature'] ?? ''), secret)) return res.status(401).json({ error: 'Invalid signature.' })
    // No domain adapter handles integration events yet (outbox-worker.ts), so a verified event is refused instead of
    // being accepted as work that can only dead-letter. Already-received events stay retained for reconciliation.
    if (!INSTALLED_INTEGRATION_EVENT_HANDLER) return res.status(501).json({ error: 'No handler is installed for this connection’s events; nothing was accepted.' })
    const payload = JSON.parse(body.toString('utf8')) as Record<string, unknown>
    // Only the signed body identifies the event. Unsigned headers may restate it but never choose the dedupe key,
    // or a captured signed request could be replayed under fresh ids within the signature tolerance.
    const providerEventId = payload.id == null ? '' : String(payload.id)
    const eventType = payload.type == null ? '' : String(payload.type)
    const headerEventId = req.headers['x-provider-event-id']
    const headerEventType = req.headers['x-provider-event-type']
    if ((headerEventId !== undefined && String(headerEventId) !== providerEventId) || (headerEventType !== undefined && String(headerEventType) !== eventType)) {
      return res.status(400).json({ error: 'Event headers do not match the signed payload.' })
    }
    if (!providerEventId || !eventType) throw new Error('Provider event id and type are required.')
    const dedupeKey = crypto.createHash('sha256').update(`${connection.id}\u0000${providerEventId}`).digest('hex')
    const result = await (keystoneContext.prisma as any).$transaction(async (tx: any) => {
      const existing = await tx.webhookEvent.findUnique({ where: { dedupeKey }, select: { id: true } })
      if (existing) return { id: existing.id, replayed: true }
      const event = await tx.webhookEvent.create({ data: {
        carrierId: connection.carrierId, connectionId: connection.id,
        eventKey: `in:${dedupeKey}`, dedupeKey, providerEventId, direction: 'inbound', eventType,
        status: 'pending', signatureVerified: true, payload: payload,
        payloadSummary: { providerEventId, eventType }, occurredAt: new Date(),
      } })
      await tx.outboxEvent.create({ data: {
        carrierId: connection.carrierId, eventKey: `webhook:${dedupeKey}`,
        topic: 'integration.webhook.received', aggregateType: 'WebhookEvent', aggregateId: event.id,
        payload: { connectionId: connection.id, providerKey: connection.provider.providerKey, eventType, providerEventId },
        status: 'pending', availableAt: new Date(),
      } })
      return { id: event.id, replayed: false }
    })
    return res.status(result.replayed ? 200 : 202).json({ accepted: true, replayed: result.replayed })
  } catch (error) {
    console.error('Webhook ingestion failed', error)
    return res.status(400).json({ error: 'Webhook request could not be accepted.' })
  }
}
