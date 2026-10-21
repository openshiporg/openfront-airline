import crypto from 'node:crypto'
import type { NextApiRequest, NextApiResponse } from 'next'

import { keystoneContext } from '../../../../features/keystone/context'
import { verifyTimestampedWebhook, webhookSecretFromEnvironment } from '../../../../features/integrations/webhook-security'

export const config = { api: { bodyParser: false } }

async function readBody(req: NextApiRequest) {
  const chunks: Buffer[] = []; let size = 0
  for await (const chunk of req) { const buffer = Buffer.from(chunk); size += buffer.length; if (size > 1_048_576) throw new Error('Payload too large.'); chunks.push(buffer) }
  return Buffer.concat(chunks)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  try {
    const provider = await (keystoneContext.prisma as any).paymentProvider.findUnique({ where: { providerKey: String(req.query.providerKey ?? '') } })
    if (!provider || provider.adapterType !== 'stripe' || provider.status !== 'active') return res.status(404).json({ error: 'Endpoint not found.' })
    const configuration = (provider.configuration ?? {}) as Record<string, unknown>; const credentials = (provider.credentials ?? {}) as Record<string, unknown>
    const envName = String(configuration.webhookSecretEnv ?? '')
    const secret = envName ? webhookSecretFromEnvironment(envName) : process.env.NODE_ENV === 'production' ? undefined : String(credentials.webhookSecret ?? '')
    if (!secret) throw new Error('Webhook secret is not configured.')
    const body = await readBody(req)
    if (!verifyTimestampedWebhook(body, String(req.headers['stripe-signature'] ?? ''), secret)) return res.status(401).json({ error: 'Invalid signature.' })
    const event = JSON.parse(body.toString('utf8')) as any
    if (!event.id || !event.type) throw new Error('Malformed event.')
    const dedupeKey = crypto.createHash('sha256').update(`${provider.id}\u0000${event.id}`).digest('hex')
    const bodyDigest = crypto.createHash('sha256').update(body).digest('hex')
    const result = await (keystoneContext.prisma as any).$transaction(async (tx: any) => {
      const existing = await tx.webhookEvent.findUnique({ where: { dedupeKey } })
      if (existing) {
        // Only the same signed content is a replay; a reused event id with different content never replaces the original.
        const recordedDigest = (existing.payloadSummary as any)?.bodyDigest
        const sameContent = recordedDigest ? recordedDigest === bodyDigest : JSON.stringify(existing.payload) === JSON.stringify(event) && existing.eventType === event.type
        if (!sameContent) return { conflict: true }
        return { replayed: true, status: existing.status }
      }
      const webhook = await tx.webhookEvent.create({ data: {
        carrierId: provider.carrierId, eventKey: `stripe:${dedupeKey}`, dedupeKey, providerEventId: event.id,
        direction: 'inbound', eventType: event.type, status: 'pending', signatureVerified: true,
        payload: event, payloadSummary: { id: event.id, type: event.type, bodyDigest, signingProviderId: provider.id }, occurredAt: new Date(event.created * 1000 || Date.now()), attemptCount: 0,
      } })
      await tx.outboxEvent.create({ data: { carrierId: provider.carrierId, eventKey: `payment-webhook:${dedupeKey}`, topic: 'payment.webhook.received', aggregateType: 'WebhookEvent', aggregateId: webhook.id, payload: { providerId: provider.id, providerEventId: event.id }, status: 'pending', availableAt: new Date() } })
      return { replayed: false, status: 'pending' }
    })
    if (result.conflict) {
      console.warn('Payment webhook event id reused with different signed content; original retained.', { providerId: provider.id, dedupeKey })
      return res.status(409).json({ error: 'This event id was already received with different content.' })
    }
    return res.status(result.replayed ? 200 : 202).json({ accepted: true, replayed: result.replayed, status: result.status })
  } catch (error) {
    console.error('Payment webhook receipt failed', error)
    return res.status(400).json({ error: 'Webhook request could not be accepted.' })
  }
}
