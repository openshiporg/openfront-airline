import { FlightStatusSearch } from '@/features/storefront/components/FlightStatusSearch'
import { PublicPageShell } from '@/features/storefront/components/PublicPageShell'
import { carrierCalendarDate } from '@/features/storefront/lib/branding'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { storefrontPageMetadata } from '@/features/storefront/lib/metadata'

// The root layout is static, so each storefront page renders per request and sets its own carrier title.
export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return storefrontPageMetadata('Flight status')
}

export default async function FlightStatusPage() {
  const carrier = await getStorefrontCarrierIdentity()
  const initialDate = carrierCalendarDate(new Date(), carrier?.defaultTimezone ?? 'UTC')
  return <PublicPageShell carrier={carrier} current="/status" eyebrow="Travel information" title="Flight status">
    {carrier ? <FlightStatusSearch carrier={carrier} initialDate={initialDate} /> : <p role="status" className="af-notice" data-tone="warn"><span className="af-dot" data-tone="warn" />Flight status isn&apos;t available right now.</p>}
  </PublicPageShell>
}
