export const CABIN_WORKLIST_PAGE_SIZE = 50

export const NETWORK_PROVISIONING_CABINS_QUERY = `query NetworkProvisioningCabins(
  $cabinWhere: CabinWhereInput!,
  $cabinCursor: CabinWhereUniqueInput,
  $cabinSkip: Int!,
  $cabinCursorId: ID!
) {
  authenticatedItem {
    ... on User {
      carrier { id }
      role { canReadNetwork canManageNetwork canManageCarriers }
    }
  }
  cabins(
    where: $cabinWhere,
    take: ${CABIN_WORKLIST_PAGE_SIZE + 1},
    cursor: $cabinCursor,
    skip: $cabinSkip,
    orderBy: [{ code: asc }, { id: asc }]
  ) { id code name }
  cabinsCount(where: $cabinWhere)
  cabinCursorRecord: cabins(
    where: { AND: [$cabinWhere, { id: { equals: $cabinCursorId } }] },
    take: 1
  ) { id }
}`

export type ProvisioningCabin = { id: string; code: string; name: string }

export type CabinReadActor = {
  carrier?: { id: string } | null
  role?: {
    canReadNetwork: boolean | null
    canManageNetwork: boolean | null
    canManageCarriers: boolean | null
  } | null
} | null | undefined

export type CabinReadScope = 'authorized' | 'denied' | 'unavailable'

export function cabinReadScope(actor: CabinReadActor): CabinReadScope {
  const role = actor?.role
  if (!role
    || typeof role.canReadNetwork !== 'boolean'
    || typeof role.canManageNetwork !== 'boolean'
    || typeof role.canManageCarriers !== 'boolean') return 'unavailable'
  if (!role.canReadNetwork && !role.canManageNetwork) return 'denied'
  if (!role.canManageCarriers && !actor?.carrier?.id) return 'unavailable'
  return 'authorized'
}

export function normalizeCabinSearch(value: string): string {
  return value.trim().slice(0, 80)
}

export function cabinWorklistWhere(search: string) {
  const term = normalizeCabinSearch(search)
  return term ? {
    OR: [
      { code: { contains: term, mode: 'insensitive' } },
      { name: { contains: term, mode: 'insensitive' } },
    ],
  } : {}
}

export type CabinWorklistState = 'loading' | 'ready' | 'overflow' | 'empty' | 'stale' | 'inconsistent' | 'denied' | 'unavailable'

export type CabinWorklistPage = {
  items: ProvisioningCabin[]
  totalCount: number | null
  hasNextPage: boolean
  nextCursor: string | null
  state: CabinWorklistState
}

export function emptyCabinWorklistPage(state: CabinWorklistState): CabinWorklistPage {
  return { items: [], totalCount: null, hasNextPage: false, nextCursor: null, state }
}

export function cabinWorklistPage(input: {
  rows: ProvisioningCabin[] | null | undefined
  totalCount: number | null | undefined
  cursor: string | null
  cursorAuthorized: boolean
  scope: CabinReadScope
}): CabinWorklistPage {
  const { rows, totalCount, cursor, cursorAuthorized, scope } = input
  if (scope === 'denied') return emptyCabinWorklistPage('denied')
  if (scope !== 'authorized' || !Array.isArray(rows)
    || typeof totalCount !== 'number'
    || !Number.isSafeInteger(totalCount)
    || totalCount < 0) return emptyCabinWorklistPage('unavailable')
  if (cursor && !cursorAuthorized) return emptyCabinWorklistPage('stale')
  if (rows.length > totalCount
    || rows.length > CABIN_WORKLIST_PAGE_SIZE + 1
    || (!cursor && rows.length !== Math.min(totalCount, CABIN_WORKLIST_PAGE_SIZE + 1))
    || rows.some(cabin => !cabin
      || typeof cabin.id !== 'string'
      || !cabin.id
      || typeof cabin.code !== 'string'
      || typeof cabin.name !== 'string')) {
    return { ...emptyCabinWorklistPage('inconsistent'), totalCount }
  }

  const items = rows.slice(0, CABIN_WORKLIST_PAGE_SIZE)
  const hasNextPage = rows.length > CABIN_WORKLIST_PAGE_SIZE
  const nextCursor = hasNextPage ? items.at(-1)?.id ?? null : null
  if (!items.length) {
    if (cursor) return { ...emptyCabinWorklistPage('stale'), totalCount }
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

export function resolveProvisioningCabinId(cabins: readonly ProvisioningCabin[], selectedCabinId: string): string {
  return cabins.some(cabin => cabin.id === selectedCabinId) ? selectedCabinId : ''
}
