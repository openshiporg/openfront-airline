import Link from 'next/link'

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
    <div className="relative z-10 grid gap-4 md:grid-cols-[1.2fr_1fr]">
      <section className="af-card p-5 shadow-[0_24px_48px_-24px_rgb(15_27_45/0.45)] sm:p-6">
        <h2 className="af-eyebrow">Online</h2>
        <ul className="mt-3 divide-y divide-[var(--af-line)]">{online.map(item => <li key={item.href}><Link href={item.href} className="flex min-h-12 items-center justify-between gap-3 font-semibold hover:text-[var(--af-accent)]">{item.label}<span className="af-mono text-xs text-[var(--af-ink-3)]">{item.href}</span></Link></li>)}</ul>
      </section>
      <section className="af-card p-5 sm:p-6">
        <h2 className="af-eyebrow">Everything else</h2>
        <p className="af-display mt-3 text-3xl uppercase">Airport service desk</p>
        <p className="af-mono mt-3 text-xs uppercase tracking-[0.1em] text-[var(--af-ink-3)]">{carrier?.legalName ?? ''}</p>
        <p className="af-title-line mt-6 text-sm font-medium"><span className="af-dot" data-tone="warn" />We never ask for your access code.</p>
      </section>
    </div>
  </PublicPageShell>
}
