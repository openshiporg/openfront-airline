import type { PrismaClient } from '@prisma/client'

import { formatAirportTime } from '../airline/lib/time'
import { sendBookingNotice } from '../keystone/lib/booking-notices'
import { emailConfigured } from '../keystone/lib/mail'

// Traveler service messages driven by the outbox. Like the airlines' "trip alerts": an expired hold, a published delay
// or cancellation, and a day-of gate or time change each reach the booking's contact email once. Each recipient is
// recorded under the outbox event's key, so a retried event never emails a booking twice.

export const TRAVELER_NOTICE_TOPICS = new Set(['booking.unpaid-expired', 'disruption.publish', 'dated-flight.operations'])

type Notice = { bookingId: string; to: string; carrierName: string; recordLocator: string; subject: string; heading: string; lines: string[] }

async function bookingsOnFlight(prisma: PrismaClient, flightInstanceId: string) {
  return (prisma as any).booking.findMany({
    where: { status: { notIn: ['cancelled', 'completed'] }, contactEmail: { not: null }, segments: { some: { flightInstanceId, status: { in: ['confirmed', 'checked_in', 'disrupted'] } } } },
    select: { id: true, recordLocator: true, contactEmail: true, carrier: { select: { name: true } } },
    take: 500,
  })
}

async function noticesFor(prisma: PrismaClient, event: any): Promise<Notice[]> {
  const db = prisma as any
  if (event.topic === 'booking.unpaid-expired') {
    const booking = await db.booking.findUnique({ where: { id: event.aggregateId }, select: { id: true, recordLocator: true, contactEmail: true, carrier: { select: { name: true } } } })
    if (!booking?.contactEmail) return []
    return [{ bookingId: booking.id, to: booking.contactEmail, carrierName: booking.carrier?.name ?? '', recordLocator: booking.recordLocator, subject: `Reservation ${booking.recordLocator} expired`, heading: 'Your reservation expired', lines: ['We didn’t receive payment before the hold ran out, so the seats were released and nothing was charged.', 'Search again to book a new fare.'] }]
  }
  if (event.topic === 'disruption.publish') {
    const disruption = await db.disruption.findUnique({ where: { id: event.aggregateId }, select: { type: true, publicSummary: true, flightInstance: { select: { id: true, flightNumber: true, scheduledDepartureAt: true, origin: { select: { iataCode: true, timezone: true } }, destination: { select: { iataCode: true } }, carrier: { select: { code: true } } } } } })
    const flight = disruption?.flightInstance
    if (!flight) return []
    const label = `${flight.carrier?.code ?? ''} ${flight.flightNumber} ${flight.origin.iataCode}–${flight.destination.iataCode}`.trim()
    const when = formatAirportTime(flight.scheduledDepartureAt, flight.origin.timezone) ?? ''
    const cancelled = disruption.type === 'cancellation'
    return (await bookingsOnFlight(prisma, flight.id)).map((booking: any) => ({
      bookingId: booking.id, to: booking.contactEmail, carrierName: booking.carrier?.name ?? '', recordLocator: booking.recordLocator,
      subject: `${cancelled ? 'Flight cancelled' : 'Flight update'}: ${label}`,
      heading: cancelled ? `${label} is cancelled` : `Update for ${label}`,
      lines: [disruption.publicSummary, `Scheduled departure: ${when}.`, cancelled ? 'We’ll offer you another flight or a refund. Open your booking for the latest options, or contact the airline.' : 'Open your booking for the latest times.'],
    }))
  }
  if (event.topic === 'dated-flight.operations') {
    const after = event.payload?.after ?? {}
    const changedGate = typeof after.departureGate === 'string' && after.departureGate !== (event.payload?.before?.departureGate ?? '')
    const newEstimate = typeof after.estimatedDepartureAt === 'string'
    const delayed = after.status === 'delayed'
    if (!changedGate && !newEstimate && !delayed) return []
    const flight = await db.flightInstance.findUnique({ where: { id: event.aggregateId }, select: { id: true, status: true, flightNumber: true, departureGate: true, estimatedDepartureAt: true, scheduledDepartureAt: true, origin: { select: { iataCode: true, timezone: true } }, destination: { select: { iataCode: true } }, carrier: { select: { code: true } } } })
    if (!flight || ['departed', 'arrived', 'cancelled'].includes(flight.status)) return []
    const label = `${flight.carrier?.code ?? ''} ${flight.flightNumber} ${flight.origin.iataCode}–${flight.destination.iataCode}`.trim()
    const lines: string[] = []
    if (newEstimate && flight.estimatedDepartureAt) lines.push(`New estimated departure: ${formatAirportTime(flight.estimatedDepartureAt, flight.origin.timezone)}.`)
    else if (delayed) lines.push('Your flight is delayed. We’ll send the new time as soon as it’s set.')
    if (changedGate && flight.departureGate) lines.push(`Departure gate: ${flight.departureGate}.`)
    if (!lines.length) return []
    return (await bookingsOnFlight(prisma, flight.id)).map((booking: any) => ({
      bookingId: booking.id, to: booking.contactEmail, carrierName: booking.carrier?.name ?? '', recordLocator: booking.recordLocator,
      subject: `Flight update: ${label}`, heading: `Update for ${label}`, lines,
    }))
  }
  return []
}

/** Sends each traveler their notice once per outbox event; throws only if mail itself is unavailable for a retry. */
export async function dispatchTravelerNotices(prisma: PrismaClient, event: any) {
  if (!TRAVELER_NOTICE_TOPICS.has(event.topic) || !emailConfigured()) return 0
  const db = prisma as any
  let sent = 0
  for (const notice of await noticesFor(prisma, event)) {
    const eventKey = `traveler-notice:${event.eventKey}:${notice.bookingId}`
    if (await db.auditEvent.findUnique({ where: { eventKey }, select: { id: true } })) continue
    if (!await sendBookingNotice(notice)) continue
    await db.auditEvent.create({ data: { carrierId: event.carrierId, eventKey, action: 'traveler.notice.sent', aggregateType: 'Booking', aggregateId: notice.bookingId, source: 'system', beforeSummary: {}, afterSummary: { subject: notice.subject }, metadata: { topic: event.topic }, occurredAt: new Date() } }).catch(() => undefined)
    sent += 1
  }
  return sent
}
