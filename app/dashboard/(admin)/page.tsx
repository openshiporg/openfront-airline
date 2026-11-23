import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { redirect } from 'next/navigation'

import OperationsPage from '@/features/platform/screens/Operations/OperationsPage'
import { getAuthenticatedUser } from '@/features/dashboard/actions/auth'
import { staffLandingPath } from '@/features/dashboard/lib/sidebarAccess'

// Each staff member opens on the desk they work at; admins and mixed roles get the operations overview.
export default async function DashboardHome() {
  const me = await getAuthenticatedUser()
  const user = me.success ? (me.data as { authenticatedItem?: Parameters<typeof staffLandingPath>[0] } | undefined)?.authenticatedItem : null
  const landing = staffLandingPath(user)
  if (landing) redirect(landing)
  return <OperationsPage />
}

export async function generateMetadata() {
  return staffTitle('Overview')
}
