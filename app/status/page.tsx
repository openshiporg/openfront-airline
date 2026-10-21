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
  return <PublicPageShell carrier={carrier} eyebrow="Travel information" title="Flight status" description="See the latest schedule, terminal, gate, and any published delay or disruption for your flight.">
    {carrier ? <FlightStatusSearch carrier={carrier} initialDate={initialDate} /> : <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">Flight status isn&apos;t available right now. Please try again later.</p>}
  </PublicPageShell>
}
