export const PASSENGER_SERVICE_PAGE_SIZE = 100

export const PASSENGER_SERVICE_QUERY = `query PlatformPassengerService(
  $passengerWhere: PassengerWhereInput!,
  $passengerCursor: PassengerWhereUniqueInput,
  $passengerSkip: Int!
) {
  authenticatedItem {
    ... on User {
      carrier { id }
      role { canReadPassengers canManagePassengers canManageCarriers }
    }
  }
  passengers(
    where: $passengerWhere,
    take: ${PASSENGER_SERVICE_PAGE_SIZE + 1},
    cursor: $passengerCursor,
    skip: $passengerSkip,
    orderBy: [{ updatedAt: desc }, { id: asc }]
  ) {
    id passengerKey givenName familyName status preferredLanguage
    bookingPassengersCount serviceRequestsCount checkInsCount bagsCount updatedAt
  }
  passengersCount(where: $passengerWhere)
}`

export type PassengerServiceRow = {
  id: string
  passengerKey: string | null
  givenName: string | null
  familyName: string | null
  status: string | null
  preferredLanguage: string | null
  bookingPassengersCount: number | null
  serviceRequestsCount: number | null
  checkInsCount: number | null
  bagsCount: number | null
  updatedAt: string | null
}

export type PassengerServiceActor = {
  carrier?: { id: string } | null
  role?: {
    canReadPassengers: boolean | null
    canManagePassengers: boolean | null
    canManageCarriers: boolean | null
  } | null
} | null | undefined

export function passengerServiceScopeAuthorized(actor: PassengerServiceActor): boolean {
  const role = actor?.role
  if (!role
    || typeof role.canReadPassengers !== 'boolean'
    || typeof role.canManagePassengers !== 'boolean'
    || typeof role.canManageCarriers !== 'boolean') return false
  const hasPassengerPermission = role.canReadPassengers || role.canManagePassengers
  const hasCarrierScope = role.canManageCarriers || Boolean(actor?.carrier?.id)
  return hasPassengerPermission && hasCarrierScope
}

export type PassengerServicePage<T extends { id: string }> = {
  items: T[]
  totalCount: number | null
  hasNextPage: boolean
  nextCursor: string | null
  state: 'ready' | 'empty' | 'stale' | 'inconsistent' | 'unavailable'
}

export function normalizePassengerServiceCursor(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null
  const cursor = value.trim()
  return cursor && cursor.length <= 128 ? cursor : null
}

export function passengerServicePage<T extends { id: string }>(
  rows: T[] | null | undefined,
  totalCount: number | null | undefined,
  cursor: string | null,
  scopeAuthorized: boolean,
): PassengerServicePage<T> {
  if (!scopeAuthorized || !Array.isArray(rows) || typeof totalCount !== 'number' || !Number.isSafeInteger(totalCount) || totalCount < 0) {
    return { items: [], totalCount: null, hasNextPage: false, nextCursor: null, state: 'unavailable' }
  }

  const items = rows.slice(0, PASSENGER_SERVICE_PAGE_SIZE)
  const hasNextPage = rows.length > PASSENGER_SERVICE_PAGE_SIZE
  const nextCursor = hasNextPage ? items.at(-1)?.id ?? null : null
  if (rows.length > totalCount) {
    return { items, totalCount, hasNextPage, nextCursor, state: 'inconsistent' }
  }
  if (!items.length) {
    if (cursor) return { items, totalCount, hasNextPage, nextCursor, state: 'stale' }
    return {
      items,
      totalCount,
      hasNextPage,
      nextCursor,
      state: totalCount === 0 ? 'empty' : 'inconsistent',
    }
  }
  return { items, totalCount, hasNextPage, nextCursor, state: 'ready' }
}

export function passengerServiceHref(basePath: string, cursor?: string): string {
  const params = new URLSearchParams()
  if (cursor) params.set('passengerCursor', cursor)
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}
