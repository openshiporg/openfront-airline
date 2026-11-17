import assert from 'node:assert/strict'
import test from 'node:test'

import { stripeSecretKey } from './stripe'

test('only well-formed Stripe secret or restricted keys are accepted', () => {
  assert.equal(stripeSecretKey({ secretKey: ' sk_test_abcdefghijklmnop ' }), 'sk_test_abcdefghijklmnop')
  assert.equal(stripeSecretKey({ secretKey: 'rk_live_abcdefghijklmnop' }), 'rk_live_abcdefghijklmnop')
  assert.equal(stripeSecretKey({ secretKey: 'pk_test_abcdefghijklmnop' }), null)
  assert.equal(stripeSecretKey({}), null)
  assert.equal(stripeSecretKey(null), null)
})

test('checkout sessions carry expires_at; expire and late refund hit the right Stripe paths', async () => {
  const realFetch = globalThis.fetch
  const calls: Array<{ url: string; method: string; body: string; key: string | null }> = []
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), method: init?.method ?? 'GET', body: String(init?.body ?? ''), key: init?.headers?.['idempotency-key'] ?? null })
    return new Response(JSON.stringify({ id: 'cs_test_abc', url: 'https://checkout', status: 'open', payment_status: 'unpaid' }))
  }) as typeof fetch
  try {
    const { createStripeCheckoutSession, expireStripeCheckoutSession, refundStripePaymentIntent } = await import('./stripe')
    await createStripeCheckoutSession('sk_test_abcdefghijklmnop', { bookingId: 'b1', recordLocator: 'ABC123', description: 'x', amount: 1000, currencyCode: 'USD', successUrl: 'https://s', cancelUrl: 'https://c', idempotencyKey: 'k1', expiresAt: 1_900_000_000 })
    assert.match(calls[0].body, /expires_at=1900000000/)
    await expireStripeCheckoutSession('sk_test_abcdefghijklmnop', 'cs_test_abc')
    assert.equal(calls[1].method, 'POST')
    assert.match(calls[1].url, /\/checkout\/sessions\/cs_test_abc\/expire$/)
    await refundStripePaymentIntent('sk_test_abcdefghijklmnop', 'pi_123', 'late-checkout-refund:pi_123')
    assert.match(calls[2].url, /\/refunds$/)
    assert.match(calls[2].body, /payment_intent=pi_123/)
    assert.equal(calls[2].key, 'late-checkout-refund:pi_123')
  } finally { globalThis.fetch = realFetch }
})
