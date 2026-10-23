'use client'

import { useState } from 'react'

import { Panel, Pill, TitleLine, Track } from '@/features/platform/components/desk'
import OnboardingDialog from './OnboardingDialog'

type CarrierIdentity = { name: string; legalName: string; code: string; defaultCurrencyCode: string; defaultTimezone: string }

export function OnboardingLaunchCard(_props: { initialCarrier?: CarrierIdentity; initialServiceDate: string }) {
  const [open, setOpen] = useState(false)
  return <Panel className="flex min-w-0 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <TitleLine as="h2" tone="warn" className="text-sm font-semibold text-foreground">Carrier launch setup</TitleLine>
      <p className="mt-0.5 pl-4 text-xs text-muted-foreground">Incomplete</p>
    </div>
    <Track className="self-start sm:self-auto"><Pill variant="primary" onClick={() => setOpen(true)}>Get started</Pill></Track>
    <OnboardingDialog isOpen={open} onClose={() => setOpen(false)} />
  </Panel>
}
