import { AccountPanel } from '@/features/storefront/components/AccountPanel'
import { PublicPageShell } from '@/features/storefront/components/PublicPageShell'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { storefrontPageMetadata } from '@/features/storefront/lib/metadata'

// The root layout is static, so each storefront page renders per request and sets its own carrier title.
export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return storefrontPageMetadata('My account')
}

export default async function AccountPage() {
  const carrier = await getStorefrontCarrierIdentity()
  return <PublicPageShell carrier={carrier} current="/account" eyebrow="My account" title="My trips">
    {carrier ? <AccountPanel carrierCode={carrier.code} /> : <p role="status" className="af-notice" data-tone="warn"><span className="af-dot" data-tone="warn" />Accounts open once the airline is set up.</p>}
  </PublicPageShell>
}
