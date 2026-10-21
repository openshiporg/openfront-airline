import { PAYMENT_RECORD_WORKLIST_QUERY_FIELDS } from './payment-record-worklist'

export const PAYMENT_EVIDENCE_WORKLIST_PAGE_SIZE = 100

export const PAYMENT_EVIDENCE_WORKLIST_WHERE = { status: { equals: 'submitted' } } as const

export const PLATFORM_PAYMENTS_DESK_QUERY = `query PlatformPaymentsDesk(
  $paymentWhere: PaymentWhereInput!,
  $paymentCursor: PaymentWhereUniqueInput,
  $paymentSkip: Int!,
  $paymentCursorId: ID!,
  $evidenceWhere: ManualPaymentEvidenceWhereInput!,
  $evidenceCursor: ManualPaymentEvidenceWhereUniqueInput,
  $evidenceSkip: Int!,
  $evidenceCursorId: ID!
) {
  authenticatedItem {
    ... on User {
      carrier { id }
      role { canReadPayments canManagePayments canManageCarriers }
    }
  }
  ${PAYMENT_RECORD_WORKLIST_QUERY_FIELDS}
  manualPaymentEvidences(
    where: $evidenceWhere,
    take: ${PAYMENT_EVIDENCE_WORKLIST_PAGE_SIZE + 1},
    cursor: $evidenceCursor,
    skip: $evidenceSkip,
    orderBy: [{ submittedAt: desc }, { id: asc }]
  ) {
    id status purpose externalReference amount currencyCode
    booking { recordLocator } submittedBy { name } approvedBy { name }
  }
  manualPaymentEvidencesCount(where: $evidenceWhere)
  evidenceCursorRecord: manualPaymentEvidences(
    where: { AND: [$evidenceWhere, { id: { equals: $evidenceCursorId } }] },
    take: 1
  ) { id }
}`

export type PaymentEvidenceWorklistActor = {
  carrier?: { id: string } | null
  role?: {
    canReadPayments: boolean | null
    canManagePayments: boolean | null
    canManageCarriers: boolean | null
  } | null
} | null | undefined

export function paymentEvidenceWorklistScopeAuthorized(actor: PaymentEvidenceWorklistActor): boolean {
  const role = actor?.role
  if (!role
    || typeof role.canReadPayments !== 'boolean'
    || typeof role.canManagePayments !== 'boolean'
    || typeof role.canManageCarriers !== 'boolean') return false
  const hasPaymentPermission = role.canReadPayments || role.canManagePayments
  const hasCarrierScope = role.canManageCarriers || Boolean(actor?.carrier?.id)
  return hasPaymentPermission && hasCarrierScope
}

export type PaymentEvidenceWorklistPage<T extends { id: string }> = {
  items: T[]
  totalCount: number | null
  hasNextPage: boolean
  nextCursor: string | null
  state: 'ready' | 'empty' | 'stale' | 'inconsistent' | 'unavailable'
}

export function normalizePaymentEvidenceCursor(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null
  const cursor = value.trim()
  return cursor && cursor.length <= 128 ? cursor : null
}

export function paymentEvidenceWorklistPage<T extends { id: string }>(
  rows: T[] | null | undefined,
  totalCount: number | null | undefined,
  cursor: string | null,
  scopeAuthorized: boolean,
  cursorAuthorized = true,
): PaymentEvidenceWorklistPage<T> {
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

  const expectedFirstPageRows = Math.min(totalCount, PAYMENT_EVIDENCE_WORKLIST_PAGE_SIZE + 1)
  if (rows.length > totalCount || (!cursor && rows.length !== expectedFirstPageRows)) {
    return { items: [], totalCount, hasNextPage: false, nextCursor: null, state: 'inconsistent' }
  }

  const items = rows.slice(0, PAYMENT_EVIDENCE_WORKLIST_PAGE_SIZE)
  const hasNextPage = rows.length > PAYMENT_EVIDENCE_WORKLIST_PAGE_SIZE
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

export function paymentEvidenceWorklistHref(basePath: string, cursor?: string | null): string {
  if (!cursor) return basePath
  const params = new URLSearchParams({ evidenceCursor: cursor })
  return `${basePath}?${params.toString()}`
}
