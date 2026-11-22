import assert from 'node:assert/strict'
import test from 'node:test'

import { foreignPaymentEventReason } from './process-webhook'

const sessions: Record<string, { providerSessionId: string }> = { 'ps-own': { providerSessionId: 'cs_own' } }
const find = async (key: string) => sessions[key] ?? null
const completed = (id: string, key?: string) => ({ type: 'checkout.session.completed', data: { object: { id, metadata: key ? { payment_session_key: key } : {} } } })

test('events from other sites on the shared Stripe account are ignored, our own checkout is not', async () => {
  assert.equal(await foreignPaymentEventReason({ type: 'payment_intent.succeeded' }, find), 'event type payment_intent.succeeded is not used here')
  assert.equal(await foreignPaymentEventReason(completed('cs_other'), find), 'checkout belongs to another site')
  assert.equal(await foreignPaymentEventReason(completed('cs_other', 'ps-elsewhere'), find), 'checkout belongs to another site')
  assert.equal(await foreignPaymentEventReason(completed('cs_spoof', 'ps-own'), find), 'checkout belongs to another site')
  assert.equal(await foreignPaymentEventReason(completed('cs_own', 'ps-own'), find), null)
})
