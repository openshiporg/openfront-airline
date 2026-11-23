import Link from 'next/link'
import { connection } from 'next/server'

import { StorefrontFrame } from '@/features/storefront/components/StorefrontChrome'
import { carrierMetadata } from '@/features/storefront/lib/branding'
import { getStorefrontCarrierIdentityDirect } from '@/features/storefront/lib/carrier-direct'

// Rendered per request: a build-time prerender has no database, so it lost the carrier name.
export async function generateMetadata() {
  await connection()
  const carrier = await getStorefrontCarrierIdentityDirect()
  return { ...carrierMetadata(carrier), title: carrier ? `Page not found · ${carrier.name}` : 'Page not found' }
}

export default async function NotFound() {
  await connection()
  const carrier = await getStorefrontCarrierIdentityDirect()
  return <StorefrontFrame carrier={carrier}>
    <section className="af-board af-page-head">
      <div className="af-container py-16 sm:py-24">
        <p className="af-kicker"><span className="af-signal">404</span> · Page not found</p>
        <h1 className="af-display af-page-title mt-3 max-w-3xl">This gate doesn’t exist</h1>
        <p className="af-lead-text mt-4">The page may have moved, or the link may be mistyped.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Link href="/" className="af-pill af-pill-primary">Book a flight</Link><Link href="/status" className="af-pill af-pill-ghost">Flight status</Link><Link href="/manage-booking" className="af-pill af-pill-ghost">Manage booking</Link></div>
      </div>
    </section>
  </StorefrontFrame>
}
