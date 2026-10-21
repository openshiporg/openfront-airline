export const RECOVERY_FLIGHT_PAGE_SIZE = 50
export const RECOVERY_DISRUPTION_PAGE_SIZE = 50
export const RECOVERY_AFFECTED_SEGMENT_PAGE_SIZE = 100

export const RECOVERY_DESK_QUERY = `query RecoveryDesk(
  $from: DateTime!,
  $serviceCursor: FlightInstanceWhereUniqueInput,
  $serviceSkip: Int!,
  $disruptionCursor: DisruptionWhereUniqueInput,
  $disruptionSkip: Int!
) {
  flightInstances(
    where: { scheduledDepartureAt: { gte: $from }, status: { in: [scheduled, open_for_sale, delayed] } },
    take: ${RECOVERY_FLIGHT_PAGE_SIZE + 1}, cursor: $serviceCursor, skip: $serviceSkip,
    orderBy: [{ scheduledDepartureAt: asc }, { id: asc }]
  ) {
    id flightNumber serviceDate scheduledDepartureAt status origin { iataCode } destination { iataCode }
    inventoryBuckets { id status bookingClassCode baseAmount taxAmount currencyCode cabin { code name } fareBrand { code name } authorized sold held blocked }
  }
  flightInstancesCount(where: { scheduledDepartureAt: { gte: $from }, status: { in: [scheduled, open_for_sale, delayed] } })
  disruptions(
    where: { status: { in: [published, recovering] } },
    take: ${RECOVERY_DISRUPTION_PAGE_SIZE + 1}, cursor: $disruptionCursor, skip: $disruptionSkip,
    orderBy: [{ detectedAt: desc }, { id: asc }]
  ) {
    id disruptionKey status publicSummary flightInstance { id flightNumber origin { iataCode } destination { iataCode } }
  }
  disruptionsCount(where: { status: { in: [published, recovering] } })
}`

export const RECOVERY_AFFECTED_SEGMENTS_QUERY = `query RecoveryAffectedSegments($disruptionId: ID!, $cursor: BookingSegmentWhereUniqueInput, $skip: Int!) {
  disruptions(where: { id: { equals: $disruptionId } }, take: 1) {
    id status
    affectedSegmentsCount(where: { status: { equals: disrupted } })
    affectedSegments(where: { status: { equals: disrupted } }, orderBy: [{ sequence: asc }, { id: asc }], take: ${RECOVERY_AFFECTED_SEGMENT_PAGE_SIZE + 1}, cursor: $cursor, skip: $skip) {
      id sequence status booking { id recordLocator status paymentStatus ticketingStatus }
    }
  }
}`

export type RecoveryAffectedSegment = {
  id: string
  sequence: number
  status: string
  booking: {
    id: string
    recordLocator: string
    status: string
    paymentStatus: string
    ticketingStatus: string
  }
}

export type RecoveryFlightOption = {
  id: string
  flightNumber: string
  serviceDate: string
  scheduledDepartureAt: string
  status: string
  origin: { iataCode: string }
  destination: { iataCode: string }
  inventoryBuckets: Array<{ id: string; status: string; bookingClassCode?: string; baseAmount?: number; taxAmount?: number; currencyCode?: string; cabin?: { code: string; name: string } | null; fareBrand?: { code: string; name: string } | null; authorized: number; sold: number; held: number; blocked: number }>
}

export type RecoveryDisruptionOption = {
  id: string
  disruptionKey: string
  status: string
  publicSummary?: string | null
  flightInstance?: { id: string; flightNumber: string; origin: { iataCode: string }; destination: { iataCode: string } } | null
}

export type RecoveryOuterPage<T extends { id: string }> = {
  items: T[]
  pageSize: number
  totalCount: number
  hasNextPage: boolean
  nextCursor: string | null
}

function boundedCursorPage<T extends { id: string }>(rows: T[], totalCount: number, pageSize: number): RecoveryOuterPage<T> {
  const items = rows.slice(0, pageSize)
  const hasNextPage = rows.length > pageSize
  return {
    items,
    pageSize,
    totalCount,
    hasNextPage,
    nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null,
  }
}

export function recoveryOuterPage<T extends { id: string }>(rows: T[], totalCount: number, pageSize: number) {
  return boundedCursorPage(rows, totalCount, pageSize)
}

export function recoveryAffectedSegmentPage<T extends { id: string }>(rows: T[], totalCount: number) {
  return boundedCursorPage(rows, totalCount, RECOVERY_AFFECTED_SEGMENT_PAGE_SIZE)
}

export function normalizeRecoveryCursor(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null
  const cursor = value.trim()
  return cursor && cursor.length <= 128 ? cursor : null
}

export function normalizeRecoveryFrom(value: string | string[] | undefined, now = new Date()): string {
  if (typeof value !== 'string' || value.length > 64 || !Number.isFinite(Date.parse(value))) return now.toISOString()
  return new Date(value).toISOString()
}

export function recoveryCursorHref(
  basePath: string,
  state: { disruptionCursor: string | null; serviceCursor: string | null; recoveryFrom: string },
  list: 'disruption' | 'service',
  nextCursor: string,
) {
  const params = new URLSearchParams()
  const disruptionCursor = list === 'disruption' ? nextCursor : state.disruptionCursor
  const serviceCursor = list === 'service' ? nextCursor : state.serviceCursor
  if (disruptionCursor) params.set('disruptionCursor', disruptionCursor)
  if (serviceCursor) params.set('serviceCursor', serviceCursor)
  params.set('recoveryFrom', state.recoveryFrom)
  return `${basePath}?${params.toString()}`
}

export function currentRecoveryBookingChoices(segments: RecoveryAffectedSegment[]) {
  const choices = new Map<string, RecoveryAffectedSegment['booking']>()
  for (const segment of segments) {
    const booking = segment.booking
    if (segment.status !== 'disrupted' || ['cancelled', 'completed'].includes(booking.status)
      || booking.paymentStatus === 'refunded' || booking.ticketingStatus === 'voided') continue
    choices.set(booking.id, booking)
  }
  return [...choices.values()].sort((left, right) => left.recordLocator.localeCompare(right.recordLocator) || left.id.localeCompare(right.id))
}

export function recoveryReplacementFlights(
  flights: RecoveryFlightOption[],
  disruption: RecoveryDisruptionOption | null | undefined,
  eligibleFrom: string,
) {
  const from = Date.parse(eligibleFrom)
  const disruptedFlight = disruption?.flightInstance
  if (!disruptedFlight || !Number.isFinite(from)) return []
  return flights.filter(flight => {
    const departure = Date.parse(flight.scheduledDepartureAt)
    return flight.id !== disruptedFlight.id
      && ['scheduled', 'open_for_sale', 'delayed'].includes(flight.status)
      && Number.isFinite(departure) && departure > from
      && flight.origin.iataCode === disruptedFlight.origin.iataCode
      && flight.destination.iataCode === disruptedFlight.destination.iataCode
      && flight.inventoryBuckets.some(bucket => bucket.status === 'open' && bucket.authorized - bucket.sold - bucket.held - bucket.blocked > 0)
  }).sort((left, right) => left.scheduledDepartureAt.localeCompare(right.scheduledDepartureAt) || left.id.localeCompare(right.id))
}
