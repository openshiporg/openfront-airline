/**
 * Ops desk kit: the shared building blocks for the airline platform screens.
 * Airport wayfinding signage: graphite code plates, hairline rules, 4px corners,
 * underline tabs, square buttons, and signage yellow for the one primary action.
 */

import * as React from 'react'
import Link from 'next/link'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

export type DeskTone = 'ok' | 'warn' | 'bad' | 'info' | 'idle' | 'accent'

const DOT_TONE: Record<DeskTone, string> = {
  ok: 'bg-emerald-600 dark:bg-emerald-400',
  warn: 'bg-amber-500',
  bad: 'bg-red-600 dark:bg-red-400',
  info: 'bg-sky-600 dark:bg-sky-400',
  idle: 'bg-zinc-400 dark:bg-zinc-500',
  accent: 'bg-foreground',
}

/** Square state marker, signage style: colour carries state only. */
export function StatusDot({ tone = 'idle', className }: { tone?: DeskTone; className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block size-2 shrink-0 rounded-[1px]', DOT_TONE[tone], className)} />
}

/** A heading whose status marker sits on its first line, not vertically centred against wrapped text. */
export function TitleLine({
  tone,
  status,
  children,
  as: Tag = 'h3',
  className,
}: {
  tone?: DeskTone
  status?: string
  children: React.ReactNode
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div'
  className?: string
}) {
  return (
    <Tag className={cn('flex min-w-0 items-baseline gap-2', className)}>
      {tone && <StatusDot tone={tone} className="-translate-y-[0.1em]" />}
      {status && <span className="sr-only">{status}: </span>}
      <span className="min-w-0 break-words">{children}</span>
    </Tag>
  )
}

/** Page header for PageContainer's `header` slot. `eyebrow` is accepted for older callers and not rendered. */
export function DeskHeader({
  title,
  tone,
  status,
  meta,
  actions,
}: {
  title: React.ReactNode
  tone?: DeskTone
  status?: string
  meta?: React.ReactNode
  actions?: React.ReactNode
  eyebrow?: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <TitleLine as="h1" tone={tone} status={status} className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </TitleLine>
        {meta && <div className="mt-0.5 text-sm tabular-nums text-muted-foreground">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/**
 * Button row. Holding tab links (Pill asChild + active) it becomes an underline tab bar on a hairline;
 * holding actions it is a plain row of square buttons.
 */
export function Track({
  children,
  className,
  block,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { block?: boolean }) {
  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 overflow-x-auto [scrollbar-width:none]',
        '[&:has(>[data-tab])]:gap-0 [&:has(>[data-tab])]:border-b [&:has(>[data-tab])]:border-border',
        block && 'flex w-full [&>*]:flex-1',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

type PillVariant = 'plain' | 'raised' | 'primary' | 'danger'

const PILL_VARIANT: Record<PillVariant, string> = {
  plain: 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
  raised: 'border-border bg-background text-foreground hover:bg-muted',
  // Signage yellow: the one action a screen exists for.
  primary: 'border-[#d9ad00] bg-[#f5c400] text-[#1f2328] hover:bg-[#e6b800]',
  danger: 'border-red-600/40 bg-background text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10',
}

export interface PillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PillVariant
  /** Selected state: a tab when rendered as a link (asChild), a pressed toggle when rendered as a button. */
  active?: boolean
  size?: 'sm' | 'md'
  asChild?: boolean
}

/** Square button (4px corners). The legacy name stays so every desk keeps its imports. */
export const Pill = React.forwardRef<HTMLButtonElement, PillProps>(function Pill(
  { variant, active, size = 'md', asChild, className, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button'
  const tab = active !== undefined && asChild && !variant
  const toggle = active !== undefined && !asChild && !variant
  const resolved: PillVariant = variant ?? 'raised'
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? 'button')}
      data-active={active ? 'true' : undefined}
      data-tab={tab ? '' : undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        tab
          ? cn(
              '-mb-px border-b-2 px-3 text-sm',
              size === 'sm' ? 'h-8' : 'h-9',
              active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )
          : cn(
              'rounded-[4px] border',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
              toggle
                ? active
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
                : PILL_VARIANT[resolved],
            ),
        className,
      )}
      {...props}
    />
  )
})

/** View switch: underline tabs on a hairline, counts after the label. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size,
  block,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: ReadonlyArray<{ value: T; label: React.ReactNode; count?: number; tone?: DeskTone; disabled?: boolean }>
  label: string
  size?: 'sm' | 'md'
  block?: boolean
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={cn('flex max-w-full items-end overflow-x-auto border-b border-border [scrollbar-width:none]', block ? 'w-full [&>*]:flex-1' : 'w-full', className)}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              '-mb-px inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
              size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm',
              selected ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {option.tone && <StatusDot tone={option.tone} className="size-1.5" />}
            {option.label}
            {option.count !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{option.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** One figure in the summary strip: label, then its tabular value on the same line. */
export function Readout({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: DeskTone
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 items-baseline gap-2 px-3 py-1.5 text-sm', className)}>
      {tone && <StatusDot tone={tone} className="-translate-y-[0.1em]" />}
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-semibold tabular-nums text-foreground">{value}</span>
      {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
    </div>
  )
}

/** Summary figures as one inline strip between hairlines, never a row of tiles. */
export function ReadoutStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-wrap items-center border-y [&>*:first-child]:pl-0 [&>*+*]:border-l', className)}>
      {children}
    </div>
  )
}

/** Titled region separated by spacing and a hairline, not a card. */
export function DeskSection({
  title,
  count,
  actions,
  children,
  className,
  id,
}: {
  title: React.ReactNode
  count?: number
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  id?: string
}) {
  return (
    <section className={cn('min-w-0', className)} aria-labelledby={id}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b pb-2">
        <h2 id={id} className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
          {title}
          {count !== undefined && <span className="text-xs font-normal tabular-nums text-muted-foreground">{count}</span>}
        </h2>
        {actions}
      </div>
      <div className="pt-2">{children}</div>
    </section>
  )
}

/** Bordered surface for lists and forms: square-cornered, flat, rows ruled by hairlines. */
export function Panel({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('min-w-0 rounded-[4px] border bg-background', className)} {...props}>
      {children}
    </div>
  )
}

