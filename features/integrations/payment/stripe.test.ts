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
