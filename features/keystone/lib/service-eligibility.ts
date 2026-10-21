import { DomainError } from './domain-error'

export type DatedFlightEligibilityState = {
  id?: string | null
  status?: string | null
  scheduledDepartureAt?: Date | string | null
  estimatedDepartureAt?: Date | string | null
  actualDepartureAt?: Date | string | null
  actualArrivalAt?: Date | string | null
}

const passengerProcessingFlightStatuses = new Set(['scheduled', 'open_for_sale', 'closed_for_sale', 'delayed'])

function timestamp(value: Date | string | null | undefined): number | null {
  if (value == null) return null
  const result = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(result) ? result : null
}

export function assertDatedFlightEligibleForAction(
  flight: DatedFlightEligibilityState | null | undefined,
  action: string,
  now = new Date(),
  options: { allowCancelledForOffload?: boolean } = {},
): void {
  if (!flight?.id || flight.actualDepartureAt || flight.actualArrivalAt) {
    throw new DomainError(`${action} requires a current dated service that has not departed or arrived.`)
  }
  if (flight.status === 'cancelled' && options.allowCancelledForOffload) return
  if (!passengerProcessingFlightStatuses.has(String(flight.status))) {
    throw new DomainError(`${action} is not allowed for a cancelled, departed, arrived, or unsupported dated service.`)
  }
  const departureAt = timestamp(flight.status === 'delayed' && flight.estimatedDepartureAt
    ? flight.estimatedDepartureAt
    : flight.scheduledDepartureAt)
  if (departureAt == null || departureAt <= now.getTime()) {
    throw new DomainError(`${action} requires a future scheduled departure; the dated service is missing, departed, or past departure.`)
  }
}

export type TicketableSegmentState = {
  id: string
  sequence: number
  status: string | null
  flightInstance?: DatedFlightEligibilityState | null
}

export function selectCurrentTicketableSegments<T extends TicketableSegmentState>(
  segments: T[] | null | undefined,
  now = new Date(),
): T[] {
  if (!Array.isArray(segments) || segments.length === 0 || segments.length > 50) {
    throw new DomainError('Booking must have between one and 50 itinerary segments before ticket issuance.')
  }
  const current: T[] = []
  for (const segment of segments) {
    if (segment.status === 'reaccommodated') continue
    if (segment.status !== 'confirmed') {
      throw new DomainError('Only confirmed current itinerary segments can be ticketed; resolve disrupted or terminal segment states first.')
    }
    assertDatedFlightEligibleForAction(segment.flightInstance, 'Ticket issuance', now)
    current.push(segment)
  }
  current.sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))
  if (!current.length) throw new DomainError('Booking has no active confirmed itinerary segments to ticket.')
  const seenSequences = new Set<number>()
  for (const [index, segment] of current.entries()) {
    if (!Number.isInteger(segment.sequence) || segment.sequence !== index + 1 || seenSequences.has(segment.sequence)) {
      throw new DomainError('Current ticketable itinerary slots must have unique, contiguous sequence numbers.')
    }
    seenSequences.add(segment.sequence)
  }
  return current
}

export type PassengerServiceTransition = 'board' | 'offload'

type PassengerServiceArtifactState = {
  booking: { id: string; carrierId: string | null; status: string | null; paymentStatus: string | null; ticketingStatus: string | null; currencyCode: string }
  segment: { id: string; carrierId: string | null; bookingId: string | null; flightInstanceId: string | null; status: string | null }
  flight: DatedFlightEligibilityState & { carrierId?: string | null }
  bookingPassenger: { id: string; carrierId?: string | null; passengerId: string | null }
  ticket: { id: string; carrierId?: string | null; bookingId: string | null; bookingPassengerId: string | null; passengerId: string | null; status: string | null }
  coupon: { id: string; carrierId?: string | null; ticketId: string | null; bookingSegmentId: string | null; serviceObligationId: string | null; serviceObligationVersion: number | null; status: string | null }
  obligation: { id: string; carrierId?: string | null; bookingId: string | null; bookingPassengerId: string | null; currentVersion: number | null; status: string | null }
  checkIn: { id: string; carrierId?: string | null; bookingId: string | null; bookingPassengerId: string | null; passengerId: string | null; bookingSegmentId: string | null; flightInstanceId: string | null; ticketCouponId: string | null; seatAssignmentId: string | null; status: string | null }
  boardingPass: { id: string; carrierId?: string | null; passengerId: string | null; checkInId: string | null; bookingSegmentId: string | null; seatAssignmentId: string | null; status: string | null; seatDesignatorSnapshot: string | null }
  seatAssignment: { id: string; carrierId?: string | null; bookingId: string | null; bookingPassengerId: string | null; passengerId: string | null; bookingSegmentId: string | null; seatId: string | null; occupancyKey: string | null; seatMapFlightInstanceId: string | null; seatMapStatus: string | null; seatDesignator: string | null; seatDesignatorSnapshot: string | null; amount: number | null; currencyCode: string | null; status: string | null }
}

