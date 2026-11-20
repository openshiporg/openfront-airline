import Link from 'next/link'
import { connection } from 'next/server'

import { StorefrontFrame } from '@/features/storefront/components/StorefrontChrome'
import { carrierMetadata } from '@/features/storefront/lib/branding'
import { getStorefrontCarrierIdentityDirect } from '@/features/storefront/lib/carrier-direct'

// Rendered per request: a build-time prerender has no database, so it lost the carrier name.
export async function generateMetadata() {
  await connection()
  const carrier = await getStorefrontCarrierIdentityDirect()
  return carrier ? { ...carrierMetadata(carrier), title: `Page not found · ${carrier.name}` } : { title: 'Page not found' }
}

export default async function NotFound() {
  await connection()
  const carrier = await getStorefrontCarrierIdentityDirect()
  return <StorefrontFrame carrier={carrier}>
    <section className="af-board border-t border-[var(--af-board-line)]">
      <div className="af-container py-20 sm:py-28">
        <p className="af-kicker text-white/85"><span className="af-signal">404</span> · Page not found</p>
        <h1 className="af-display mt-4 max-w-3xl text-5xl sm:text-7xl">This gate doesn&apos;t exist</h1>
        <div className="mt-10 flex flex-wrap gap-3"><Link href="/" className="af-pill af-pill-primary">Book a flight</Link><Link href="/status" className="af-pill af-pill-ghost">Flight status</Link><Link href="/manage-booking" className="af-pill af-pill-ghost">Manage booking</Link></div>
      </div>
    </section>
  </StorefrontFrame>
}
