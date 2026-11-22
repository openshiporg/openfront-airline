import crypto from 'node:crypto'
import type { Context } from '.keystone/types'

import { DomainError } from './domain-error'
import { resolveSessionSecret } from './session'

export function normalizeStorefrontToken(value: string) {
  const token = value?.trim()
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(token)) throw new DomainError('A valid shopping-session token is required.')
  return token
}

// A booking pass: the booking's current access hash, signed with the session secret. Issued after a traveler proves
// the booking reference and last name. It resolves to that hash, so expiry and revocation (a new access code) apply
// to it exactly as to the code itself.
const PASS_PREFIX = 'Pa1'
function passMac(accessTokenHash: string) {
  return crypto.createHmac('sha256', resolveSessionSecret()).update(`booking-pass:${accessTokenHash}`).digest('base64url')
}
export function signBookingPass(accessTokenHash: string) {
  if (!/^[0-9a-f]{64}$/.test(accessTokenHash)) throw new DomainError('Booking not found or inaccessible.')
  return `${PASS_PREFIX}${accessTokenHash}${passMac(accessTokenHash)}`
}
function passHash(token: string) {
  if (token.length !== 110 || !token.startsWith(PASS_PREFIX)) return null
  const hash = token.slice(3, 67), mac = token.slice(67)
  if (!/^[0-9a-f]{64}$/.test(hash)) return null
  const expected = Buffer.from(passMac(hash)), given = Buffer.from(mac)
  return expected.length === given.length && crypto.timingSafeEqual(expected, given) ? hash : null
}

export function hashStorefrontToken(value: string) {
  const token = normalizeStorefrontToken(value)
  return passHash(token) ?? crypto.createHash('sha256').update(token).digest('hex')
}

export function hasCurrentStorefrontBookingAccess(
  booking: { accessTokenHash?: string | null; accessTokenExpiresAt?: Date | string | null },
  expectedHash?: string | null,
  now = new Date(),
) {
  if (!expectedHash || booking.accessTokenHash !== expectedHash || !booking.accessTokenExpiresAt) return false
  const expiresAt = booking.accessTokenExpiresAt instanceof Date ? booking.accessTokenExpiresAt : new Date(booking.accessTokenExpiresAt)
  return !Number.isNaN(expiresAt.getTime()) && expiresAt > now
}

export function isStorefrontContext(context: Context) {
  return (context.session as any)?.data?.storefront === true
}

export function withStorefrontSession(context: Context, carrier: { id: string; code: string }, bookingId?: string) {
  return (context as any).withSession({
    itemId: '',
    listKey: 'User',
    data: { name: 'Storefront', email: '', carrier, approvedAgent: null, role: null, storefront: true, storefrontBookingId: bookingId },
  }) as Context
}
