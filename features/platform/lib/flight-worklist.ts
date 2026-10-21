export const FLIGHT_WORKLIST_PAGE_SIZE = 50
export const FLIGHT_INVENTORY_BUCKET_PAGE_SIZE = 25

export const FLIGHT_WORKLIST_QUERY_FIELDS = `
  flightInstances(
    where: $flightWhere,
    take: ${FLIGHT_WORKLIST_PAGE_SIZE + 1},
    cursor: $flightCursor,
    skip: $flightSkip,
    orderBy: [{ scheduledDepartureAt: asc }, { id: asc }]
  ) {
    id flightNumber serviceDate scheduledDepartureAt status origin { iataCode } destination { iataCode }
    inventoryBuckets(
      where: {},
      orderBy: [{ bookingClassCode: asc }, { id: asc }],
      take: ${FLIGHT_INVENTORY_BUCKET_PAGE_SIZE + 1}
    ) {
      id status authorized capacity sold held blocked bookingClassCode
    }
  }
  flightInstancesCount(where: $flightWhere)
  flightCursorRecord: flightInstances(
    where: { AND: [$flightWhere, { id: { equals: $flightCursorId } }] },
    take: 1
  ) { id }
`

export const FLIGHT_INVENTORY_WORKLIST_QUERY_FIELDS = `
  flightInstances(
    where: $flightWhere,
    take: ${FLIGHT_WORKLIST_PAGE_SIZE + 1},
    cursor: $flightCursor,
    skip: $flightSkip,
    orderBy: [{ scheduledDepartureAt: asc }, { id: asc }]
  ) {
    id flightNumber serviceDate scheduledDepartureAt status carrier { id } origin { iataCode } destination { iataCode }
  }
  flightInstancesCount(where: $flightWhere)
  flightCursorRecord: flightInstances(
    where: { AND: [$flightWhere, { id: { equals: $flightCursorId } }] },
    take: 1
  ) { id }
`

export const PLATFORM_INVENTORY_DESK_QUERY = `query PlatformInventoryDesk(
  $flightWhere: FlightInstanceWhereInput!,
  $flightCursor: FlightInstanceWhereUniqueInput,
  $flightCursorId: ID!,
  $flightSkip: Int!
) {
  authenticatedItem {
    ... on User {
      carrier { id defaultCurrencyCode defaultTimezone }
      role { canReadNetwork canManageNetwork canReadInventory canManageInventory canManageCarriers }
    }
  }
  ${FLIGHT_INVENTORY_WORKLIST_QUERY_FIELDS}
}`

export type FlightWorklistActor = {
  carrier?: { id: string } | null
  role?: {
    canReadNetwork: boolean | null
    canManageNetwork: boolean | null
    canReadInventory: boolean | null
    canManageInventory: boolean | null
    canManageCarriers: boolean | null
  } | null
} | null | undefined

export function flightWorklistScopeAuthorized(actor: FlightWorklistActor): boolean {
  const role = actor?.role
  if (!role
    || typeof role.canReadNetwork !== 'boolean'
    || typeof role.canManageNetwork !== 'boolean'
    || typeof role.canReadInventory !== 'boolean'
    || typeof role.canManageInventory !== 'boolean'
    || typeof role.canManageCarriers !== 'boolean') return false
  const hasNetworkPermission = role.canReadNetwork || role.canManageNetwork
  const hasInventoryPermission = role.canReadInventory || role.canManageInventory
  const hasCarrierScope = role.canManageCarriers || Boolean(actor?.carrier?.id)
  return hasNetworkPermission && hasInventoryPermission && hasCarrierScope
}

export function futureFlightWorklistWhere(from: string) {
  return {
    AND: [
      { scheduledDepartureAt: { gte: from } },
      { status: { in: ['scheduled', 'open_for_sale', 'closed_for_sale', 'delayed'] } },
    ],
  }
}

export type FlightWorklistPage<T extends { id: string }> = {
  items: T[]
  totalCount: number | null
  hasNextPage: boolean
  nextCursor: string | null
  state: 'ready' | 'empty' | 'stale' | 'inconsistent' | 'unavailable'
}

export function normalizeFlightWorklistCursor(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null
  const cursor = value.trim()
  return cursor && cursor.length <= 128 ? cursor : null
}

export function normalizeFlightWorklistFrom(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string' || value.length > 64) return null
  const from = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(from)) return null
  const timestamp = Date.parse(from)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

export function flightWorklistPage<T extends { id: string }>(
  rows: T[] | null | undefined,
  totalCount: number | null | undefined,
  cursor: string | null,
  scopeAuthorized: boolean,
  cursorAuthorized = true,
): FlightWorklistPage<T> {
  if (!scopeAuthorized || !Array.isArray(rows) || typeof totalCount !== 'number' || !Number.isSafeInteger(totalCount) || totalCount < 0) {
    return { items: [], totalCount: null, hasNextPage: false, nextCursor: null, state: 'unavailable' }
  }

  if (cursor && !cursorAuthorized) return { items: [], totalCount: null, hasNextPage: false, nextCursor: null, state: 'stale' }

  const items = rows.slice(0, FLIGHT_WORKLIST_PAGE_SIZE)
  const hasNextPage = rows.length > FLIGHT_WORKLIST_PAGE_SIZE
  const nextCursor = hasNextPage ? items.at(-1)?.id ?? null : null
  if (rows.length > totalCount) return { items, totalCount, hasNextPage, nextCursor, state: 'inconsistent' }
  if (!items.length) {
    if (cursor) return { items, totalCount, hasNextPage, nextCursor, state: 'stale' }
    return { items, totalCount, hasNextPage, nextCursor, state: totalCount === 0 ? 'empty' : 'inconsistent' }
  }
  return { items, totalCount, hasNextPage, nextCursor, state: 'ready' }
}

export function boundedFlightInventoryBuckets<T>(rows: T[] | null | undefined) {
  if (!Array.isArray(rows)) return { items: [] as T[], hasAdditional: false, unavailable: true }
  return {
    items: rows.slice(0, FLIGHT_INVENTORY_BUCKET_PAGE_SIZE),
    hasAdditional: rows.length > FLIGHT_INVENTORY_BUCKET_PAGE_SIZE,
    unavailable: false,
  }
}

export function flightWorklistHref(
  basePath: string,
  cursor: string | null,
  from: string,
  preserve: Record<string, string | null | undefined> = {},
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(preserve)) {
    if (value) params.set(key, value)
  }
  if (cursor) params.set('flightCursor', cursor)
  params.set('flightFrom', from)
  return `${basePath}?${params.toString()}`
}
