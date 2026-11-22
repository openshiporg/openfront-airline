import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { PublicPageShell } from '@/features/storefront/components/PublicPageShell'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { storefrontPageMetadata } from '@/features/storefront/lib/metadata'
import { policies } from '@/features/storefront/lib/policies'

const services = [
  { href: '/status', code: 'STS', title: 'Flight status', needs: 'Flight number · date' },
  { href: '/manage-booking', code: 'MNG', title: 'Manage booking', needs: 'Booking reference · last name' },
  { href: '/check-in', code: 'CHK', title: 'Check in', needs: 'Booking reference · last name' },
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
        <span className="min-w-0 flex-1"><span className="block text-xl font-medium tracking-[-0.01em] sm:text-2xl">{service.title}</span><span className="mt-1 block text-sm text-[var(--af-ink-2)]">{service.needs}</span></span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-[var(--af-ink-3)] transition-transform group-hover:translate-x-0.5" />
      </Link>)}
    </nav>
    <section className="mt-8 max-w-3xl"><h2 className="text-2xl font-medium">Travel policies</h2><ul className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(policies).map(([slug, policy]) => <li key={slug}><Link href={`/policies/${slug}`} className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-[var(--af-line)] p-4 font-medium">{policy.title}<ChevronRight aria-hidden="true" className="size-4 shrink-0" /></Link></li>)}</ul></section>
  </PublicPageShell>
}
