import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { PublicPageShell } from '@/features/storefront/components/PublicPageShell'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { storefrontPageMetadata } from '@/features/storefront/lib/metadata'
import { policies } from '@/features/storefront/lib/policies'

const services = [
  { href: '/manage-booking', title: 'Manage booking', needs: 'Booking reference and last name' },
  { href: '/check-in', title: 'Check in', needs: 'Booking reference and last name' },
  { href: '/status', title: 'Flight status', needs: 'Flight number and date' },
  { href: '/contact', title: 'Contact', needs: 'Customer service and the airport desk' },
] as const

// The root layout is static, so each storefront page renders per request and sets its own carrier title.
export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return storefrontPageMetadata('Help')
}

export default async function HelpPage() {
  const carrier = await getStorefrontCarrierIdentity()
  return <PublicPageShell carrier={carrier} current="/help" eyebrow="Help" title="How can we help?">
    <div className="grid max-w-3xl gap-8">
      <nav aria-label="Help topics" className="af-card px-5 sm:px-6">
        <ul className="af-list">{services.map(service => <li key={service.href}><Link href={service.href} className="af-list-link" data-size="lg"><span className="min-w-0 flex-1"><span className="af-list-title">{service.title}</span><span className="af-list-note">{service.needs}</span></span><ChevronRight aria-hidden="true" /></Link></li>)}</ul>
      </nav>
      <section aria-labelledby="help-policies">
        <h2 id="help-policies" className="af-section-head">Travel policies</h2>
        <nav aria-labelledby="help-policies" className="af-card mt-4 px-5 sm:px-6">
          <ul className="af-list">{Object.entries(policies).map(([slug, policy]) => <li key={slug}><Link href={`/policies/${slug}`} className="af-list-link"><span className="af-list-title min-w-0 flex-1">{policy.title}</span><ChevronRight aria-hidden="true" /></Link></li>)}</ul>
        </nav>
      </section>
    </div>
  </PublicPageShell>
}
