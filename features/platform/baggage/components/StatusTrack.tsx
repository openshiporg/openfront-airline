import Link from 'next/link'

import { Pill, StatusDot, Track } from '@/features/platform/components/desk'
import { bagTone } from '@/features/platform/baggage/components/BagStatus'

/** Status tabs as raised pills in a recessed track; each tab is a link that keeps the other filters. */
export function StatusTrack({ label, current, options, hrefFor }: { label: string; current: string; options: ReadonlyArray<{ value: string; label: string; count: number | null }>; hrefFor: (value: string) => string }) {
  return (
    <Track role="tablist" aria-label={label} className="w-full sm:w-auto">
      {options.map(option => (
        <Pill key={option.value || 'all'} asChild size="sm" active={option.value === current}>
          <Link href={hrefFor(option.value)} role="tab" aria-selected={option.value === current} scroll={false}>
            {option.value && <StatusDot tone={bagTone(option.value)} className="size-1.5 shadow-none" />}
            {option.label}
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{option.count ?? '--'}</span>
          </Link>
        </Pill>
      ))}
    </Track>
  )
}
