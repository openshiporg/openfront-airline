export const FARE_BRAND_WORKLIST_PAGE_SIZE = 25

export const NETWORK_CABIN_FARE_BRANDS_QUERY = `query NetworkCabinFareBrands(
  $fareBrandWhere: FareBrandWhereInput!,
  $fareBrandCursor: FareBrandWhereUniqueInput,
  $fareBrandSkip: Int!,
  $fareBrandCursorId: ID!
) {
  authenticatedItem {
    ... on User {
      carrier { id }
      role { canReadOffers canManageOffers canManageCarriers }
    }
  }
  fareBrands(
    where: $fareBrandWhere,
    take: ${FARE_BRAND_WORKLIST_PAGE_SIZE + 1},
    cursor: $fareBrandCursor,
    skip: $fareBrandSkip,
    orderBy: [{ code: asc }, { id: asc }]
  ) { id code name status cabin { id } }
  fareBrandsCount(where: $fareBrandWhere)
  fareBrandCursorRecord: fareBrands(
    where: { AND: [$fareBrandWhere, { id: { equals: $fareBrandCursorId } }] },
    take: 1
  ) { id }
}`

export type FareBrand = {
  id: string
  code: string
  name: string
  status: string
  cabin?: { id: string } | null
}

export type FareBrandReadActor = {
  carrier?: { id: string } | null
  role?: {
    canReadOffers: boolean | null
    canManageOffers: boolean | null
    canManageCarriers: boolean | null
  } | null
} | null | undefined

export type FareBrandReadScope = 'authorized' | 'denied' | 'unavailable'

export function fareBrandReadScope(actor: FareBrandReadActor): FareBrandReadScope {
  const role = actor?.role
  if (!role
    || typeof role.canReadOffers !== 'boolean'
    || typeof role.canManageOffers !== 'boolean'
    || typeof role.canManageCarriers !== 'boolean') return 'unavailable'
  if (!role.canReadOffers && !role.canManageOffers) return 'denied'
  if (!role.canManageCarriers && !actor?.carrier?.id) return 'unavailable'
  return 'authorized'
}

export function normalizeFareBrandSearch(value: string): string {
  return value.trim().slice(0, 80)
}

export function cabinActiveFareBrandWhere(cabinId: string, search: string) {
  if (!cabinId) return null
  const term = normalizeFareBrandSearch(search)
  return {
    AND: [
      { status: { equals: 'active' } },
      { cabin: { id: { equals: cabinId } } },
      ...(term ? [{ OR: [
        { code: { contains: term, mode: 'insensitive' } },
        { name: { contains: term, mode: 'insensitive' } },
      ] }] : []),
    ],
  }
}

export type FareBrandWorklistState = 'loading' | 'ready' | 'overflow' | 'empty' | 'stale' | 'inconsistent' | 'denied' | 'unavailable'

export type FareBrandWorklistPage = {
  items: FareBrand[]
  totalCount: number | null
  hasNextPage: boolean
  nextCursor: string | null
  state: FareBrandWorklistState
}

export function fareBrandWorklistPage(input: {
  rows: FareBrand[] | null | undefined
  totalCount: number | null | undefined
  cabinId: string
  cursor: string | null
  cursorAuthorized: boolean
  scope: FareBrandReadScope
}): FareBrandWorklistPage {
  const { rows, totalCount, cabinId, cursor, cursorAuthorized, scope } = input
  if (scope === 'denied') return { items: [], totalCount: null, hasNextPage: false, nextCursor: null, state: 'denied' }
  if (scope !== 'authorized'
    || !cabinId
    || !Array.isArray(rows)
    || typeof totalCount !== 'number'
    || !Number.isSafeInteger(totalCount)
    || totalCount < 0) {
    return { items: [], totalCount: null, hasNextPage: false, nextCursor: null, state: 'unavailable' }
  }
  if (cursor && !cursorAuthorized) return { items: [], totalCount: null, hasNextPage: false, nextCursor: null, state: 'stale' }
  if (rows.length > totalCount
    || rows.length > FARE_BRAND_WORKLIST_PAGE_SIZE + 1
    || (!cursor && rows.length !== Math.min(totalCount, FARE_BRAND_WORKLIST_PAGE_SIZE + 1))
    || rows.some(brand => brand.status !== 'active' || brand.cabin?.id !== cabinId)) {
    return { items: [], totalCount, hasNextPage: false, nextCursor: null, state: 'inconsistent' }
  }

  const items = rows.slice(0, FARE_BRAND_WORKLIST_PAGE_SIZE)
  const hasNextPage = rows.length > FARE_BRAND_WORKLIST_PAGE_SIZE
  const nextCursor = hasNextPage ? items.at(-1)?.id ?? null : null
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
  return { items, totalCount, hasNextPage, nextCursor, state: hasNextPage ? 'overflow' : 'ready' }
}

export function compatibleActiveFareBrands(fareBrands: readonly FareBrand[], cabinId: string): FareBrand[] {
  if (!cabinId) return []
  return fareBrands.filter(brand => brand.status === 'active' && brand.cabin?.id === cabinId)
}

export function initialCompatibleFareBrandId(fareBrands: readonly FareBrand[], cabinId: string): string {
  return compatibleActiveFareBrands(fareBrands, cabinId)[0]?.id ?? ''
}

export function resolveCompatibleFareBrandId(
  fareBrands: readonly FareBrand[],
  cabinId: string,
  selectedFareBrandId: string,
): string {
  return compatibleActiveFareBrands(fareBrands, cabinId).some(brand => brand.id === selectedFareBrandId)
    ? selectedFareBrandId
    : ''
}

export type ProvisioningFareBrandBinding = {
  cabinId: string
  fareBrandId: string
  idempotencyKey: string
}

export function provisioningFareBrandBinding(input: {
  pageBrands: readonly FareBrand[]
  selectedFareBrandId: string
  cabinId: string
  scheduleId: string
  serviceDate: string
}): ProvisioningFareBrandBinding | null {
  const fareBrandId = resolveCompatibleFareBrandId(input.pageBrands, input.cabinId, input.selectedFareBrandId)
  if (!input.scheduleId || !input.serviceDate || !input.cabinId || !fareBrandId) return null
  return {
    cabinId: input.cabinId,
    fareBrandId,
    idempotencyKey: `provision-${input.scheduleId}-${input.serviceDate}-${input.cabinId}-${fareBrandId}`,
  }
}
