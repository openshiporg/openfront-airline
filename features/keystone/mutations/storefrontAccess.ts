import crypto from 'node:crypto'
import type { Context } from '.keystone/types'

import { DomainError } from '../lib/domain-error'
import { emailConfigured, sendBookingConfirmationEmail } from '../lib/mail'
import { formatMinorUnits } from '../lib/money'
import { consumeDurableRateLimit } from '../lib/rate-limit'
import { durableRequestFingerprint } from '../lib/request-identity'
import { hashStorefrontToken } from '../lib/storefront-session'
import { isConfiguredPublicCarrier } from './storefront'

// Booking confirmation email and self-service access-code recovery. Both need SMTP; without it the storefront
// says so instead of pretending a message was sent.

export function accessRecoveryEnabled() {
  return emailConfigured()
}

// Emails the booking's reference, itinerary and access code to its contact address. Best effort: never throws.
export async function emailBookingAccess(context: Context, bookingId: string, accessToken: string) {
  try {
    const booking = await (context.prisma as any).booking.findUnique({
      where: { id: bookingId },
      select: {
        recordLocator: true, contactEmail: true, totalAmount: true, currencyCode: true,
        carrier: { select: { name: true, code: true } },
        passengers: { select: { passenger: { select: { givenName: true, familyName: true } } } },
        segments: { orderBy: [{ sequence: 'asc' }, { id: 'asc' }], select: { flightInstance: { select: { flightNumber: true, scheduledDepartureAt: true, origin: { select: { iataCode: true, timezone: true } }, destination: { select: { iataCode: true } } } } } },
      },
    })
    if (!booking?.contactEmail) return false
    return await sendBookingConfirmationEmail({
      to: booking.contactEmail,
      carrierName: booking.carrier.name,
      carrierCode: booking.carrier.code,
      recordLocator: booking.recordLocator,
      accessToken,
      totalLabel: formatMinorUnits(booking.totalAmount, booking.currencyCode),
      travelers: booking.passengers.map((entry: any) => `${entry.passenger.givenName} ${entry.passenger.familyName}`),
      segments: booking.segments.filter((segment: any) => segment.flightInstance).map((segment: any) => {
        let departureLabel = new Date(segment.flightInstance.scheduledDepartureAt).toISOString()
        try { departureLabel = new Intl.DateTimeFormat('en-US', { timeZone: segment.flightInstance.origin.timezone || 'UTC', dateStyle: 'medium', timeStyle: 'short', timeZoneName: 'short' }).format(new Date(segment.flightInstance.scheduledDepartureAt)) } catch { /* keep ISO */ }
        return { flightNumber: segment.flightInstance.flightNumber, originCode: segment.flightInstance.origin.iataCode, destinationCode: segment.flightInstance.destination.iataCode, departureLabel }
      }),
    })
  } catch (error) {
    console.error(`Booking email for ${bookingId} failed:`, error instanceof Error ? error.message : 'unknown error')
    return false
  }
}

// Replaces the access code and emails the new one to the booking's contact address, when the reference and that
// email match. The answer is the same whether or not they do, so it never reveals a booking.
export async function recoverCustomerBookingAccess(
  _root: unknown,
  args: { carrierCode: string; recordLocator: string; email: string },
  context: Context,
) {
  if (!emailConfigured()) throw new DomainError('Access codes can’t be emailed right now. Contact the airline.')
  if (!await isConfiguredPublicCarrier((context as any).prisma, args.carrierCode)) throw new DomainError('Carrier is unavailable on this storefront.')
  await consumeDurableRateLimit(context.prisma as any, 'storefront.access-recovery.client', durableRequestFingerprint((context as any).req ?? {}), 5, 60 * 60_000)
  const recordLocator = args.recordLocator.trim().toUpperCase()
  const email = args.email.trim().toLowerCase()
  if (!/^[A-Z0-9]{5,8}$/.test(recordLocator) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return true
  const booking = await (context.prisma as any).booking.findFirst({
    where: { recordLocator, contactEmail: { equals: email, mode: 'insensitive' }, carrier: { code: args.carrierCode.trim().toUpperCase() } },
    select: { id: true, carrierId: true, accessTokenVersion: true },
  })
  if (!booking) return true
  const token = crypto.randomBytes(32).toString('base64url')
  const now = new Date()
  await (context.prisma as any).booking.update({ where: { id: booking.id }, data: { accessTokenHash: hashStorefrontToken(token), accessTokenExpiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60_000), accessTokenVersion: (booking.accessTokenVersion ?? 1) + 1 } })
  await (context.prisma as any).auditEvent.create({ data: { carrierId: booking.carrierId, eventKey: `booking-access-recovered:${booking.id}:${crypto.randomUUID()}`, action: 'booking.access-token.recover', aggregateType: 'Booking', aggregateId: booking.id, source: 'storefront', beforeSummary: {}, afterSummary: { accessRevoked: true, emailed: true }, metadata: {}, occurredAt: now } })
  await emailBookingAccess(context, booking.id, token)
  return true
}
