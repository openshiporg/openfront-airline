export const PAYMENT_RECORD_WORKLIST_PAGE_SIZE = 100
export const PAYMENT_RECORD_WORKLIST_WHERE = {} as const

export type PaymentRecordWorklistActor = {
  carrier?: { id: string } | null
  role?: {
    canReadPayments: boolean | null
    canManagePayments: boolean | null
    canManageCarriers: boolean | null
  } | null
} | null | undefined

export function paymentRecordWorklistScopeAuthorized(actor: PaymentRecordWorklistActor): boolean {
  const role = actor?.role
  if (!role
    || typeof role.canReadPayments !== 'boolean'
    || typeof role.canManagePayments !== 'boolean'
    || typeof role.canManageCarriers !== 'boolean') return false
  const hasPaymentPermission = role.canReadPayments || role.canManagePayments
  const hasCarrierScope = role.canManageCarriers || Boolean(actor?.carrier?.id)
  return hasPaymentPermission && hasCarrierScope
}

export type PaymentRecordWorklistPage<T extends { id: string }> = {
  items: T[]
  totalCount: number | null
  hasNextPage: boolean
  nextCursor: string | null
  state: 'ready' | 'empty' | 'stale' | 'inconsistent' | 'unavailable'
}

export function normalizePaymentRecordCursor(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null
  const cursor = value.trim()
  return cursor && cursor.length <= 128 ? cursor : null
}

export function paymentRecordWorklistPage<T extends { id: string }>(
  rows: T[] | null | undefined,
  totalCount: number | null | undefined,
  cursor: string | null,
  scopeAuthorized: boolean,
  cursorAuthorized = true,
): PaymentRecordWorklistPage<T> {
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

  const expectedFirstPageRows = Math.min(totalCount, PAYMENT_RECORD_WORKLIST_PAGE_SIZE + 1)
  if (rows.length > totalCount || (!cursor && rows.length !== expectedFirstPageRows)) {
    return { items: [], totalCount, hasNextPage: false, nextCursor: null, state: 'inconsistent' }
  }

  const items = rows.slice(0, PAYMENT_RECORD_WORKLIST_PAGE_SIZE)
  const hasNextPage = rows.length > PAYMENT_RECORD_WORKLIST_PAGE_SIZE
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

export function paymentDeskWorklistHref(
  basePath: string,
  cursors: { paymentCursor?: string | null; evidenceCursor?: string | null } = {},
): string {
  const params = new URLSearchParams()
  if (cursors.evidenceCursor) params.set('evidenceCursor', cursors.evidenceCursor)
  if (cursors.paymentCursor) params.set('paymentCursor', cursors.paymentCursor)
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

export const PAYMENT_RECORD_WORKLIST_QUERY_FIELDS = `
  payments(
    where: $paymentWhere,
    take: ${PAYMENT_RECORD_WORKLIST_PAGE_SIZE + 1},
    cursor: $paymentCursor,
    skip: $paymentSkip,
    orderBy: [{ createdAt: desc }, { id: asc }]
  ) {
    id paymentKey status amount capturedAmount refundedAmount currencyCode instrumentBrand instrumentLast4 createdAt
    booking { id recordLocator } provider { name adapterType status } refundsCount manualPaymentEvidenceCount
  }
  paymentsCount(where: $paymentWhere)
  paymentCursorRecord: payments(
    where: { AND: [$paymentWhere, { id: { equals: $paymentCursorId } }] },
    take: 1
  ) { id }
`