/** Label/value pairs in a two-column list. */
export function Facts({
  items,
  className,
}: {
  items: ReadonlyArray<{ label: React.ReactNode; value: React.ReactNode; mono?: boolean } | null | false | undefined>
  className?: string
}) {
  return (
    <dl className={cn('divide-y text-sm', className)}>
      {items.filter(Boolean).map((item, index) => {
        const row = item as { label: React.ReactNode; value: React.ReactNode; mono?: boolean }
        return (
          <div key={index} className="grid min-w-0 grid-cols-[minmax(7rem,40%)_1fr] items-baseline gap-4 py-1.5">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className={cn('min-w-0 break-words text-foreground', row.mono && 'font-medium tabular-nums')}>{row.value}</dd>
          </div>
        )
      })}
    </dl>
  )
}

/** Inline notice for errors and results. */
export function Notice({
  tone = 'idle',
  children,
  className,
  role,
}: {
  tone?: DeskTone
  children: React.ReactNode
  className?: string
  role?: 'alert' | 'status'
}) {
  return (
    <div
      role={role ?? (tone === 'bad' ? 'alert' : 'status')}
      className={cn(
        'flex min-w-0 items-baseline gap-2 rounded-[4px] border px-3 py-2 text-sm',
        tone === 'bad' && 'border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300',
        tone === 'warn' && 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200',
        tone === 'ok' && 'border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200',
        (tone === 'idle' || tone === 'info' || tone === 'accent') && 'bg-muted/50 text-foreground',
        className,
      )}
    >
      <StatusDot tone={tone} className="-translate-y-[0.1em]" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  )
}

/** Identifier set like a sign: record locator, flight number, offer number. Tabular, uppercase, tracked. */
export function Code({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('text-[12px] font-medium uppercase tabular-nums tracking-[0.04em] text-muted-foreground', className)}>{children}</span>
}

