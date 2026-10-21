import type { PrismaClient } from '@prisma/client'

import { DomainError } from './domain-error'

type Entitlement = { bookingPassengerId: string; status: string }

/** A shared segment is boarded only when every currently entitled traveler has boarded (or flown). */
export function deriveSegmentServiceStatus(entitlements: readonly Entitlement[]): 'confirmed' | 'checked_in' | 'boarded' {
  if (!entitlements.length) return 'confirmed'
  if (new Set(entitlements.map(item => item.bookingPassengerId)).size !== entitlements.length) throw new DomainError('Conflicting current passenger entitlements require reconciliation.')
  if (entitlements.every(item => ['boarded', 'flown'].includes(item.status))) return 'boarded'
  return entitlements.some(item => ['checked_in', 'boarded', 'flown'].includes(item.status)) ? 'checked_in' : 'confirmed'
}

// Call while holding the booking lock. No historical/replaced coupon may contribute to current party status.
export async function currentSegmentServiceStatus(prisma: Pick<PrismaClient, 'ticketCoupon'>, bookingId: string, segmentId: string) {
  const coupons = await prisma.ticketCoupon.findMany({
    where: { bookingSegmentId: segmentId, ticket: { bookingId }, status: { in: ['open', 'checked_in', 'boarded', 'flown'] } },
    select: { status: true, serviceObligationVersion: true, serviceObligation: { select: { bookingId: true, bookingPassengerId: true, status: true, currentVersion: true } } },
    orderBy: { id: 'asc' }, take: 101,
  })
  if (coupons.length > 100) throw new DomainError('Current segment entitlements require reconciliation before passenger service can continue.')
  const entitlements = coupons.flatMap(coupon => {
    const obligation = coupon.serviceObligation
    if (!obligation || obligation.bookingId !== bookingId || !['active', 'fulfilled'].includes(obligation.status ?? '')
      || coupon.serviceObligationVersion !== obligation.currentVersion) return []
    return [{ bookingPassengerId: obligation.bookingPassengerId ?? '', status: coupon.status ?? '' }]
  })
  if (entitlements.some(item => !item.bookingPassengerId)) throw new DomainError('A current entitlement has no traveler binding.')
  return deriveSegmentServiceStatus(entitlements)
}
