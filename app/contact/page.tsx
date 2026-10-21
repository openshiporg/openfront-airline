import Link from 'next/link'

import { PublicPageShell } from '@/features/storefront/components/PublicPageShell'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { storefrontPageMetadata } from '@/features/storefront/lib/metadata'

// The root layout is static, so each storefront page renders per request and sets its own carrier title.
export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return storefrontPageMetadata('Contact')
}

export default async function ContactPage() {
  const carrier = await getStorefrontCarrierIdentity()
  return <PublicPageShell carrier={carrier} eyebrow="Contact" title="Contact the airline" description="Most changes can be made online. For anything else, contact the airline at the airport.">
    <div className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">What you can do now</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600"><li>Retrieve and cancel an eligible reservation through <Link href="/manage-booking" className="font-medium text-[var(--storefront-brand)] underline">Manage booking</Link>.</li><li>Check current schedule information through <Link href="/status" className="font-medium text-[var(--storefront-brand)] underline">Flight status</Link>.</li><li>Complete eligible passenger check-in through <Link href="/check-in" className="font-medium text-[var(--storefront-brand)] underline">Check in</Link>.</li></ul><p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">Keep your booking reference handy. Never share your booking access code by email or phone; the airline will not ask for it.</p></div>
  </PublicPageShell>
}
