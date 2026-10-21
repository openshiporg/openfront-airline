'use client'

import { AlertTriangle, CheckCircle2, CircleDashed, ShieldAlert } from 'lucide-react'

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const positive = ['active', 'available', 'open', 'open_for_sale', 'accepted', 'captured', 'succeeded', 'resolved', 'completed', 'checked_in', 'boarded', 'published'].includes(normalized)
  const negative = ['failed', 'cancelled', 'revoked', 'blocked', 'critical', 'mishandled', 'disabled'].includes(normalized)
  const Icon = positive ? CheckCircle2 : negative ? AlertTriangle : CircleDashed
  return <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium ${positive ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : negative ? 'border-destructive/25 bg-destructive/10 text-destructive' : 'bg-muted/50 text-muted-foreground'}`}><Icon className="size-3" aria-hidden="true" />{status.replaceAll('_', ' ')}</span>
}

export function WorkspaceNotice({ kind = 'boundary', children }: { kind?: 'boundary' | 'authority' | 'error'; children: React.ReactNode }) {
  const Icon = kind === 'authority' ? ShieldAlert : kind === 'error' ? AlertTriangle : CircleDashed
  return <div role={kind === 'error' ? 'alert' : 'note'} className={`flex items-start gap-2.5 border px-3 py-2.5 text-sm ${kind === 'error' ? 'border-destructive/30 bg-destructive/5 text-destructive' : kind === 'authority' ? 'border-amber-500/30 bg-amber-500/5 text-foreground' : 'bg-muted/30 text-muted-foreground'}`}><Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><p>{children}</p></div>
}

export function MetricStrip({ metrics }: { metrics: Array<{ label: string; value: string }> }) {
  return <dl className="grid border-y bg-card sm:grid-cols-3">{metrics.map(metric => <div key={metric.label} className="border-b px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><dt className="text-xs font-medium text-muted-foreground">{metric.label}</dt><dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{metric.value}</dd></div>)}</dl>
}

export function WorkspaceLoadingState() {
  return <div role="status" aria-live="polite" className="space-y-3 p-4 md:p-6"><span className="sr-only">Loading authorized workspace records</span><div className="h-10 animate-pulse bg-muted motion-reduce:animate-none" /><div className="grid gap-px bg-border p-px sm:grid-cols-3">{[0, 1, 2].map(item => <div key={item} className="h-20 animate-pulse bg-card motion-reduce:animate-none" />)}</div><div className="h-48 animate-pulse border bg-muted/40 motion-reduce:animate-none" /></div>
}
