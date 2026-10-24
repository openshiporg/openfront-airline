// Link-based tabs, status tabs, search and paging for the network and fares desks (server-renderable).

import Link from 'next/link'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'

import { Field, FilterBar, Pill, StatusDot, Track, deskInput, statusTone } from '@/features/platform/components/desk'

export type DeskQuery = Record<string, string | number | null | undefined>

export function deskHref(base: string, query: DeskQuery) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '' && !(key === 'page' && Number(value) <= 1)) params.set(key, String(value))
  }
  const text = params.toString()
  return text ? `${base}?${text}` : base
}

export function TabLinks({ base, current, tabs }: { base: string; current: string; tabs: ReadonlyArray<{ value: string; label: string }> }) {
  return (
    <Track aria-label="Sections">
      {tabs.map(tab => (
        <Pill key={tab.value} asChild active={tab.value === current} aria-current={tab.value === current ? 'page' : undefined}>
          <Link href={deskHref(base, { tab: tab.value })}>{tab.label}</Link>
        </Pill>
      ))}
    </Track>
  )
}

export function StatusTabLinks({
  base,
  query,
  current,
  counts,
  statuses,
}: {
  base: string
  query: DeskQuery
  current: string
  counts: Record<string, number | null | undefined>
  statuses: readonly string[]
}) {
  const total = statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0)
  return (
    <Track aria-label="Status">
      <Pill asChild size="sm" active={!current} aria-current={!current ? 'page' : undefined}>
        <Link href={deskHref(base, { ...query, status: null, page: null })}>
          All<span className="font-mono text-[11px] tabular-nums text-muted-foreground">{total}</span>
        </Link>
      </Pill>
      {statuses.map(status => (
        <Pill key={status} asChild size="sm" active={current === status} aria-current={current === status ? 'page' : undefined}>
          <Link href={deskHref(base, { ...query, status, page: null })} className="capitalize">
            <StatusDot tone={statusTone(status)} className="size-1.5 shadow-none" />
            {status}
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{counts[status] ?? 0}</span>
          </Link>
        </Pill>
      ))}
    </Track>
  )
}

export function DeskSearch({ action, hidden, q, label }: { action: string; hidden: DeskQuery; q: string; label: string }) {
  return (
    <FilterBar action={action}>
      {Object.entries(hidden).map(([name, value]) => value ? <input key={name} type="hidden" name={name} value={String(value)} /> : null)}
      <Field label={label} className="sm:flex-1">
        <span className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input type="search" name="q" defaultValue={q} maxLength={120} className={`${deskInput} pl-9`} />
        </span>
      </Field>
      <Track>
        <Pill type="submit" variant="primary">Search</Pill>
        {q && <Pill asChild><Link href={deskHref(action, hidden)}>Clear</Link></Pill>}
      </Track>
    </FilterBar>
  )
}

export function Pager({ base, query, page, pageSize, total }: { base: string; query: DeskQuery; page: number; pageSize: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="font-mono text-xs tabular-nums text-muted-foreground">Page {page} of {pages}</span>
      <Track>
        {page > 1 ? (
          <Pill asChild size="sm"><Link href={deskHref(base, { ...query, page: page - 1 })}><ChevronLeft aria-hidden="true" />Previous</Link></Pill>
        ) : (
          <Pill size="sm" disabled><ChevronLeft aria-hidden="true" />Previous</Pill>
        )}
        {page < pages ? (
          <Pill asChild size="sm"><Link href={deskHref(base, { ...query, page: page + 1 })}>Next<ChevronRight aria-hidden="true" /></Link></Pill>
        ) : (
          <Pill size="sm" disabled>Next<ChevronRight aria-hidden="true" /></Pill>
        )}
      </Track>
    </div>
  )
}

export function pageParam(value: unknown) {
  const page = typeof value === 'string' ? Number.parseInt(value, 10) : 1
  return Number.isFinite(page) && page > 0 && page < 10_000 ? page : 1
}

export function stringParam(value: unknown, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}
