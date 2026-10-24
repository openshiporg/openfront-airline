import { StatusDot, statusTone, type DeskTone } from '@/features/platform/components/desk'

const TONES: Record<string, DeskTone> = {
  accepted: 'info',
  loaded: 'info',
  in_transit: 'info',
  arrived: 'ok',
  delivered: 'ok',
  delayed: 'warn',
  mishandled: 'bad',
  closed: 'idle',
}

/** Dot tone for bag states. */
export function bagTone(status: string | null | undefined): DeskTone {
  return TONES[status ?? ''] ?? statusTone(status)
}

export function BagStatusLabel({ status }: { status: string | null | undefined }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap text-xs font-medium capitalize text-muted-foreground">
      <StatusDot tone={bagTone(status)} className="-translate-y-[0.05em] size-1.5 shadow-none" />
      {status ? status.replaceAll('_', ' ') : 'unknown'}
    </span>
  )
}
