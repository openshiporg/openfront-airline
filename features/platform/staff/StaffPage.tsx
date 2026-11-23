import Link from 'next/link'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { DeskSection, Notice, Panel } from '@/features/platform/components/desk'
import { Shell } from '@/features/platform/screens/Canonical/PlatformDeskPages'
import { RevokeInvite, StaffInviteForm } from './StaffInviteForm'

type StaffData = {
  authenticatedItem: { id: string; role: { canManageUsers: boolean | null; canManageCarriers: boolean | null } | null } | null
  users: Array<{ id: string; name: string; email: string; role: { name: string } | null }> | null
  roles: Array<{ id: string; name: string }> | null
}

// Who can sign in to the staff desk, and the invite form. The raw Users table stays under Models for administrators.
export async function StaffPage() {
  const response = await keystoneClient<StaffData>(`query StaffPage {
    authenticatedItem { ... on User { id role { canManageUsers canManageCarriers } } }
    users(orderBy: [{ name: asc }], take: 200) { id name email role { name } }
    roles(orderBy: [{ name: asc }]) { id name }
  }`, {}, { cache: 'no-store' })
  const me = response.success ? response.data.authenticatedItem : null
  const canInvite = me?.role?.canManageUsers === true || me?.role?.canManageCarriers === true
  const invites = canInvite
    ? await keystoneClient<{ pendingStaffInvites: Array<{ id: string; email: string; roleName: string; expiresAt: string }> }>('query { pendingStaffInvites { id email roleName expiresAt } }', {}, { cache: 'no-store' })
    : null
  const users = response.success ? response.data.users ?? [] : []
  const roles = response.success ? response.data.roles ?? [] : []
  const open = invites?.success ? invites.data.pendingStaffInvites : []

  return <Shell title="Staff" eyebrow="Settings">
    {!response.success ? <Notice tone="bad" role="alert">Staff are unavailable right now. Reload the page.</Notice> : <div className="space-y-8">
      {canInvite && <DeskSection title="Invite someone">
        {roles.length ? <StaffInviteForm roles={roles} /> : <Notice tone="warn">Create a role first.</Notice>}
      </DeskSection>}
      {canInvite && open.length > 0 && <DeskSection title="Invites waiting" count={open.length}>
        <Panel className="divide-y">{open.map(invite => <div key={invite.id} className="flex min-w-0 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{invite.email}</p>
            <p className="text-xs text-muted-foreground">{invite.roleName} · link works until {new Date(invite.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</p>
          </div>
          <RevokeInvite id={invite.id} email={invite.email} />
        </div>)}</Panel>
      </DeskSection>}
      <DeskSection title="Team" count={users.length}>
        <Panel className="divide-y">{users.map(user => <Link key={user.id} href={`/dashboard/users/${user.id}`} className="flex min-w-0 flex-col gap-0.5 px-4 py-3 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{user.name || user.email}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          </span>
          {user.role?.name && <span className="text-xs text-muted-foreground">{user.role.name}</span>}
        </Link>)}</Panel>
      </DeskSection>
    </div>}
  </Shell>
}
