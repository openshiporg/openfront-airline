export const PROVIDER_CONNECTION_WORKLIST_PAGE_SIZE = 100
export const PROVIDER_CONNECTION_WORKLIST_WHERE = {} as const

export const PLATFORM_SETTINGS_ACTOR_SCOPE_QUERY = `query PlatformSettingsActorScope {
  authenticatedItem {
    ... on User {
      carrier { id name code status directSalesEnabled defaultCurrencyCode defaultTimezone }
      role { canReadIntegrations canManageIntegrations canManageCarriers }
    }
  }
}`

export const PLATFORM_SETTINGS_CONNECTIONS_QUERY = `query PlatformSettingsConnections(
  $providerConnectionWhere: ProviderConnectionWhereInput!,
  $providerConnectionCursor: ProviderConnectionWhereUniqueInput,
  $providerConnectionSkip: Int!,
  $providerConnectionCursorId: ID!
) {
  providerConnections(
    where: $providerConnectionWhere,
    take: ${PROVIDER_CONNECTION_WORKLIST_PAGE_SIZE + 1},
    cursor: $providerConnectionCursor,
    skip: $providerConnectionSkip,
    orderBy: [{ updatedAt: desc }, { id: asc }]
  ) {
    id connectionKey name status capabilities externalAccountId lastAttemptedAt lastSucceededAt lastErrorCode lastErrorMessage
    provider { name code type status }
  }
  providerConnectionsCount(where: $providerConnectionWhere)
  providerConnectionCursorRecord: providerConnections(
    where: { AND: [$providerConnectionWhere, { id: { equals: $providerConnectionCursorId } }] },
    take: 1
  ) { id }
}`

export type ProviderConnectionWorklistActor = {
  carrier?: {
    id: string
    name?: string | null
    code?: string | null
    status?: string | null
    directSalesEnabled?: boolean | null
    defaultCurrencyCode?: string | null
    defaultTimezone?: string | null
  } | null
  role?: {
    canReadIntegrations: boolean | null
    canManageIntegrations: boolean | null
    canManageCarriers: boolean | null
  } | null
} | null | undefined

export type ProviderConnectionScope = 'authorized' | 'denied' | 'unavailable'

export function providerConnectionScope(actor: ProviderConnectionWorklistActor): ProviderConnectionScope {
  const role = actor?.role
  if (!role
    || typeof role.canReadIntegrations !== 'boolean'
    || typeof role.canManageIntegrations !== 'boolean'
    || typeof role.canManageCarriers !== 'boolean') return 'unavailable'
  if (!(role.canReadIntegrations || role.canManageIntegrations)) return 'denied'
  if (!role.canManageCarriers && !actor?.carrier?.id) return 'unavailable'
  return 'authorized'
}

export type ProviderConnectionWorklistPage<T extends { id: string }> = {
  items: T[]
  totalCount: number | null
  hasNextPage: boolean
  nextCursor: string | null
  state: 'ready' | 'empty' | 'stale' | 'inconsistent' | 'unavailable'
}

export function normalizeProviderConnectionCursor(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null
  const cursor = value.trim()
  return cursor && cursor.length <= 128 ? cursor : null
}

export function providerConnectionWorklistPage<T extends { id: string }>(
  rows: T[] | null | undefined,
  totalCount: number | null | undefined,
  cursor: string | null,
  scopeAuthorized: boolean,
  cursorAuthorized = true,
): ProviderConnectionWorklistPage<T> {
  if (!scopeAuthorized
    || !Array.isArray(rows)
    || typeof totalCount !== 'number'
    || !Number.isSafeInteger(totalCount)
    || totalCount < 0) {
    return { items: [], totalCount: null, hasNextPage: false, nextCursor: null, state: 'unavailable' }
  }

  if (cursor && !cursorAuthorized) {
    return { items: [], totalCount: null, hasNextPage: false, nextCursor: null, state: 'stale' }
  }

  const expectedFirstPageRows = Math.min(totalCount, PROVIDER_CONNECTION_WORKLIST_PAGE_SIZE + 1)
  if (rows.length > totalCount || (!cursor && rows.length !== expectedFirstPageRows)) {
    return { items: [], totalCount, hasNextPage: false, nextCursor: null, state: 'inconsistent' }
  }

  const items = rows.slice(0, PROVIDER_CONNECTION_WORKLIST_PAGE_SIZE)
  const hasNextPage = rows.length > PROVIDER_CONNECTION_WORKLIST_PAGE_SIZE
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

  return { items, totalCount, hasNextPage, nextCursor, state: 'ready' }
}

export function providerConnectionWorklistHref(basePath: string, cursor?: string | null): string {
  if (!cursor) return basePath
  const params = new URLSearchParams({ providerConnectionCursor: cursor })
  return `${basePath}?${params.toString()}`
}
