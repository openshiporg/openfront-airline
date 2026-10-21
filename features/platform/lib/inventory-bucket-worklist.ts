export const INVENTORY_BUCKET_WORKLIST_PAGE_SIZE = 25

export const NETWORK_SELECTED_FLIGHT_BUCKETS_QUERY = `query NetworkSelectedFlightBuckets(
  $bucketWhere: InventoryBucketWhereInput!,
  $bucketCursor: InventoryBucketWhereUniqueInput,
  $bucketSkip: Int!,
  $bucketCursorId: ID!
) {
  authenticatedItem {
    ... on User {
      carrier { id }
      role { canReadInventory canManageInventory canManageCarriers }
    }
  }
  inventoryBuckets(
    where: $bucketWhere,
    take: ${INVENTORY_BUCKET_WORKLIST_PAGE_SIZE + 1},
    cursor: $bucketCursor,
    skip: $bucketSkip,
    orderBy: [{ bookingClassCode: asc }, { id: asc }]
  ) {
    id status authorized capacity sold held blocked bookingClassCode
    carrier { id }
    flightInstance { id carrier { id } }
  }
  inventoryBucketsCount(where: $bucketWhere)
  inventoryBucketCursorRecord: inventoryBuckets(
    where: { AND: [$bucketWhere, { id: { equals: $bucketCursorId } }] },
    take: 1
  ) { id }
}`

export type InventoryBucketWorklistActor = {
  carrier?: { id: string } | null
  role?: {
    canReadInventory: boolean | null
    canManageInventory: boolean | null
    canManageCarriers: boolean | null
  } | null
} | null | undefined

export type InventoryBucketWorklistScope = 'authorized' | 'denied' | 'unavailable'

export function inventoryBucketWorklistScope(
  actor: InventoryBucketWorklistActor,
  expectedCarrierId: string,
): InventoryBucketWorklistScope {
  const role = actor?.role
  if (!role
    || typeof role.canReadInventory !== 'boolean'
    || typeof role.canManageInventory !== 'boolean'
    || typeof role.canManageCarriers !== 'boolean'
    || typeof actor?.carrier?.id !== 'string') return 'unavailable'
  if (!role.canReadInventory && !role.canManageInventory) return 'denied'
  if (!expectedCarrierId || actor?.carrier?.id !== expectedCarrierId) return 'unavailable'
  return 'authorized'
}

export function selectedFlightBucketWhere(flightId: string, carrierId: string) {
  if (!flightId || !carrierId) return null
  return {
    AND: [
      { flightInstance: { AND: [{ id: { equals: flightId } }, { carrier: { id: { equals: carrierId } } }] } },
      { carrier: { id: { equals: carrierId } } },
    ],
  }
}

export type InventoryBucketWorklistItem = {
  id: string
  status: string
  authorized: number
  capacity: number
  sold: number
  held: number
  blocked: number
  bookingClassCode: string
  carrier?: { id: string } | null
  flightInstance?: { id: string; carrier?: { id: string } | null } | null
}

export type InventoryBucketWorklistState = 'loading' | 'ready' | 'overflow' | 'empty' | 'stale' | 'inconsistent' | 'denied' | 'unavailable'

export type InventoryBucketWorklistPage = {
  items: InventoryBucketWorklistItem[]
  totalCount: number | null
  hasNextPage: boolean
  nextCursor: string | null
  state: InventoryBucketWorklistState
  canManageInventory: boolean
}

export function emptyInventoryBucketWorklistPage(state: InventoryBucketWorklistState): InventoryBucketWorklistPage {
  return { items: [], totalCount: null, hasNextPage: false, nextCursor: null, state, canManageInventory: false }
}

