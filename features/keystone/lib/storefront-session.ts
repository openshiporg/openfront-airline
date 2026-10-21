import crypto from 'node:crypto'
import type { Context } from '.keystone/types'

import { DomainError } from './domain-error'

export function normalizeStorefrontToken(value: string) {
  const token = value?.trim()
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(token)) throw new DomainError('A valid shopping-session token is required.')
  return token
}

export function hashStorefrontToken(value: string) {
  return crypto.createHash('sha256').update(normalizeStorefrontToken(value)).digest('hex')
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
