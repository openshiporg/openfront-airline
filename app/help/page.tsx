import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { PublicPageShell } from '@/features/storefront/components/PublicPageShell'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { storefrontPageMetadata } from '@/features/storefront/lib/metadata'

const services = [
  { href: '/status', code: 'STS', title: 'Flight status', needs: 'Flight number · date' },
  { href: '/manage-booking', code: 'MNG', title: 'Manage booking', needs: 'Booking reference · access code' },
  { href: '/check-in', code: 'CHK', title: 'Check in', needs: 'Booking reference · access code' },
  { href: '/contact', code: 'CNT', title: 'Contact', needs: 'Airport service desk' },
] as const

// The root layout is static, so each storefront page renders per request and sets its own carrier title.
export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return storefrontPageMetadata('Help')
}

export default async function HelpPage() {
  const carrier = await getStorefrontCarrierIdentity()
  return <PublicPageShell carrier={carrier} current="/help" eyebrow="Help" title="How can we help?">
    <nav aria-label="Help topics" className="af-card max-w-3xl divide-y divide-[var(--af-line)] overflow-hidden">
      {services.map(service => <Link key={service.href} href={service.href} className="group flex items-center gap-4 p-5 transition-colors hover:bg-[var(--af-paper)] sm:p-6">
        <span className="min-w-0 flex-1"><span className="af-display block text-2xl uppercase sm:text-3xl">{service.title}</span><span className="af-mono mt-1 block text-xs text-[var(--af-ink-3)]">{service.needs}</span></span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-[var(--af-ink-3)] transition-transform group-hover:translate-x-0.5" />
      </Link>)}
    </nav>
  </PublicPageShell>
}
