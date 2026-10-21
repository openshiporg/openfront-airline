'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getOnboardingCarrier, type OnboardingCarrierResult } from '../actions/onboarding'
import { CarrierOnboardingForm } from './CarrierOnboardingForm'

// The shared DashboardLayout's onboarding dialog: the same carrier launch form as the Operations launch card and
// /dashboard/onboarding, prefilled from the persisted carrier so a replay never starts from the demo defaults.
export default function OnboardingDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [risk, setRisk] = useState({ busy: false, dirty: false, hasSecret: false, unknown: false })
  const [closeMessage, setCloseMessage] = useState('')
  const [result, setResult] = useState<OnboardingCarrierResult | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setResult(null)
    setCloseMessage('')
    let cancelled = false
    void getOnboardingCarrier().then(next => { if (!cancelled) setResult(next) }).catch(() => { if (!cancelled) setResult({ success: false, error: 'Carrier identity could not be loaded. Try again.' }) })
    return () => { cancelled = true }
  }, [isOpen])

  if (!isOpen) return null
  const serviceDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
  return <Dialog open={isOpen} onOpenChange={open => { if (open) return; if (risk.busy || risk.unknown) { setCloseMessage('Keep this window open until the credential operation is reconciled.'); return } if ((risk.dirty || risk.hasSecret) && !window.confirm('Close setup? Unsaved edits and the displayed one-time credential will no longer be available here. Copy the credential first.')) return; onClose() }}>
    <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
      <DialogHeader><DialogTitle>Carrier launch setup</DialogTitle><DialogDescription>Set up your carrier identity and first sellable flight. Running setup again never overwrites a live service.</DialogDescription></DialogHeader>
      {closeMessage && <p role="alert" className="text-sm text-destructive">{closeMessage}</p>}
      {!result ? <p role="status" className="text-sm text-muted-foreground">Loading carrier identity…</p>
        : result.success && result.carrier ? <CarrierOnboardingForm key={result.carrier.id} initialCarrier={result.carrier} initialServiceDate={serviceDate} onExitRiskChange={setRisk} />
        : result.success ? <p role="alert" className="text-sm">Your account is not assigned to a carrier, so launch setup is unavailable. Ask a carrier administrator to assign your operator account.</p>
        : <p role="alert" className="text-sm">{result.error} <Link href="/dashboard/onboarding" onClick={onClose} className="font-medium underline">Open carrier launch setup</Link></p>}
    </DialogContent>
  </Dialog>
}
