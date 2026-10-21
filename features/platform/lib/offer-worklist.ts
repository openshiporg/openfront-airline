export const OFFER_WORKLIST_PAGE_SIZE = 50

export const PLATFORM_OFFERS_QUERY = `query PlatformOffers(
  $origin: String!,
  $destination: String!,
  $date: String!,
  $offerWhere: OfferWhereInput!,
  $offerCursor: OfferWhereUniqueInput,
  $offerSkip: Int!,
  $search: Boolean!
) {
  authenticatedItem { ... on User { carrier { defaultTimezone } } }
  airlineFlightOptions(originCode: $origin, destinationCode: $destination, serviceDate: $date) @include(if: $search) {
    id inventoryBucketId flightNumber scheduledDepartureAt scheduledArrivalAt originCode destinationCode
    fareBrand { code name } currencyCode totalAmount availability { available }
  }
  passengers(take: 20) { id givenName familyName }
  offers(
    where: $offerWhere,
    take: ${OFFER_WORKLIST_PAGE_SIZE + 1},
    cursor: $offerCursor,
    skip: $offerSkip,
    orderBy: [{ createdAt: desc }, { id: asc }]
  ) {
    id offerNumber status source expiresAt totalAmount currencyCode passengersCount booking { recordLocator }
  }
  offersCount(where: $offerWhere)
}`

export type OfferWorklistPage<T extends { id: string }> = {
  items: T[]
  totalCount: number
  hasNextPage: boolean
  nextCursor: string | null
  state: 'ready' | 'empty' | 'stale' | 'inconsistent'
}

export function normalizeOfferWorklistCursor(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null
  const cursor = value.trim()
  return cursor && cursor.length <= 128 ? cursor : null
}

export function offerWorklistPage<T extends { id: string }>(
  rows: T[],
  totalCount: number,
  cursor: string | null,
): OfferWorklistPage<T> {
  const items = rows.slice(0, OFFER_WORKLIST_PAGE_SIZE)
  const hasNextPage = rows.length > OFFER_WORKLIST_PAGE_SIZE
  const state = items.length
    ? 'ready'
    : cursor
      ? 'stale'
      : totalCount === 0
        ? 'empty'
        : 'inconsistent'
  return {
    items,
    totalCount,
    hasNextPage,
    nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null,
    state,
  }
}

export function offerWorklistHref(
  basePath: string,
  state: { origin: string; destination: string; date: string },
  cursor?: string,
): string {
  const params = new URLSearchParams({
    origin: state.origin,
    destination: state.destination,
    date: state.date,
  })
  if (cursor) params.set('offerCursor', cursor)
  return `${basePath}?${params.toString()}`
}
