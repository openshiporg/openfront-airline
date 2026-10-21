export const BOOKING_WORKLIST_PAGE_SIZE = 50

export const BOOKING_WORKLIST_QUERY = `query CarrierBookingWorklist(
  $where: BookingWhereInput!,
  $cleanupWhere: BookingWhereInput!,
  $bookingCursor: BookingWhereUniqueInput,
  $bookingSkip: Int!,
  $evidenceWhere: ManualPaymentEvidenceWhereInput
) {
  offers(where: { status: { in: [held, available] } }, take: 50, orderBy: [{ createdAt: desc }, { id: asc }]) {
    id offerNumber status totalAmount currencyCode passengers { id givenName familyName }
  }
  bookings(
    where: $where,
    take: ${BOOKING_WORKLIST_PAGE_SIZE + 1},
    cursor: $bookingCursor,
    skip: $bookingSkip,
    orderBy: [{ createdAt: desc }, { id: asc }]
  ) {
    id recordLocator status paymentStatus ticketingStatus totalAmount currencyCode metadata
  }
  bookingsCount(where: $where)
  refundCleanupBookings: bookings(where: $cleanupWhere, take: 101, orderBy: [{ updatedAt: desc }, { id: asc }]) {
    id recordLocator status paymentStatus ticketingStatus updatedAt segmentsCount
    segments(take: 100, orderBy: [{ sequence: asc }, { id: asc }]) { id sequence status originCode destinationCode }
  }
  refundCleanupBookingsCount: bookingsCount(where: $cleanupWhere)
  manualPaymentEvidences(where: $evidenceWhere, take: 100, orderBy: [{ submittedAt: desc }, { id: asc }]) {
    id status purpose externalReference ledgerSource evidenceDigest amount currencyCode
    booking { id recordLocator } submittedBy { id name } approvedBy { id name }
  }
}`

export type BookingWorklistPage<T extends { id: string }> = {
  items: T[]
  totalCount: number
  hasNextPage: boolean
  nextCursor: string | null
}

export function normalizeBookingWorklistCursor(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null
  const cursor = value.trim()
  return cursor && cursor.length <= 128 ? cursor : null
}

export function bookingWorklistPage<T extends { id: string }>(rows: T[], totalCount: number): BookingWorklistPage<T> {
  const items = rows.slice(0, BOOKING_WORKLIST_PAGE_SIZE)
  const hasNextPage = rows.length > BOOKING_WORKLIST_PAGE_SIZE
  return {
    items,
    totalCount,
    hasNextPage,
    nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null,
  }
}

export function bookingWorklistNextHref(basePath: string, locator: string, cursor: string): string {
  const params = new URLSearchParams()
  if (locator) params.set('locator', locator)
  params.set('bookingCursor', cursor)
  return `${basePath}?${params.toString()}`
}
