'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { decimalToMinorUnits, formatMinorUnits } from '@/features/keystone/lib/money'
import { Field, Notice, Panel, Pill, deskInput } from '@/features/platform/components/desk'

// Refunds above this amount wait for a second person with payment rights. Administrators change it here.
export function ApprovalLimitForm({ amount, currencyCode, canEdit }: { amount: number; currencyCode: string; canEdit: boolean }) {
  const router = useRouter()
  const [value, setValue] = useState((amount / 100).toFixed(2))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    setSaving(true); setMessage(null)
    try {
      const minor = decimalToMinorUnits(value.trim(), currencyCode)
      if (!Number.isSafeInteger(minor) || minor < 0) throw new Error('Enter an amount of zero or more.')
      const response = await fetch('/api/graphql', {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'mutation($amount: Int!) { updateRefundApprovalThreshold(amount: $amount) { refundApprovalThreshold } }', variables: { amount: minor } }),
      })
      const body = await response.json() as { data?: { updateRefundApprovalThreshold?: { refundApprovalThreshold: number } }; errors?: Array<{ message: string }> }
      if (!response.ok || body.errors?.length || !body.data?.updateRefundApprovalThreshold) throw new Error(body.errors?.[0]?.message ?? 'The limit was not saved.')
      setMessage({ text: `Saved. Refunds above ${formatMinorUnits(body.data.updateRefundApprovalThreshold.refundApprovalThreshold, currencyCode)} now need a second approver.`, failed: false })
      router.refresh()
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'The limit was not saved.', failed: true })
    } finally {
      setSaving(false)
    }
  }

  return <Panel className="space-y-3 p-4">
    <p className="text-sm text-muted-foreground">A staff refund above this amount waits in Refunds until someone else with payment rights approves it. Refunds a customer makes online follow the fare rules.</p>
    {canEdit ? <form onSubmit={save} className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
      <Field label={`Approval limit (${currencyCode})`} className="sm:w-48">
        <input className={deskInput} inputMode="decimal" value={value} onChange={event => setValue(event.target.value)} />
      </Field>
      <Pill type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Save limit'}</Pill>
    </form> : <p className="text-sm text-foreground">Approval limit <span className="font-medium tabular-nums">{formatMinorUnits(amount, currencyCode)}</span>. Only an administrator can change it.</p>}
    {message && <Notice tone={message.failed ? 'bad' : 'ok'} role={message.failed ? 'alert' : 'status'}>{message.text}</Notice>}
  </Panel>
}
