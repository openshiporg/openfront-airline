import Link from 'next/link'

import { StorefrontFrame } from '@/features/storefront/components/StorefrontChrome'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { storefrontPageMetadata } from '@/features/storefront/lib/metadata'

export async function generateMetadata() {
  return storefrontPageMetadata('Page not found')
}

export default async function NotFound() {
  const carrier = await getStorefrontCarrierIdentity().catch(() => null)
  return <StorefrontFrame carrier={carrier}>
    <section className="af-board">
      <div className="af-container py-24 sm:py-32">
        <p className="af-eyebrow"><span className="af-signal">404</span> · Page not found</p>
        <h1 className="af-display mt-4 max-w-3xl text-6xl uppercase sm:text-8xl">This gate doesn&apos;t exist</h1>
        <div className="af-track mt-10"><Link href="/" className="af-pill af-pill-primary">Book a flight</Link><Link href="/status" className="af-pill">Flight status</Link><Link href="/manage-booking" className="af-pill">Manage booking</Link></div>
      </div>
    </section>
  </StorefrontFrame>
}
