import crypto, { createHmac, timingSafeEqual } from 'node:crypto'
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
const INTERNAL_IDENTITY_MAX_AGE_MS = 90_000

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

/**
 * The end user's identity forwarded by this app's own server-side GraphQL calls (hospital 861591a pattern).
 * Accepted only from a LOOPBACK socket with a fresh (<= 90s) valid HMAC of SESSION_SECRET (>= 32 chars).
 */
export function verifiedInternalIdentity(
  headers: Record<string, string | string[] | undefined>,
  socketAddress: string | null | undefined,
  secret: string = String(process.env.SESSION_SECRET || ''),
  now: number = Date.now(),
) {
  const loopback = /^(?:127\.|::1$|::ffff:127\.)/.test(String(socketAddress || ''))
  if (!loopback || secret.length < 32) return null
  const identity = String(headers['x-openfront-client-identity'] || '')
  const timestamp = String(headers['x-openfront-client-timestamp'] || '')
  const signature = String(headers['x-openfront-client-signature'] || '')
  if (!/^[a-f0-9]{64}$/.test(identity) || !/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) return null
  const age = Math.abs(now - Number(timestamp) * 1_000)
  if (!Number.isFinite(age) || age > INTERNAL_IDENTITY_MAX_AGE_MS) return null
  const expected = createHmac('sha256', secret).update(`${timestamp}:${identity}`).digest('hex')
  return safeEqual(signature, expected) ? `forwarded:${identity}` : null
}

/**
 * Railway's HTTP edge overwrites X-Real-IP with the connecting client before forwarding (a caller-sent value is
 * replaced; grocery proved this live), while the socket peer is one of several changing edge addresses. So on
 * Railway (RAILWAY_ENVIRONMENT, set by the platform) a single valid X-Real-IP from a non-loopback peer is the client.
 * Loopback callers are this app's own server and are handled by the signed internal identity instead.
 */
export function railwayEdgeClientAddress(request: RequestLike) {
  if (!process.env.RAILWAY_ENVIRONMENT) return null
  const peer = normalizeAddress(request.socket?.remoteAddress ?? '')
  if (!peer || /^(?:127\.|::1$)/.test(peer)) return null
  const raw = request.headers?.['x-real-ip']
  const value = normalizeAddress(String(Array.isArray(raw) ? raw[0] ?? '' : raw ?? ''))
  if (!value || value.length > 64 || value.includes(',') || net.isIP(value) === 0) return null
  return value.toLowerCase()
}

export function trustedClientAddress(request: RequestLike) {
  // 1) verified internal identity (loopback + valid HMAC), 2) Railway edge X-Real-IP, 3) trusted-proxy logic, 4) socket.
  const internal = verifiedInternalIdentity(request.headers ?? {}, request.socket?.remoteAddress)
  if (internal) return internal
  const edge = railwayEdgeClientAddress(request)
  if (edge) return edge
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
