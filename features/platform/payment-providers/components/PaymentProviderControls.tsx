'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { Field, Notice, Panel, Pill, Track, deskInput } from '@/features/platform/components/desk'
import { createManualPaymentProvider, createStripePaymentProvider, setPaymentProviderStatus } from '@/features/platform/payment-providers/actions/paymentProviders'

export function NewManualProvider({ carrierCode }: { carrierCode: string }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [code, setCode] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  const normalizedCode = code.trim().toLowerCase()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createManualPaymentProvider({ name, code })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOpen(false)
      setName('')
      setCode('')
      router.refresh()
    })
  }

  if (!open) {
    return (
      <Track>
        <Pill variant="primary" onClick={() => { setError(null); setOpen(true) }}>Manual settlement</Pill>
      </Track>
    )
  }

  return (
    <Panel className="p-4">
      <form onSubmit={submit} className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Manual settlement</h2>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input required maxLength={120} value={name} onChange={event => setName(event.target.value)} className={deskInput} />
          </Field>
          <Field label="Code">
            <input
              required
              maxLength={32}
              pattern="[A-Za-z0-9][A-Za-z0-9_\-]{1,31}"
              value={code}
              onChange={event => setCode(event.target.value)}
              className={`${deskInput} tabular-nums lowercase`}
            />
          </Field>
        </div>
        <dl className="divide-y text-sm">
          <div className="flex min-w-0 items-baseline justify-between gap-4 py-2">
            <dt className="shrink-0 text-muted-foreground">Provider key</dt>
            <dd className="min-w-0 break-all text-right tabular-nums text-[13px]  text-foreground">{`${carrierCode}:manual:${normalizedCode || '...'}`.toLowerCase()}</dd>
          </div>
          <div className="flex min-w-0 items-baseline justify-between gap-4 py-2">
            <dt className="shrink-0 text-muted-foreground">Adapter</dt>
            <dd className="text-right text-foreground">Manual, evidence only</dd>
          </div>
          <div className="flex min-w-0 items-baseline justify-between gap-4 py-2">
            <dt className="shrink-0 text-muted-foreground">Approval</dt>
            <dd className="text-right text-foreground">Independent approval required</dd>
          </div>
        </dl>
        {error && <Notice tone="bad">{error}</Notice>}
        <Track>
          <Pill type="submit" variant="primary" disabled={pending}>{pending ? 'Saving' : 'Create provider'}</Pill>
          <Pill disabled={pending} onClick={() => setOpen(false)}>Cancel</Pill>
        </Track>
      </form>
    </Panel>
  )
}

export function NewStripeProvider() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('Card payments')
  const [secretKey, setSecretKey] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createStripePaymentProvider({ name, secretKey })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOpen(false)
      setSecretKey('')
      router.refresh()
    })
  }

  if (!open) {
    return (
      <Track>
        <Pill onClick={() => { setError(null); setOpen(true) }}>Card payments (Stripe)</Pill>
      </Track>
    )
  }

  return (
    <Panel className="p-4">
      <form onSubmit={submit} className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Card payments (Stripe)</h2>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input required maxLength={120} value={name} onChange={event => setName(event.target.value)} className={deskInput} />
          </Field>
          <Field label="Secret key">
            <input required type="password" autoComplete="off" placeholder="sk_test_…" value={secretKey} onChange={event => setSecretKey(event.target.value)} className={`${deskInput} tabular-nums`} />
          </Field>
        </div>
        {error && <Notice tone="bad">{error}</Notice>}
        <Track>
          <Pill type="submit" variant="primary" disabled={pending}>{pending ? 'Saving' : 'Connect Stripe'}</Pill>
          <Pill disabled={pending} onClick={() => setOpen(false)}>Cancel</Pill>
        </Track>
      </form>
    </Panel>
  )
}

export function PaymentProviderActions({ id, status, adapterType }: { id: string; status: string | null; adapterType: string | null }) {
  const router = useRouter()
  const [error, setError] = React.useState<string | null>(null)
  const [confirmDisable, setConfirmDisable] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const current = status ?? 'inactive'
  const canActivate = (adapterType === 'manual' || adapterType === 'stripe') && current !== 'active'

  function transition(next: 'active' | 'inactive' | 'disabled') {
    setError(null)
    startTransition(async () => {
      const result = await setPaymentProviderStatus(id, next)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setConfirmDisable(false)
      router.refresh()
    })
  }

  return (
    <div className="min-w-0 space-y-2">
      <Track aria-label="Provider actions">
        {canActivate && <Pill size="sm" variant="primary" disabled={pending} onClick={() => transition('active')}>Activate</Pill>}
        {current !== 'inactive' && <Pill size="sm" disabled={pending} onClick={() => transition('inactive')}>Deactivate</Pill>}
        {current !== 'disabled' && (confirmDisable ? (
          <>
            <Pill size="sm" variant="danger" disabled={pending} onClick={() => transition('disabled')}>Confirm disable</Pill>
            <Pill size="sm" disabled={pending} onClick={() => setConfirmDisable(false)}>Keep</Pill>
          </>
        ) : (
          <Pill size="sm" disabled={pending} onClick={() => setConfirmDisable(true)}>Disable</Pill>
        ))}
      </Track>
      {error && <Notice tone="bad">{error}</Notice>}
    </div>
  )
}
