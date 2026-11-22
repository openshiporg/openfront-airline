import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { PublicPageShell } from '@/features/storefront/components/PublicPageShell'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { storefrontPageMetadata } from '@/features/storefront/lib/metadata'

const online = [
  { href: '/manage-booking', label: 'View or cancel a booking' },
  { href: '/status', label: 'Flight status' },
  { href: '/check-in', label: 'Check in' },
] as const

// The root layout is static, so each storefront page renders per request and sets its own carrier title.
export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return storefrontPageMetadata('Contact')
}

export default async function ContactPage() {
  const carrier = await getStorefrontCarrierIdentity()
  return <PublicPageShell carrier={carrier} current="/contact" eyebrow="Contact" title={`Contact ${carrier?.name ?? 'the airline'}`}>
    <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
      <section className="af-card p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Online</h2>
        <ul className="mt-3 divide-y divide-[var(--af-line)]">{online.map(item => <li key={item.href}><Link href={item.href} className="flex min-h-12 items-center justify-between gap-3 font-semibold hover:text-[var(--af-accent)]">{item.label}<ArrowRight aria-hidden="true" className="size-4 text-[var(--af-ink-3)]" /></Link></li>)}</ul>
      </section>
      <section className="af-card p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Customer service</h2>
        <dl className="mt-3 space-y-4">
          <div><dt className="af-field-label">Email</dt><dd><a href="mailto:hello@openship.org" className="break-all font-semibold hover:text-[var(--af-accent)]">hello@openship.org</a></dd></div>
          <div><dt className="af-field-label">Airport service desk</dt><dd className="text-sm leading-6">Avante Air at New York JFK. Check your flight information for the departure terminal; ask airport information for the airline service desk.</dd></div>
          <div><dt className="af-field-label">Desk hours</dt><dd className="text-sm leading-6">From 3 hours before each Avante Air departure until that flight departs, in New York local time. For help outside departure hours, email us.</dd></div>
        </dl>
        <p className="af-mono mt-4 text-xs text-[var(--af-ink-3)]">Avante Air LLC</p>
        <p className="af-title-line mt-6 text-sm font-medium"><span className="af-dot" data-tone="warn" />We never ask for your card number or password.</p>
      </section>
    </div>
  </PublicPageShell>
}
