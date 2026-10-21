import { FLIGHT_WORKLIST_QUERY_FIELDS } from './flight-worklist'

export const SCHEDULE_WORKLIST_PAGE_SIZE = 100

export const PLATFORM_NETWORK_DESK_QUERY = `query PlatformNetworkDesk(
  $scheduleWhere: FlightScheduleWhereInput!,
  $scheduleCursor: FlightScheduleWhereUniqueInput,
  $scheduleSkip: Int!,
  $selectedScheduleId: ID!,
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
  flightSchedules(
    where: $scheduleWhere,
    take: ${SCHEDULE_WORKLIST_PAGE_SIZE + 1},
    cursor: $scheduleCursor,
    skip: $scheduleSkip,
    orderBy: [{ flightNumber: asc }, { id: asc }]
  ) {
    id flightNumber departureLocalTime arrivalLocalTime route { origin { iataCode } destination { iataCode } }
  }
  flightSchedulesCount(where: $scheduleWhere)
  selectedSchedule: flightSchedules(
    where: { AND: [$scheduleWhere, { id: { equals: $selectedScheduleId } }] },
    take: 1
  ) {
    id flightNumber departureLocalTime arrivalLocalTime route { origin { iataCode } destination { iataCode } }
  }
  ${FLIGHT_WORKLIST_QUERY_FIELDS}
}`

export type ScheduleWorklistActor = {
  carrier?: { id: string } | null
  role?: {
    canReadNetwork: boolean | null
    canManageNetwork: boolean | null
    canReadInventory: boolean | null
    canManageInventory: boolean | null
    canManageCarriers: boolean | null
  } | null
} | null | undefined

export function scheduleWorklistScopeAuthorized(actor: ScheduleWorklistActor): boolean {
  const role = actor?.role
  if (!role
    || typeof role.canReadNetwork !== 'boolean'
    || typeof role.canManageNetwork !== 'boolean'
    || typeof role.canManageCarriers !== 'boolean') return false
  const hasNetworkPermission = role.canReadNetwork || role.canManageNetwork
  const hasCarrierScope = role.canManageCarriers || Boolean(actor?.carrier?.id)
  return hasNetworkPermission && hasCarrierScope
}

export type ScheduleWorklistPage<T extends { id: string }> = {
  items: T[]
  totalCount: number | null
  hasNextPage: boolean
  nextCursor: string | null
  state: 'ready' | 'empty' | 'stale' | 'inconsistent' | 'unavailable'
}

export function normalizeScheduleWorklistCursor(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null
  const cursor = value.trim()
  return cursor && cursor.length <= 128 ? cursor : null
}

export function normalizeSelectedScheduleId(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null
  const id = value.trim()
  return id && id.length <= 128 ? id : null
}

export function scheduleWorklistPage<T extends { id: string }>(
  rows: T[] | null | undefined,
  totalCount: number | null | undefined,
  cursor: string | null,
  scopeAuthorized: boolean,
): ScheduleWorklistPage<T> {
  if (!scopeAuthorized || !Array.isArray(rows) || typeof totalCount !== 'number' || !Number.isSafeInteger(totalCount) || totalCount < 0) {
    return { items: [], totalCount: null, hasNextPage: false, nextCursor: null, state: 'unavailable' }
  }

  const items = rows.slice(0, SCHEDULE_WORKLIST_PAGE_SIZE)
  const hasNextPage = rows.length > SCHEDULE_WORKLIST_PAGE_SIZE
  const nextCursor = hasNextPage ? items.at(-1)?.id ?? null : null
  if (rows.length > totalCount) return { items, totalCount, hasNextPage, nextCursor, state: 'inconsistent' }
  if (!items.length) {
    if (cursor) return { items, totalCount, hasNextPage, nextCursor, state: 'stale' }
    return { items, totalCount, hasNextPage, nextCursor, state: totalCount === 0 ? 'empty' : 'inconsistent' }
  }
  return { items, totalCount, hasNextPage, nextCursor, state: 'ready' }
}

export function includeSelectedSchedule<T extends { id: string }>(items: T[], selected: T | null | undefined): T[] {
  if (!selected || items.some(item => item.id === selected.id)) return items
  return [...items, selected]
}

export function scheduleWorklistHref(
  basePath: string,
  cursor?: string | null,
  selectedScheduleId?: string | null,
  preserve: Record<string, string | null | undefined> = {},
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(preserve)) {
    if (value) params.set(key, value)
  }
  if (cursor) params.set('scheduleCursor', cursor)
  if (selectedScheduleId) params.set('scheduleId', selectedScheduleId)
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}
