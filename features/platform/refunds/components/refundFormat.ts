import type { DeskTone } from '@/features/platform/components/desk'

export const REFUND_STATUSES = ['requested', 'approved', 'processing', 'succeeded', 'failed', 'cancelled'] as const
export type RefundStatus = (typeof REFUND_STATUSES)[number]

export const REFUND_REASON_LABEL: Record<string, string> = {
  customer_request: 'Customer request',
  disruption: 'Disruption',
  schedule_change: 'Schedule change',
  duplicate: 'Duplicate',
  fraud: 'Fraud',
  other: 'Other',
}

export function refundTone(status: string | null | undefined): DeskTone {
  switch (status) {
    case 'succeeded': return 'ok'
    case 'failed': return 'bad'
    case 'cancelled': return 'idle'
    case 'requested': return 'warn'
    case 'approved':
    case 'processing': return 'info'
    default: return 'idle'
  }
}

export function refundStatusLabel(status: string | null | undefined) {
  if (!status) return 'Unknown'
  return status[0].toUpperCase() + status.slice(1).replaceAll('_', ' ')
}

/** Deterministic UTC timestamp, identical on server and client. */
export function formatInstant(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

export function bookingDeskHref(recordLocator: string | null | undefined) {
  return recordLocator ? `/dashboard/platform/bookings?locator=${encodeURIComponent(recordLocator)}` : '/dashboard/platform/bookings'
}
