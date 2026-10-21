export const AUDIT_EVENT_WORKLIST_PAGE_SIZE = 100
export const AUDIT_EVENT_WORKLIST_WHERE = {} as const

export const PLATFORM_AUDIT_ACTOR_SCOPE_QUERY = `query PlatformAuditActorScope {
  authenticatedItem {
    ... on User {
      carrier { id }
      role { canReadAudit canManageCarriers }
    }
  }
}`

export const PLATFORM_AUDIT_EVENTS_QUERY = `query PlatformAuditEvents(
  $auditEventWhere: AuditEventWhereInput!,
  $auditEventCursor: AuditEventWhereUniqueInput,
  $auditEventSkip: Int!,
  $auditEventCursorId: ID!
) {
  auditEvents(
    where: $auditEventWhere,
    take: ${AUDIT_EVENT_WORKLIST_PAGE_SIZE + 1},
    cursor: $auditEventCursor,
    skip: $auditEventSkip,
    orderBy: [{ occurredAt: desc }, { id: asc }]
  ) {
    id eventKey action aggregateType aggregateId source correlationId occurredAt
    actor { name } approvedAgent { legalName }
  }
  auditEventsCount(where: $auditEventWhere)
  auditEventCursorRecord: auditEvents(
    where: { AND: [$auditEventWhere, { id: { equals: $auditEventCursorId } }] },
    take: 1
  ) { id }
}`

export type AuditEventWorklistActor = {
  carrier?: { id: string } | null
  role?: {
    canReadAudit: boolean | null
    canManageCarriers: boolean | null
  } | null
} | null | undefined

export type AuditEventWorklistScope = 'authorized' | 'denied' | 'unavailable'

export function auditEventWorklistScope(actor: AuditEventWorklistActor): AuditEventWorklistScope {
  const role = actor?.role
  if (!role
    || typeof role.canReadAudit !== 'boolean'
    || typeof role.canManageCarriers !== 'boolean') return 'unavailable'
  if (!role.canReadAudit) return 'denied'
  if (!role.canManageCarriers && !actor?.carrier?.id) return 'unavailable'
  return 'authorized'
}

export type AuditEventWorklistPage<T extends { id: string }> = {
  items: T[]
  totalCount: number | null
  hasNextPage: boolean
  nextCursor: string | null
  state: 'ready' | 'empty' | 'stale' | 'inconsistent' | 'unavailable'
}

export function normalizeAuditEventCursor(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null
  const cursor = value.trim()
  return cursor && cursor.length <= 128 ? cursor : null
}

export function auditEventWorklistPage<T extends { id: string }>(
  rows: T[] | null | undefined,
  totalCount: number | null | undefined,
  cursor: string | null,
  scopeAuthorized: boolean,
  cursorAuthorized = true,
): AuditEventWorklistPage<T> {
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

  const expectedFirstPageRows = Math.min(totalCount, AUDIT_EVENT_WORKLIST_PAGE_SIZE + 1)
  if (rows.length > totalCount || (!cursor && rows.length !== expectedFirstPageRows)) {
    return { items: [], totalCount, hasNextPage: false, nextCursor: null, state: 'inconsistent' }
  }

  const items = rows.slice(0, AUDIT_EVENT_WORKLIST_PAGE_SIZE)
  const hasNextPage = rows.length > AUDIT_EVENT_WORKLIST_PAGE_SIZE
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

export function auditEventWorklistHref(basePath: string, cursor?: string | null): string {
  if (!cursor) return basePath
  const params = new URLSearchParams({ auditEventCursor: cursor })
  return `${basePath}?${params.toString()}`
}
