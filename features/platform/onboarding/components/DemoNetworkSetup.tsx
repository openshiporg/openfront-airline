'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { Code, DeskSection, Meter, Notice, Panel, Pill, Track } from '@/features/platform/components/desk'
import { demoNetworkSummary, useDemoNetwork } from '../hooks/useDemoNetwork'

// The full template: shows what the demo network creates, then loads it through the operator's own setup commands.
export function DemoNetworkSetup({ carrierId, onBusyChange, onBack }: { carrierId: string; onBusyChange?: (busy: boolean) => void; onBack?: () => void }) {
  const router = useRouter()
  const summary = demoNetworkSummary()
  const { progress, run } = useDemoNetwork(carrierId)
  const busy = progress.phase === 'running'
  useEffect(() => { onBusyChange?.(busy) }, [busy, onBusyChange])
  useEffect(() => { if (progress.phase === 'done' || progress.phase === 'failed') router.refresh() }, [progress.phase, router])

  return <div className="min-w-0 space-y-6">
    <DeskSection title="Carrier and storefront">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Carrier</dt><dd>{summary.carrier.name} <Code>{summary.carrier.code}</Code></dd></div>
        <div><dt className="text-xs text-muted-foreground">Currency · timezone</dt><dd className="font-mono text-xs">{summary.carrier.currencyCode} · {summary.carrier.timezone}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Homepage</dt><dd className="font-medium">{summary.storefront.homepageTitle}</dd><dd className="text-muted-foreground">{summary.storefront.homepageDescription}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Customer service</dt><dd>{summary.storefront.contactPhone} · {summary.storefront.contactEmail}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Hours</dt><dd>{summary.storefront.serviceHours}</dd></div>
      </dl>
    </DeskSection>
    <DeskSection title="Network" count={summary.routes.length}>
      <Panel className="overflow-hidden">
        <ul className="divide-y text-sm">{summary.routes.map(route => <li key={route.flightNumber} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2">
          <span className="flex items-baseline gap-3"><Code>{summary.carrier.code}{route.flightNumber}</Code><span className="font-mono">{route.origin} → {route.destination}</span></span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{route.departure}–{route.arrival} ET · {route.capacity} seats · ${route.baseFare} + ${route.tax}</span>
        </li>)}</ul>
      </Panel>
      <p className="mt-2 text-xs text-muted-foreground">Daily for the next {summary.serviceDays} days: {summary.flights} dated flights across {summary.airports.length} airports, an Economy cabin with a Standard fare (seat selection, one checked bag), station access at each origin and the manual settlement providers. Direct sales are switched on.</p>
    </DeskSection>

    {progress.phase !== 'idle' && <div className="space-y-2">
      <Meter value={progress.total ? progress.done / progress.total : 0} tone={progress.phase === 'failed' ? 'warn' : progress.phase === 'done' ? 'ok' : 'accent'} label={`${progress.done} of ${progress.total}`} />
      <p className="text-xs text-muted-foreground" role="status">{progress.label} · {progress.done}/{progress.total}</p>
    </div>}
    {progress.phase === 'done' && <Notice tone="ok">Demo network loaded. To finish launch review, add a second payment operator and a settlement credential in Carrier launch setup.</Notice>}
    {progress.failures.length > 0 && <Notice tone="warn"><span className="space-y-1">{progress.failures.slice(0, 6).map(failure => <span key={failure} className="block">{failure}</span>)}{progress.failures.length > 6 && <span className="block">…and {progress.failures.length - 6} more. Run it again to retry only what is missing.</span>}</span></Notice>}

    <Track className="flex-wrap">
      {onBack && <Pill disabled={busy} onClick={onBack}>Back</Pill>}
      <Pill variant="primary" disabled={busy || progress.phase === 'done'} onClick={() => void run()}>{busy ? 'Loading demo network…' : progress.phase === 'failed' ? 'Retry demo network' : progress.phase === 'done' ? 'Demo network loaded' : 'Load demo network'}</Pill>
      {progress.phase === 'done' && <><Pill asChild><a href="/" target="_blank" rel="noreferrer">View storefront</a></Pill><Pill asChild><a href="/dashboard/platform/network">Network</a></Pill></>}
    </Track>
  </div>
}
