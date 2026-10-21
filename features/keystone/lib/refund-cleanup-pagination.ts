import type { Prisma } from '@prisma/client'

export const REFUND_CLEANUP_PAGE_SIZE = 100

export const REFUND_CLEANUP_ORDER_BY = [
  { flightInstance: { scheduledDepartureAt: 'asc' } },
  { booking: { recordLocator: 'asc' } },
  { sequence: 'asc' },
  { id: 'asc' },
] satisfies Prisma.BookingSegmentOrderByWithRelationInput[]

export function normalizeRefundCleanupCursor(value?: string | null): string | null {
  const cursor = value?.trim()
  if (!cursor) return null
  if (cursor.length > 128) throw new Error('Refund-cleanup cursor is invalid or expired; reload the station manifest to restart.')
  return cursor
}

export function buildRefundCleanupScope(input: {
  carrierId: string
  start: Date
  end: Date
  canManageCarriers: boolean
  originCode?: string
  originIds: string[]
}): Prisma.BookingSegmentWhereInput {
  return {
    carrierId: input.carrierId,
    booking: {
      carrierId: input.carrierId,
      OR: [{ paymentStatus: 'refunded' }, { ticketingStatus: 'voided' }],
    },
    flightInstance: {
      serviceDate: { gte: input.start, lt: input.end },
      ...(input.canManageCarriers
        ? input.originCode ? { origin: { iataCode: input.originCode } } : {}
        : { originId: { in: input.originIds } }),
    },
  }
}

export function refundCleanupFindManyArgs(cursor: string | null): Pick<Prisma.BookingSegmentFindManyArgs, 'orderBy' | 'take' | 'cursor' | 'skip'> {
  return {
    orderBy: REFUND_CLEANUP_ORDER_BY,
    take: REFUND_CLEANUP_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  }
}

export function refundCleanupPage<T extends { id: string }>(rows: T[], totalCount: number) {
  const items = rows.slice(0, REFUND_CLEANUP_PAGE_SIZE)
  const hasNextPage = rows.length > REFUND_CLEANUP_PAGE_SIZE
  return {
    items,
    pageSize: REFUND_CLEANUP_PAGE_SIZE,
    totalCount,
    hasNextPage,
    nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null,
  }
}
