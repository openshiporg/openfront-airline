import { FlightShop } from '@/features/storefront/components/FlightShop'
import { PublicPageShell } from '@/features/storefront/components/PublicPageShell'
import { carrierCalendarDate } from '@/features/storefront/lib/branding'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { storefrontPageMetadata } from '@/features/storefront/lib/metadata'

// The root layout is static, so each storefront page renders per request and sets its own carrier title.
export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return storefrontPageMetadata('Manage booking')
}

export default async function ManageBookingPage() {
  const carrier = await getStorefrontCarrierIdentity()
  const initialDate = carrierCalendarDate(new Date(Date.now() + 14 * 86_400_000), carrier?.defaultTimezone ?? 'UTC')
  return <PublicPageShell carrier={carrier} current="/manage-booking" eyebrow="Passenger service" title="Manage booking">
    {carrier ? <FlightShop initialDate={initialDate} carrier={carrier} mode="manage" /> : <p role="status" className="af-notice" data-tone="warn"><span className="af-dot" data-tone="warn" />Online booking management isn&apos;t available right now.</p>}
  </PublicPageShell>
}
