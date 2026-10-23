import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { FlightShop } from '@/features/storefront/components/FlightShop'
import { StorefrontFrame, UnconfiguredStorefront } from '@/features/storefront/components/StorefrontChrome'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { carrierCalendarDate } from '@/features/storefront/lib/branding'
import { storefrontBrandPalette } from '@/features/storefront/lib/theme'
import { storefrontPageMetadata } from '@/features/storefront/lib/metadata'

// The root layout is static, so each storefront page renders per request and sets its own carrier title.
export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return storefrontPageMetadata()
}

const services = [
  { href: '/status', code: 'STS', label: 'Flight status' },
  { href: '/check-in', code: 'CHK', label: 'Check in' },
  { href: '/manage-booking', code: 'MNG', label: 'Manage booking' },
] as const

export default async function Home() {
  const carrier = await getStorefrontCarrierIdentity()
  if (!carrier?.storefrontConfigured) return <UnconfiguredStorefront />
  if (!storefrontBrandPalette(carrier.storefrontBrandColor)) return <UnconfiguredStorefront />
  const initialDate = carrierCalendarDate(new Date(Date.now() + 14 * 86_400_000), carrier.defaultTimezone)

  return <StorefrontFrame carrier={carrier} current="/">
    <section className="af-board">
      <div className="af-container pb-32 pt-14 sm:pb-36 sm:pt-20">
        <p className="af-eyebrow"><span className="af-signal">{carrier.code}</span> · Book a flight</p>
        <h1 className="af-display mt-4 max-w-4xl text-6xl uppercase sm:text-8xl">{carrier.storefrontHomepageTitle}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--af-board-ink-2)]">{carrier.storefrontHomepageDescription}</p>
      </div>
    </section>
    <section aria-label="Book a flight" className="af-container -mt-24 pb-16">
      {carrier.salesEnabled ? <FlightShop initialDate={initialDate} carrier={carrier} /> : <p role="status" className="af-notice relative z-10 shadow-lg" data-tone="warn"><span className="af-dot" data-tone="warn" />Online booking is temporarily unavailable.</p>}
    </section>
    <section aria-label="Passenger services" className="af-container pb-20">
      <div className="grid gap-px overflow-hidden rounded-2xl border border-[var(--af-line)] bg-[var(--af-line)] sm:grid-cols-3">
        {services.map(service => <Link key={service.href} href={service.href} className="group flex items-end justify-between gap-4 bg-[var(--af-card)] p-6 transition-colors hover:bg-[var(--af-paper)]">
          <div><p className="af-mono text-xs font-semibold tracking-[0.2em] text-[var(--af-accent)]">{service.code}</p><p className="af-display mt-6 text-3xl uppercase">{service.label}</p></div>
          <ChevronRight aria-hidden="true" className="size-5 text-[var(--af-ink-3)] transition-transform group-hover:translate-x-0.5" />
        </Link>)}
      </div>
    </section>
  </StorefrontFrame>
}
