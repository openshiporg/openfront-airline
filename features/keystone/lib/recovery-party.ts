export type RecoveryPassengerState = {
  bookingPassengerId: string
  hasTicket: boolean
  activeTicket: boolean
  couponStatuses: string[]
  recoverableCouponCount: number
  checkInStatuses: string[]
  boardingPassStatuses: string[]
}

export type RecoveryPartyPartition = {
  eligiblePassengerIds: string[]
  boardedOrFlownPassengerIds: string[]
}

/** Select only ticketed, unboarded travelers; mixed parties never move boarded/flown passengers. */
export function partitionRecoveryParty(
  passengers: RecoveryPassengerState[],
  ticketedBooking: boolean,
): RecoveryPartyPartition {
  const eligiblePassengerIds: string[] = []
  const boardedOrFlownPassengerIds: string[] = []

  for (const passenger of passengers) {
    const hasBoardedOrFlownService = passenger.couponStatuses.some(status => status === 'boarded' || status === 'flown')
      || passenger.checkInStatuses.includes('boarded')
      || passenger.boardingPassStatuses.includes('boarded')
    if (hasBoardedOrFlownService) {
      boardedOrFlownPassengerIds.push(passenger.bookingPassengerId)
      continue
    }

    if (passenger.recoverableCouponCount > 1) {
      throw new Error(`Ticketed passenger ${passenger.bookingPassengerId} has multiple recoverable coupons for the disrupted segment.`)
    }
    const hasRecoverableCoupon = passenger.recoverableCouponCount === 1
    if ((passenger.activeTicket && !hasRecoverableCoupon) || (ticketedBooking && !passenger.hasTicket)) {
      throw new Error(`Ticketed passenger ${passenger.bookingPassengerId} lacks a recoverable coupon for the disrupted segment.`)
    }
    if (hasRecoverableCoupon) eligiblePassengerIds.push(passenger.bookingPassengerId)
  }

  if (!eligiblePassengerIds.length) {
    throw new Error('No unboarded ticketed passengers are eligible for recovery; boarded or flown passengers remain on the original service.')
  }

  return { eligiblePassengerIds, boardedOrFlownPassengerIds }
}
