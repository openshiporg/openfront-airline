import crypto from 'node:crypto'
import net from 'node:net'

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>
  socket?: { remoteAddress?: string | null }
}

function normalizeAddress(value: string) {
  const address = value.trim()
  return address.startsWith('::ffff:') ? address.slice(7) : address
}

function configuredTrustedProxies() {
  const configured = process.env.TRUSTED_PROXY_IPS?.split(',').map(normalizeAddress).filter(Boolean) ?? []
  // As in Restaurant: a missing allowlist means the direct peer is the client, and an invalid one disables
  // forwarding trust as a whole. Never throw per request; startup validation reports the missing policy.
  const valid = configured.every(address => net.isIP(address) !== 0) ? configured : []
  if (process.env.NODE_ENV !== 'production') return new Set([...valid, '127.0.0.1', '::1'])
  return new Set(valid)
}

/**
 * Honor forwarding headers only from explicitly trusted reverse proxies. X-Forwarded-For is walked from the
 * closest hop: each trusted proxy vouches for the hop before it, and the first untrusted hop is the client, so a
 * caller-supplied left-most entry cannot choose the identity behind an appending proxy.
 */
export function trustedClientAddress(request: RequestLike) {
  const peer = normalizeAddress(request.socket?.remoteAddress ?? '')
  if (!peer || net.isIP(peer) === 0) return 'unknown'
  const trusted = configuredTrustedProxies()
  if (!trusted.has(peer)) return peer
  const raw = request.headers?.['x-forwarded-for']
  const forwarded = Array.isArray(raw) ? raw.join(',') : raw
  if (!forwarded) return peer
  const hops = forwarded.length > 4096 ? [] : forwarded.split(',').map(normalizeAddress)
  if (!hops.length || hops.length > 32 || hops.some(address => net.isIP(address) === 0)) return 'unknown'
  let current = peer
  for (let index = hops.length - 1; index >= 0 && trusted.has(current); index--) current = hops[index]
  return current
}

export function durableRequestFingerprint(request: RequestLike, sessionSignal?: string) {
  // User-Agent is caller-controlled and trivially rotated; do not make it part
  // of a durable abuse key. Network identity is derived only from the direct
  // peer or an explicitly trusted proxy, then optionally bound to a session.
  return crypto.createHash('sha256').update(`${trustedClientAddress(request)}\u0000${sessionSignal ?? ''}`).digest('hex')
}
