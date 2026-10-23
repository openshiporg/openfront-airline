import assert from 'node:assert/strict'
import test from 'node:test'

import { travelDocumentTokenizationKey } from './travel-document-key'

const secret = 'x'.repeat(40)

test('a configured tokenization key is used as is', () => {
  assert.equal(travelDocumentTokenizationKey({ NODE_ENV: 'production', SESSION_SECRET: secret, TRAVEL_DOCUMENT_TOKENIZATION_KEY: 'k'.repeat(32) }), 'k'.repeat(32))
})

test('without one, a stable key is derived from the session secret and is not the secret itself', () => {
  const derived = travelDocumentTokenizationKey({ NODE_ENV: 'production', SESSION_SECRET: secret })
  assert.equal(derived, travelDocumentTokenizationKey({ NODE_ENV: 'production', SESSION_SECRET: secret }))
  assert.equal(derived.length, 64)
  assert.notEqual(derived, secret)
})
