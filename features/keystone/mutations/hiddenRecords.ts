import crypto from 'node:crypto'
import type { Context } from '.keystone/types'

import { requireFreshPermission } from '../access'
import { DomainError } from '../lib/domain-error'
import { writeAudit } from './airlineOperations'

// Leftover QA bookings are hidden from the desk lists, never deleted: payments, refunds and the audit trail stay
// intact, and a booking is still found by its exact reference. A traveler is hidden with them when every booking
// they are on is hidden. Administrators only; `hidden: false` brings them back.
export async function hideRecords(_root: unknown, args: { bookingIds: string[]; hidden: boolean }, context: Context) {
  const actor = await requireFreshPermission(context, 'canManageCarriers')
  const ids = [...new Set((args.bookingIds ?? []).map(String))]
  if (!ids.length || ids.length > 500) throw new DomainError('Choose between 1 and 500 bookings.')
  const prisma = context.prisma as any
  const bookings = await prisma.booking.findMany({ where: { id: { in: ids }, carrierId: actor.carrierId }, select: { id: true, passengers: { select: { passengerId: true } } } })
  if (bookings.length !== ids.length) throw new DomainError('Some of those bookings were not found.')
  const at = args.hidden ? new Date() : null
  await prisma.booking.updateMany({ where: { id: { in: ids } }, data: { hiddenAt: at } })
  const passengerIds = [...new Set(bookings.flatMap((booking: any) => booking.passengers.map((link: any) => link.passengerId)).filter(Boolean))] as string[]
  // Hide a traveler only when none of their bookings is still visible; unhide follows the booking.
  const stillVisible = args.hidden ? await prisma.bookingPassenger.findMany({ where: { passengerId: { in: passengerIds }, booking: { hiddenAt: null } }, select: { passengerId: true } }) : []
  const visibleSet = new Set(stillVisible.map((link: any) => link.passengerId))
  const passengerTargets = passengerIds.filter(id => !visibleSet.has(id))
  if (passengerTargets.length) await prisma.passenger.updateMany({ where: { id: { in: passengerTargets }, carrierId: actor.carrierId }, data: { hiddenAt: at } })
  await writeAudit(context.sudo() as any, context, { carrierId: actor.carrierId, key: `hide-records:${crypto.randomUUID()}`, action: args.hidden ? 'records.hide' : 'records.unhide', aggregateType: 'Booking', aggregateId: ids[0], after: { bookings: ids.length, passengers: passengerTargets.length }, metadata: { bookingIds: ids } })
  return { bookings: ids.length, passengers: passengerTargets.length }
}

// Travelers with no booking at all (abandoned QA profiles) by id.
export async function hidePassengers(_root: unknown, args: { passengerIds: string[]; hidden: boolean }, context: Context) {
  const actor = await requireFreshPermission(context, 'canManageCarriers')
  const ids = [...new Set((args.passengerIds ?? []).map(String))]
  if (!ids.length || ids.length > 500) throw new DomainError('Choose between 1 and 500 travelers.')
  const result = await (context.prisma as any).passenger.updateMany({ where: { id: { in: ids }, carrierId: actor.carrierId }, data: { hiddenAt: args.hidden ? new Date() : null } })
  await writeAudit(context.sudo() as any, context, { carrierId: actor.carrierId, key: `hide-passengers:${crypto.randomUUID()}`, action: args.hidden ? 'records.hide' : 'records.unhide', aggregateType: 'Passenger', aggregateId: ids[0], after: { passengers: result.count }, metadata: { passengerIds: ids } })
  return { bookings: 0, passengers: result.count }
}
