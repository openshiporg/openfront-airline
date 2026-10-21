export type RefundCleanupGate =
  | 'booking_desk_cancel_review'
  | 'blocked_by_boarded_or_flown'
  | 'blocked_by_artifact_disposition'
  | 'cancelled_requires_reconciliation'
  | 'read_only'
  | 'review_required'

export type CouponStatusGroup = { bookingSegmentId: string; status: string | null; _count?: { _all?: number } }

function statusCounts(rows: CouponStatusGroup[], segmentId: string) {
  return rows.filter(row => row.bookingSegmentId === segmentId).reduce<Record<string, number>>((counts, row) => {
    const status = row.status ?? 'unknown'
    counts[status] = row._count?._all ?? 0
    return counts
  }, {})
}

function total(counts: Record<string, number>) {
  return Object.values(counts).reduce((sum, count) => sum + count, 0)
}

export function refundCleanupCouponSummary(ticketRows: CouponStatusGroup[], ancillaryRows: CouponStatusGroup[], segmentId: string) {
  const tickets = statusCounts(ticketRows, segmentId)
  const ancillary = statusCounts(ancillaryRows, segmentId)
  return {
    ticketCoupons: total(tickets),
    activeTicketCoupons: ['open', 'checked_in', 'boarded', 'suspended', 'unknown'].reduce((sum, status) => sum + (tickets[status] ?? 0), 0),
    refundedTicketCoupons: tickets.refunded ?? 0,
    voidedTicketCoupons: tickets.voided ?? 0,
    boardedCoupons: (tickets.boarded ?? 0) + (tickets.flown ?? 0),
    ancillaryCoupons: total(ancillary),
    activeAncillaryCoupons: ['open', 'used', 'unknown'].reduce((sum, status) => sum + (ancillary[status] ?? 0), 0),
    refundedAncillaryCoupons: ancillary.refunded ?? 0,
    voidedAncillaryCoupons: ancillary.voided ?? 0,
  }
}

export function refundCleanupGate(input: {
  canManageBookings: boolean
  bookingStatus: string
  paymentStatus: string
  ticketingStatus?: string
  boardedOrFlownSegmentCount: number
  boardedPassengerArtifactCount?: number
  bagRecordCount?: number
  paidOrInconsistentSeatCount?: number
  activeAncillaryCouponCount?: number
  activePassengerArtifactCount?: number
}): RefundCleanupGate {
  const boardedOrFlown = input.boardedOrFlownSegmentCount > 0 || (input.boardedPassengerArtifactCount ?? 0) > 0
  if (boardedOrFlown) return 'blocked_by_boarded_or_flown'

  const dispositionBlocked = (input.bagRecordCount ?? 0) > 0
    || (input.paidOrInconsistentSeatCount ?? 0) > 0
    || (input.activeAncillaryCouponCount ?? 0) > 0
  if (input.bookingStatus === 'cancelled' && (dispositionBlocked || (input.activePassengerArtifactCount ?? 0) > 0)) {
    return 'cancelled_requires_reconciliation'
  }
  if (dispositionBlocked) return 'blocked_by_artifact_disposition'
  if (!input.canManageBookings) return 'read_only'
  if (input.paymentStatus === 'refunded' && !['cancelled', 'completed'].includes(input.bookingStatus)) {
    return 'booking_desk_cancel_review'
  }
  return 'review_required'
}