/** Signage plate: an airport or flight code in white on graphite, the desk's signature mark. */
export function Plate({ children, tone, className }: { children: React.ReactNode; tone?: 'attention'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-[1.375rem] min-w-[2.75rem] items-center justify-center rounded-[3px] px-1.5 text-[12px] font-semibold uppercase tabular-nums tracking-[0.06em]',
        tone === 'attention' ? 'bg-[#f5c400] text-[#1f2328]' : 'bg-[#1f2328] text-white dark:bg-zinc-200 dark:text-zinc-900',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Thin segmented meter for a share or progress value from real data (0..1). */
export function Meter({ value, tone = 'accent', segments = 12, label }: { value: number; tone?: DeskTone; segments?: number; label?: string }) {
  const filled = Math.round(Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * segments)
  const color = tone === 'ok' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : tone === 'bad' ? 'bg-red-500' : tone === 'info' ? 'bg-sky-500' : 'bg-foreground'
  return (
    <span role="meter" aria-valuemin={0} aria-valuemax={segments} aria-valuenow={filled} aria-label={label} className="inline-flex gap-0.5">
      {Array.from({ length: segments }, (_, index) => (
        <span key={index} className={cn('h-2.5 w-1', index < filled ? color : 'bg-muted-foreground/20')} />
      ))}
    </span>
  )
}

/** Maps a persisted lifecycle value onto a dot tone. */
export function statusTone(status?: string | null): DeskTone {
  const value = (status ?? '').toLowerCase()
  if (['active', 'available', 'open', 'open_for_sale', 'accepted', 'captured', 'succeeded', 'resolved', 'completed', 'checked_in', 'boarded', 'published', 'confirmed', 'ticketed', 'paid', 'approved', 'scheduled', 'departed', 'arrived', 'landed', 'flown'].includes(value)) return 'ok'
  if (['failed', 'cancelled', 'canceled', 'revoked', 'blocked', 'critical', 'mishandled', 'disabled', 'rejected', 'voided', 'offloaded', 'closed', 'diverted'].includes(value)) return 'bad'
  if (['pending', 'held', 'submitted', 'delayed', 'disrupted', 'recovering', 'paused', 'unpaid', 'partially_refunded', 'not_ticketed', 'in_progress', 'draft', 'major', 'high'].includes(value)) return 'warn'
  if (['refunded', 'expired', 'archived', 'merged', 'superseded'].includes(value)) return 'idle'
  return 'info'
}

/** Lifecycle value as a label, with its dot. */
export function StatusLabel({ status, className }: { status?: string | null; className?: string }) {
  const text = status ? status.replaceAll('_', ' ') : 'unknown'
  return (
    <span className={cn('inline-flex items-baseline gap-1.5 whitespace-nowrap text-xs font-medium capitalize text-foreground/80', className)}>
      <StatusDot tone={statusTone(status)} className="-translate-y-[0.05em] size-1.5" />
      {text}
    </span>
  )
}

/** Origin and destination as two signage plates joined by a hairline. */
export function Route({ from, to, className }: { from?: string | null; to?: string | null; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <Plate>{from || '---'}</Plate>
      <span aria-hidden="true" className="h-px w-3 bg-foreground/40" />
      <span className="sr-only">to</span>
      <Plate>{to || '---'}</Plate>
    </span>
  )
}

/** Empty and unavailable states: a ruled line of text where the rows would be. */
export function Well({ children, className, role }: { children: React.ReactNode; className?: string; role?: 'alert' | 'status' }) {
  return (
    <div role={role} className={cn('rounded-[4px] border bg-muted/30 px-4 py-4 text-sm text-muted-foreground', className)}>
      {children}
    </div>
  )
}

/** Search/filter bar: one ruled row of fields with the action at the end. */
export function FilterBar({ children, className, ...props }: React.FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form className={cn('flex min-w-0 flex-col gap-3 border-b pb-4 sm:flex-row sm:flex-wrap sm:items-end', className)} {...props}>
      {children}
    </form>
  )
}

/** Labelled field wrapper for native inputs on the desk. */
export function Field({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground', className)}>
      {label}
      {children}
    </label>
  )
}

export const deskInput = 'h-8 w-full min-w-0 rounded-[4px] border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/40'

/** Row link inside a Panel: title line on the left, figures on the right. */
export function RowLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn('flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring', className)}>
      {children}
    </Link>
  )
}
