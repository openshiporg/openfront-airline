import Link from 'next/link'

import { StorefrontFrame } from '@/features/storefront/components/StorefrontChrome'
import { carrierMetadata } from '@/features/storefront/lib/branding'
import { getStorefrontCarrierIdentityDirect } from '@/features/storefront/lib/carrier-direct'

export async function generateMetadata() {
  const carrier = await getStorefrontCarrierIdentityDirect()
  return carrier ? { ...carrierMetadata(carrier), title: `Page not found · ${carrier.name}` } : { title: 'Page not found' }
}

export default async function NotFound() {
  const carrier = await getStorefrontCarrierIdentityDirect()
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
