'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Field, Notice, Panel, Pill, Track, deskInput } from '@/features/platform/components/desk'
import { OptionSelect } from '@/features/platform/components/OptionSelect'

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/graphql', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) })
  const body = await response.json() as { data?: T; errors?: Array<{ message: string }> }
  if (!response.ok || body.errors?.length || !body.data) throw new Error(body.errors?.[0]?.message ?? 'That didn’t work. Try again.')
  return body.data
}

export function StaffInviteForm({ roles }: { roles: Array<{ id: string; name: string }> }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null)

  async function invite(event: React.FormEvent) {
    event.preventDefault()
    if (sending) return
    setSending(true); setMessage(null)
    try {
      const data = await gql<{ inviteStaffMember: { email: string; roleName: string } }>('mutation($email: String!, $roleId: ID!) { inviteStaffMember(email: $email, roleId: $roleId) { email roleName } }', { email: email.trim(), roleId })
      setMessage({ text: `Invite sent to ${data.inviteStaffMember.email} as ${data.inviteStaffMember.roleName}.`, failed: false })
      setEmail('')
      router.refresh()
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'The invite was not sent.', failed: true })
    } finally {
      setSending(false)
    }
  }

  return <Panel className="space-y-3 p-4">
    <form onSubmit={invite} className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
      <Field label="Email" className="sm:flex-1">
        <input className={deskInput} type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="off" />
      </Field>
      <Field label="Role" className="sm:w-56">
        <OptionSelect name="roleId" value={roleId} onChange={event => setRoleId(event.target.value)} className={deskInput}>
          {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
        </OptionSelect>
      </Field>
      <Pill type="submit" variant="primary" disabled={sending || !roleId}>{sending ? 'Sending…' : 'Send invite'}</Pill>
    </form>
    <p className="text-xs text-muted-foreground">They get an email with a link to set a password. The link works once, for seven days.</p>
    {message && <Notice tone={message.failed ? 'bad' : 'ok'} role={message.failed ? 'alert' : 'status'}>{message.text}</Notice>}
  </Panel>
}

export function RevokeInvite({ id, email }: { id: string; email: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return <Track><Pill size="sm" disabled={busy} onClick={async () => {
    if (!window.confirm(`Cancel the invite to ${email}? The link stops working.`)) return
    setBusy(true)
    try { await gql('mutation($id: ID!) { revokeStaffInvite(id: $id) }', { id }); router.refresh() } catch (error) { window.alert(error instanceof Error ? error.message : 'Not cancelled.') } finally { setBusy(false) }
  }}>{busy ? 'Cancelling…' : 'Cancel invite'}</Pill></Track>
}
