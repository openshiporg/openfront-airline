'use client'

import { Notice, Readout, ReadoutStrip, StatusLabel } from './desk'

export function StatusBadge({ status }: { status: string }) {
  return <StatusLabel status={status} className="w-fit" />
}

export function WorkspaceNotice({ kind = 'boundary', children }: { kind?: 'boundary' | 'authority' | 'error'; children: React.ReactNode }) {
  return <Notice tone={kind === 'error' ? 'bad' : kind === 'authority' ? 'warn' : 'idle'} role={kind === 'error' ? 'alert' : 'status'}>{children}</Notice>
}

export function MetricStrip({ metrics }: { metrics: Array<{ label: string; value: string }> }) {
  return <ReadoutStrip>{metrics.map(metric => <Readout key={metric.label} label={metric.label} value={<span className="font-mono">{metric.value}</span>} />)}</ReadoutStrip>
}

export function WorkspaceLoadingState() {
  return <div role="status" aria-live="polite" className="space-y-4 p-4 md:p-6">
    <span className="sr-only">Loading</span>
    <div className="h-8 w-56 max-w-full animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-3">{[0, 1, 2].map(item => <div key={item} className="h-20 animate-pulse bg-card motion-reduce:animate-none" />)}</div>
    <div className="h-48 animate-pulse rounded-xl border bg-muted/40 motion-reduce:animate-none" />
  </div>
}
