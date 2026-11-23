'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Field, Notice, Panel, Pill, Track, deskInput } from '@/features/platform/components/desk'

// A refund above the approval limit waits here. A different person with payment rights approves (the money moves)
// or declines it with a reason (nothing moves).
export function RefundDecision({ refundId, amountLabel }: { refundId: string; amountLabel: string }) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [working, setWorking] = useState<'approve' | 'decline' | null>(null)
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null)

  async function decide(approve: boolean) {
    if (working) return
    if (!approve && !reason.trim()) { setMessage({ text: 'Say why the refund is declined.', failed: true }); return }
    if (approve && !window.confirm(`Approve and send ${amountLabel} back to the original payment?`)) return
    setWorking(approve ? 'approve' : 'decline'); setMessage(null)
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: 'mutation($id: ID!, $approve: Boolean!, $reason: String, $key: String!) { decideRefundRequest(refundId: $id, approve: $approve, reason: $reason, idempotencyKey: $key) { status } }',
          variables: { id: refundId, approve, reason: approve ? null : reason.trim(), key: `refund-decision:${refundId}:${crypto.randomUUID()}` },
        }),
      })
      const body = await response.json() as { data?: { decideRefundRequest?: { status: string } }; errors?: Array<{ message: string }> }
      if (!response.ok || body.errors?.length || !body.data?.decideRefundRequest) throw new Error(body.errors?.[0]?.message ?? 'The decision was not saved.')
      setMessage({ text: approve ? `Approved. ${amountLabel} is on its way back to the original payment.` : 'Declined. No money moved.', failed: false })
      router.refresh()
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'The decision was not saved.', failed: true })
    } finally {
      setWorking(null)
    }
  }

  return <Panel className="space-y-4 p-4">
    <p className="text-sm text-muted-foreground">This refund is above the approval limit. Someone other than the person who asked for it has to approve it.</p>
    <Field label="Reason, if you decline">
      <input className={deskInput} value={reason} maxLength={500} onChange={event => setReason(event.target.value)} placeholder="For example: fare is non-refundable" />
    </Field>
    <Track>
      <Pill variant="primary" disabled={Boolean(working)} onClick={() => decide(true)}>{working === 'approve' ? 'Approving…' : `Approve ${amountLabel}`}</Pill>
      <Pill disabled={Boolean(working)} onClick={() => decide(false)}>{working === 'decline' ? 'Declining…' : 'Decline'}</Pill>
    </Track>
    {message && <Notice tone={message.failed ? 'bad' : 'ok'} role={message.failed ? 'alert' : 'status'}>{message.text}</Notice>}
  </Panel>
}
