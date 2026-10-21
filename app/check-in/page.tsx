import { FlightShop } from '@/features/storefront/components/FlightShop'
import { PublicPageShell } from '@/features/storefront/components/PublicPageShell'
import { carrierCalendarDate } from '@/features/storefront/lib/branding'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { storefrontPageMetadata } from '@/features/storefront/lib/metadata'

// The root layout is static, so each storefront page renders per request and sets its own carrier title.
export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return storefrontPageMetadata('Check in')
}

export default async function CheckInPage() {
  const carrier = await getStorefrontCarrierIdentity()
  const initialDate = carrierCalendarDate(new Date(Date.now() + 14 * 86_400_000), carrier?.defaultTimezone ?? 'UTC')
  return <PublicPageShell carrier={carrier} eyebrow="Passenger service" title="Check in for your flight" description="Enter your booking reference and access code, choose a seat, and get your boarding pass once your ticket is issued.">
    {carrier ? <FlightShop initialDate={initialDate} carrier={carrier} mode="check-in" /> : <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">Online check-in isn&apos;t available right now. Please check in at the airport.</p>}
  </PublicPageShell>
}