export function assertPassengerServiceTransition(
  action: PassengerServiceTransition,
  state: PassengerServiceArtifactState,
  now = new Date(),
): void {
  const { booking, segment, flight, bookingPassenger, ticket, coupon, obligation, checkIn, boardingPass, seatAssignment } = state
  if (!['ticketed', 'in_progress'].includes(String(booking.status)) || booking.paymentStatus !== 'paid' || booking.ticketingStatus !== 'ticketed') {
    throw new DomainError('Passenger service requires an active, paid, ticketed booking.')
  }
  if (segment.bookingId !== booking.id || segment.flightInstanceId !== flight.id || !['checked_in', 'boarded', ...(action === 'offload' ? ['disrupted'] : [])].includes(String(segment.status))) {
    throw new DomainError(`Passenger ${action} requires the current booking segment and supported segment state.`)
  }
  assertDatedFlightEligibleForAction(flight, action === 'board' ? 'Boarding' : 'Offload', now, { allowCancelledForOffload: action === 'offload' })
  const expected = action === 'board'
    ? { pass: ['issued', 'reissued'], checkIn: 'checked_in', coupon: 'checked_in', seat: 'confirmed' }
    : { pass: ['boarded'], checkIn: 'boarded', coupon: 'boarded', seat: 'boarded' }
  const bindingsMatch = Boolean(booking.carrierId)
    && segment.carrierId === booking.carrierId
    && flight.carrierId === booking.carrierId
    && (bookingPassenger.carrierId == null || bookingPassenger.carrierId === booking.carrierId)
    && (ticket.carrierId == null || ticket.carrierId === booking.carrierId)
    && (coupon.carrierId == null || coupon.carrierId === booking.carrierId)
    && (obligation.carrierId == null || obligation.carrierId === booking.carrierId)
    && (checkIn.carrierId == null || checkIn.carrierId === booking.carrierId)
    && (boardingPass.carrierId == null || boardingPass.carrierId === booking.carrierId)
    && (seatAssignment.carrierId == null || seatAssignment.carrierId === booking.carrierId)
    && boardingPass.passengerId === bookingPassenger.passengerId
    && ticket.bookingId === booking.id
    && ticket.bookingPassengerId === bookingPassenger.id
    && ticket.passengerId === bookingPassenger.passengerId
    && ['issued', 'partially_used'].includes(String(ticket.status))
    && coupon.ticketId === ticket.id
    && coupon.bookingSegmentId === segment.id
    && coupon.serviceObligationId === obligation.id
    && coupon.status === expected.coupon
    && obligation.bookingId === booking.id
    && obligation.bookingPassengerId === bookingPassenger.id
    && obligation.status === 'active'
    && coupon.serviceObligationVersion != null
    && coupon.serviceObligationVersion === obligation.currentVersion
    && checkIn.bookingId === booking.id
    && checkIn.bookingPassengerId === bookingPassenger.id
    && checkIn.passengerId === bookingPassenger.passengerId
    && checkIn.bookingSegmentId === segment.id
    && checkIn.flightInstanceId === flight.id
    && checkIn.ticketCouponId === coupon.id
    && checkIn.status === expected.checkIn
    && boardingPass.checkInId === checkIn.id
    && boardingPass.bookingSegmentId === segment.id
    && boardingPass.seatAssignmentId === seatAssignment.id
    && expected.pass.includes(String(boardingPass.status))
    && seatAssignment.bookingId === booking.id
    && seatAssignment.bookingPassengerId === bookingPassenger.id
    && seatAssignment.passengerId === bookingPassenger.passengerId
    && seatAssignment.bookingSegmentId === segment.id
    && Boolean(seatAssignment.seatId)
    && seatAssignment.occupancyKey === `${flight.id}:${seatAssignment.seatId}`
    && seatAssignment.seatMapFlightInstanceId === flight.id
    && seatAssignment.seatMapStatus === 'published'
    && seatAssignment.seatDesignatorSnapshot === boardingPass.seatDesignatorSnapshot
    && seatAssignment.seatDesignator === seatAssignment.seatDesignatorSnapshot
    && seatAssignment.currencyCode === booking.currencyCode
    && seatAssignment.amount === 0
    && seatAssignment.status === expected.seat
    && checkIn.seatAssignmentId === seatAssignment.id
  if (!bindingsMatch) {
    throw new DomainError(`Passenger ${action} requires matching current ticket, coupon obligation version, boarding pass, check-in, and free seat states.`)
  }
}

export type CancellationArtifactState = {
  segments?: Array<{ status: string | null }>
  tickets?: Array<{ status: string | null; coupons?: Array<{
    status: string | null
    serviceObligationVersion?: number | null
    serviceObligation?: { status: string | null; currentVersion: number | null } | null
  }> }>
  checkIns?: Array<{ status: string | null; boardingPasses?: Array<{ status: string | null }> }>
  seatAssignments?: Array<{ status: string | null; amount: number | null }>
  bagCount: number
  activeAncillaryCouponCount: number
}

