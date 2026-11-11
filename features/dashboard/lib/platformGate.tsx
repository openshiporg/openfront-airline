import { notFound } from 'next/navigation'

import { getAuthenticatedUser } from '@/features/dashboard/actions/auth'
import { canUsePlatformPage } from './sidebarAccess'

/** A platform page for a role without the permissions its queries need is a 404, as the sidebar hides it. */
export function gatePlatformPage<P>(slug: string, Page: (props: P) => unknown) {
  return async function GatedPlatformPage(props: P) {
    const me = await getAuthenticatedUser()
    if (!canUsePlatformPage(slug, me.success ? (me.data as { authenticatedItem?: Parameters<typeof canUsePlatformPage>[1] } | undefined)?.authenticatedItem : null)) notFound()
    return Page(props) as React.ReactNode
  }
}