export function inventoryBucketWorklistPage(input: {
  rows: InventoryBucketWorklistItem[] | null | undefined
  totalCount: number | null | undefined
  flightId: string
  carrierId: string
  cursor: string | null
  cursorAuthorized: boolean
  scope: InventoryBucketWorklistScope
  canManageInventory: boolean
}): InventoryBucketWorklistPage {
  const { rows, totalCount, flightId, carrierId, cursor, cursorAuthorized, scope, canManageInventory } = input
  if (scope === 'denied') return emptyInventoryBucketWorklistPage('denied')
  if (scope !== 'authorized'
    || !flightId
    || !carrierId
    || !Array.isArray(rows)
    || typeof totalCount !== 'number'
    || !Number.isSafeInteger(totalCount)
    || totalCount < 0) return emptyInventoryBucketWorklistPage('unavailable')
  if (cursor && !cursorAuthorized) return emptyInventoryBucketWorklistPage('stale')
  const canManage = canManageInventory === true
  if (rows.length > totalCount
    || rows.length > INVENTORY_BUCKET_WORKLIST_PAGE_SIZE + 1
    || (!cursor && rows.length !== Math.min(totalCount, INVENTORY_BUCKET_WORKLIST_PAGE_SIZE + 1))
    || rows.some(bucket => !bucket
      || typeof bucket.id !== 'string'
      || !bucket.id
      || typeof bucket.status !== 'string'
      || !Number.isSafeInteger(bucket.authorized)
      || !Number.isSafeInteger(bucket.capacity)
      || !Number.isSafeInteger(bucket.sold)
      || !Number.isSafeInteger(bucket.held)
      || !Number.isSafeInteger(bucket.blocked)
      || bucket.authorized < 0
      || bucket.capacity < 0
      || bucket.sold < 0
      || bucket.held < 0
      || bucket.blocked < 0
      || bucket.authorized > bucket.capacity
      || bucket.sold + bucket.held + bucket.blocked > bucket.authorized
      || typeof bucket.bookingClassCode !== 'string'
      || bucket.carrier?.id !== carrierId
      || bucket.flightInstance?.id !== flightId
      || bucket.flightInstance.carrier?.id !== carrierId)) {
    return { ...emptyInventoryBucketWorklistPage('inconsistent'), totalCount, canManageInventory: canManage }
  }

  if (new Set(rows.map(bucket => bucket.id)).size !== rows.length || (cursor && rows.some(bucket => bucket.id === cursor))) {
    return { ...emptyInventoryBucketWorklistPage('inconsistent'), totalCount, canManageInventory: canManage }
  }

  const items = rows.slice(0, INVENTORY_BUCKET_WORKLIST_PAGE_SIZE)
  const hasNextPage = rows.length > INVENTORY_BUCKET_WORKLIST_PAGE_SIZE
  const nextCursor = hasNextPage ? items.at(-1)?.id ?? null : null
  if (!items.length) {
    if (cursor) return { ...emptyInventoryBucketWorklistPage('stale'), totalCount, canManageInventory: canManage }
    return {
      items,
      totalCount,
      hasNextPage,
      nextCursor,
      state: totalCount === 0 ? 'empty' : 'inconsistent',
      canManageInventory: canManage,
    }
  }
  return { items, totalCount, hasNextPage, nextCursor, state: hasNextPage ? 'overflow' : 'ready', canManageInventory: canManage }
}

export type InventoryFlightSelection = {
  state: 'none' | 'authorized' | 'stale' | 'unavailable'
  flightId: string | null
}

export function resolveInventoryFlightSelection(
  flights: ReadonlyArray<{ id: string; carrier?: { id: string } | null }>,
  selectedFlightId: string,
  actorCarrierId: string,
): InventoryFlightSelection {
  if (!selectedFlightId) return { state: 'none', flightId: null }
  if (!actorCarrierId) return { state: 'unavailable', flightId: null }
  const flight = flights.find(candidate => candidate.id === selectedFlightId)
  if (!flight) return { state: 'stale', flightId: null }
  if (typeof flight.carrier?.id !== 'string') return { state: 'unavailable', flightId: null }
  if (flight.carrier.id !== actorCarrierId) return { state: 'stale', flightId: null }
  return { state: 'authorized', flightId: flight.id }
}

export function canEditVisibleInventoryBucket(input: {
  page: InventoryBucketWorklistPage
  flightId: string
  carrierId: string
  bucketId: string
}): boolean {
  return (input.page.state === 'ready' || input.page.state === 'overflow')
    && input.page.canManageInventory
    && Boolean(input.carrierId)
    && input.page.items.some(bucket => bucket.id === input.bucketId
      && bucket.carrier?.id === input.carrierId
      && bucket.flightInstance?.id === input.flightId)
}
