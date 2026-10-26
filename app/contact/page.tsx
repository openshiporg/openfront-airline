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
    <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
      <section className="af-card p-5 sm:p-6">
        <h2 className="text-lg font-bold">Online</h2>
        <ul className="mt-3 divide-y divide-[var(--af-line)]">{online.map(item => <li key={item.href}><Link href={item.href} className="flex min-h-12 items-center justify-between gap-3 font-semibold hover:text-[var(--af-accent)]">{item.label}<span className="af-mono text-xs text-[var(--af-ink-3)]">{item.href}</span></Link></li>)}</ul>
      </section>
      <section className="af-card p-5 sm:p-6">
        <h2 className="text-lg font-bold">Customer service</h2>
        {carrier?.storefrontContactPhone || carrier?.storefrontContactEmail ? <dl className="mt-3 space-y-3">
          {carrier.storefrontContactPhone && <div><dt className="af-field-label">Phone</dt><dd><a href={`tel:${carrier.storefrontContactPhone.replace(/[^+0-9]/g, '')}`} className="af-mono text-xl font-semibold hover:text-[var(--af-accent)]">{carrier.storefrontContactPhone}</a></dd></div>}
          {carrier.storefrontContactEmail && <div><dt className="af-field-label">Email</dt><dd><a href={`mailto:${carrier.storefrontContactEmail}`} className="break-all font-semibold hover:text-[var(--af-accent)]">{carrier.storefrontContactEmail}</a></dd></div>}
          {carrier.storefrontServiceHours && <div><dt className="af-field-label">Hours</dt><dd className="text-sm">{carrier.storefrontServiceHours}</dd></div>}
        </dl> : <p className="af-display mt-3 text-3xl uppercase">Airport service desk</p>}
        <p className="af-mono mt-4 text-xs text-[var(--af-ink-3)]">{carrier?.legalName ?? ''}</p>
        <p className="af-title-line mt-6 text-sm font-medium"><span className="af-dot" data-tone="warn" />We never ask for your access code.</p>
      </section>
    </div>
  </PublicPageShell>
}