export function cancellationArtifactBlockers(state: CancellationArtifactState): string[] {
  const blockers = new Set<string>()
  if ((state.bagCount ?? 0) > 0) blockers.add('checked-baggage physical disposition')
  if ((state.activeAncillaryCouponCount ?? 0) > 0) blockers.add('open or used ancillary coupon disposition')
  if ((state.segments ?? []).some(segment => ['boarded', 'flown'].includes(String(segment.status)))) blockers.add('boarded or flown segment')
  if ((state.segments ?? []).some(segment => !['confirmed', 'checked_in', 'boarded', 'flown', 'offloaded', 'disrupted', 'reaccommodated', 'cancelled', 'refunded'].includes(String(segment.status)))) blockers.add('unknown or missing segment state')
  for (const ticket of state.tickets ?? []) {
    if (['partially_used', 'used'].includes(String(ticket.status))) blockers.add('partially used or used ticket')
    else if (!['pending', 'issued', 'suspended', 'voided', 'refunded', 'exchanged'].includes(String(ticket.status))) blockers.add('unknown or missing ticket state')
    for (const coupon of ticket.coupons ?? []) {
      if (['boarded', 'flown'].includes(String(coupon.status))) blockers.add('boarded or flown coupon')
      else if (!['open', 'checked_in', 'suspended', 'voided', 'refunded', 'exchanged'].includes(String(coupon.status))) blockers.add('unknown or missing ticket-coupon state')
      if (['open', 'checked_in', 'suspended'].includes(String(coupon.status))
        && (!coupon.serviceObligation || coupon.serviceObligation.status !== 'active'
          || coupon.serviceObligationVersion == null
          || coupon.serviceObligationVersion !== coupon.serviceObligation.currentVersion)) {
        blockers.add('ambiguous or stale current coupon obligation')
      }
    }
  }
  for (const checkIn of state.checkIns ?? []) {
    if (checkIn.status === 'boarded') blockers.add('boarded passenger check-in')
    else if (!['eligible', 'checked_in', 'blocked', 'offloaded', 'cancelled', 'not_started'].includes(String(checkIn.status))) blockers.add('unknown or missing check-in state')
    for (const pass of checkIn.boardingPasses ?? []) {
      if (pass.status === 'boarded') blockers.add('boarded passenger boarding pass')
      else if (!['issued', 'reissued', 'revoked'].includes(String(pass.status))) blockers.add('unknown or missing boarding-pass state')
    }
  }
  for (const seat of state.seatAssignments ?? []) {
    if (seat.status === 'boarded') blockers.add('boarded seat assignment')
    else if (!['held', 'assigned', 'confirmed', 'released', 'cancelled'].includes(String(seat.status))) blockers.add('unknown or missing seat-assignment state')
    if (seat.amount !== 0) blockers.add('paid or inconsistent seat assignment disposition')
  }
  return [...blockers].sort()
}

export function hasUnresolvedCancelledBookingArtifacts(state: CancellationArtifactState & {
  serviceObligations?: Array<{ status: string | null }>
}): boolean {
  const currentSegments = (state.segments ?? []).some(segment => ['confirmed', 'checked_in', 'boarded', 'offloaded', 'disrupted'].includes(String(segment.status)))
  const activeTickets = (state.tickets ?? []).some(ticket => ['pending', 'issued', 'partially_used', 'used', 'suspended'].includes(String(ticket.status)))
  const activeCoupons = (state.tickets ?? []).some(ticket => (ticket.coupons ?? []).some(coupon => ['open', 'checked_in', 'suspended', 'boarded', 'flown'].includes(String(coupon.status))))
  const activeCheckIns = (state.checkIns ?? []).some(checkIn => checkIn.status !== 'cancelled')
  const activePasses = (state.checkIns ?? []).some(checkIn => (checkIn.boardingPasses ?? []).some(pass => ['issued', 'reissued', 'boarded'].includes(String(pass.status))))
  const activeSeats = (state.seatAssignments ?? []).some(seat => ['held', 'assigned', 'confirmed', 'boarded'].includes(String(seat.status)))
  const activeObligations = (state.serviceObligations ?? []).some(obligation => obligation.status === 'active')
  return currentSegments || activeTickets || activeCoupons || activeCheckIns || activePasses || activeSeats || activeObligations
    || state.bagCount > 0 || state.activeAncillaryCouponCount > 0
}

export function ticketIssuanceArtifactBlockers(input: {
  ticketCount: number
  obligationCount: number
  checkInCount: number
  boardingPassCount: number
  seatAssignmentCount: number
  bagCount: number
  ancillaryCouponCount: number
}): string[] {
  const blockers: string[] = []
  if (input.ticketCount !== 0) blockers.push('existing ticket history')
  if (input.obligationCount !== 0) blockers.push('existing service-obligation history')
  if (input.checkInCount !== 0 || input.boardingPassCount !== 0) blockers.push('check-in or boarding-pass artifacts')
  if (input.seatAssignmentCount !== 0) blockers.push('seat-assignment artifacts')
  if (input.bagCount !== 0) blockers.push('baggage artifacts')
  if (input.ancillaryCouponCount !== 0) blockers.push('existing ancillary coupon artifacts')
  return blockers
}
