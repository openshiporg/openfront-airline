'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getOnboardingCarrier, type OnboardingCarrierResult } from '../actions/onboarding'
import { Notice, Pill, Track, Well } from '@/features/platform/components/desk'
import { CarrierOnboardingForm } from './CarrierOnboardingForm'
import { DemoNetworkSetup } from './DemoNetworkSetup'

type Template = 'full' | 'custom'

const TEMPLATES: Array<{ key: Template; title: string; body: string }> = [
  { key: 'full', title: 'Full demo network', body: 'Avante Air from New York JFK: four nonstop city pairs flying daily for two weeks, storefront brand, customer service details and direct sales.' },
  { key: 'custom', title: 'Custom launch', body: 'Enter your own carrier identity and first sellable flight, then complete launch readiness step by step.' },
]

// The shared DashboardLayout's onboarding dialog: the same carrier launch form as the Operations launch card and
// /dashboard/onboarding, prefilled from the persisted carrier so a replay never starts from the demo defaults.
export default function OnboardingDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [risk, setRisk] = useState({ busy: false, dirty: false, hasSecret: false, unknown: false })
  const [closeMessage, setCloseMessage] = useState('')
  const [result, setResult] = useState<OnboardingCarrierResult | null>(null)
  const [template, setTemplate] = useState<Template | null>(null)
  const [demoBusy, setDemoBusy] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setResult(null)
    setCloseMessage('')
    setTemplate(null)
    let cancelled = false
    void getOnboardingCarrier().then(next => { if (!cancelled) setResult(next) }).catch(() => { if (!cancelled) setResult({ success: false, error: 'Carrier identity could not be loaded. Try again.' }) })
    return () => { cancelled = true }
  }, [isOpen])

  if (!isOpen) return null
  const serviceDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
  return <Dialog open={isOpen} onOpenChange={open => { if (open) return; if (risk.busy || risk.unknown || demoBusy) { setCloseMessage(demoBusy ? 'Keep this window open until the demo network finishes loading.' : 'Keep this window open until the credential operation is reconciled.'); return } if ((risk.dirty || risk.hasSecret) && !window.confirm('Close setup? Unsaved edits and the displayed one-time credential will no longer be available here. Copy the credential first.')) return; onClose() }}>
    <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto overflow-x-hidden">
      <DialogHeader><DialogTitle>Carrier launch setup</DialogTitle><DialogDescription className="sr-only">Carrier identity and first sellable flight</DialogDescription></DialogHeader>
      {closeMessage && <Notice tone="bad">{closeMessage}</Notice>}
      {!result ? <Well role="status">Loading carrier identity…</Well>
        : result.success && result.carrier ? (
          template === 'full' ? <DemoNetworkSetup carrierId={result.carrier.id} onBusyChange={setDemoBusy} onBack={() => setTemplate(null)} />
          : template === 'custom' ? <CarrierOnboardingForm key={result.carrier.id} initialCarrier={result.carrier} initialServiceDate={serviceDate} onExitRiskChange={setRisk} />
          : <div role="radiogroup" aria-label="Setup template" className="grid gap-3 sm:grid-cols-2">{TEMPLATES.map(option => <button key={option.key} type="button" role="radio" aria-checked={false} onClick={() => setTemplate(option.key)} className="rounded-xl border bg-background p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="block text-sm font-semibold text-foreground">{option.title}</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.body}</span>
          </button>)}</div>
        )
        : result.success ? <Well role="alert">Your account is not assigned to a carrier, so launch setup is unavailable. Ask a carrier administrator to assign your operator account.</Well>
        : <div className="space-y-3"><Notice tone="bad">{result.error}</Notice><Track><Pill asChild variant="primary"><Link href="/dashboard/onboarding" onClick={onClose}>Open carrier launch setup</Link></Pill></Track></div>}
    </DialogContent>
  </Dialog>
}
