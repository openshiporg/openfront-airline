import assert from 'node:assert/strict'
import test from 'node:test'

import { durableRequestFingerprint, railwayEdgeClientAddress, trustedClientAddress } from './request-identity'

function withEnv(value: string | undefined, run: () => void) {
  const previous = process.env.RAILWAY_ENVIRONMENT
  if (value === undefined) delete process.env.RAILWAY_ENVIRONMENT
  else process.env.RAILWAY_ENVIRONMENT = value
  try { run() } finally {
    if (previous === undefined) delete process.env.RAILWAY_ENVIRONMENT
    else process.env.RAILWAY_ENVIRONMENT = previous
  }
}

const edge = (realIp: string | undefined, peer = '100.64.0.7', extra: Record<string, string> = {}) => ({
  headers: { ...(realIp === undefined ? {} : { 'x-real-ip': realIp }), ...extra },
  socket: { remoteAddress: peer },
})

test('on Railway the edge X-Real-IP is the client, so rotating edge peers share one bucket', () => {
  withEnv('production', () => {
    assert.equal(trustedClientAddress(edge('198.51.100.4', '100.64.0.7')), '198.51.100.4')
    assert.equal(
      durableRequestFingerprint(edge('198.51.100.4', '100.64.0.7'), 'a@example.com'),
      durableRequestFingerprint(edge('198.51.100.4', '100.64.0.9'), 'a@example.com'),
    )
    assert.notEqual(
      durableRequestFingerprint(edge('198.51.100.4'), 'a@example.com'),
      durableRequestFingerprint(edge('198.51.100.5'), 'a@example.com'),
    )
  })
})

test('X-Forwarded-For never chooses the identity, and malformed X-Real-IP is ignored', () => {
  withEnv('production', () => {
    assert.equal(trustedClientAddress(edge('198.51.100.4', '100.64.0.7', { 'x-forwarded-for': '203.0.113.1' })), '198.51.100.4')
    assert.equal(railwayEdgeClientAddress(edge('1.2.3.4, 5.6.7.8')), null)
    assert.equal(railwayEdgeClientAddress(edge('not-an-ip')), null)
    assert.equal(railwayEdgeClientAddress(edge(undefined)), null)
    assert.equal(trustedClientAddress(edge(undefined, '100.64.0.7')), '100.64.0.7')
  })
})

test('loopback callers and non-Railway hosts never trust X-Real-IP', () => {
  withEnv('production', () => {
    assert.equal(railwayEdgeClientAddress(edge('198.51.100.4', '127.0.0.1')), null)
    assert.equal(railwayEdgeClientAddress(edge('198.51.100.4', '::1')), null)
  })
  withEnv(undefined, () => {
    assert.equal(railwayEdgeClientAddress(edge('198.51.100.4', '100.64.0.7')), null)
    assert.equal(trustedClientAddress(edge('198.51.100.4', '100.64.0.7')), '100.64.0.7')
  })
})
