'use client'

import { useState } from 'react'
import { Rocket } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import OnboardingDialog from './OnboardingDialog'

type CarrierIdentity = { name: string; legalName: string; code: string; defaultCurrencyCode: string; defaultTimezone: string }

export function OnboardingLaunchCard(_props: { initialCarrier?: CarrierIdentity; initialServiceDate: string }) {
  const [open, setOpen] = useState(false)
  return <Card className="border-amber-500/30 bg-amber-500/5 shadow-none">
    <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><Rocket className="size-4" /></span><div><h2 className="font-medium">Complete carrier launch setup</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Create or verify the persisted carrier identity and bounded launch catalog. This does not establish provider, regulatory, certification, or safety approval.</p></div></div>
      <Button className="shrink-0" onClick={() => setOpen(true)}>Get started</Button>
      <OnboardingDialog isOpen={open} onClose={() => setOpen(false)} />
    </CardContent>
  </Card>
}
