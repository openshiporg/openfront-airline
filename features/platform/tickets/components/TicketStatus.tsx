import { StatusDot, statusTone, type DeskTone } from '@/features/platform/components/desk'

const TONES: Record<string, DeskTone> = {
  pending: 'warn',
  issued: 'ok',
  partially_used: 'ok',
  open: 'ok',
  used: 'idle',
  flown: 'idle',
  suspended: 'warn',
  voided: 'bad',
  refunded: 'idle',
  exchanged: 'idle',
}

/** Dot tone for ticket and coupon states. */
export function ticketTone(status: string | null | undefined): DeskTone {
  return TONES[status ?? ''] ?? statusTone(status)
}

export function TicketStatusLabel({ status }: { status: string | null | undefined }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap text-xs font-medium capitalize text-muted-foreground">
      <StatusDot tone={ticketTone(status)} className="-translate-y-[0.05em] size-1.5 shadow-none" />
      {status ? status.replaceAll('_', ' ') : 'unknown'}
    </span>
  )
}
