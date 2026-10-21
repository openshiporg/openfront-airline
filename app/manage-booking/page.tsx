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
  return <PublicPageShell carrier={carrier} eyebrow="Passenger service" title="Manage your booking" description="Enter the booking reference and access code from your confirmation to view or change your trip.">
    {carrier ? <FlightShop initialDate={initialDate} carrier={carrier} mode="manage" /> : <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">Online booking management isn&apos;t available right now. Please try again later.</p>}
  </PublicPageShell>
}
