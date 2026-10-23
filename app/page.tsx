import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { FlightShop } from '@/features/storefront/components/FlightShop'
import { StorefrontFrame } from '@/features/storefront/components/StorefrontChrome'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { carrierCalendarDate } from '@/features/storefront/lib/branding'
import { storefrontBrandPalette } from '@/features/storefront/lib/theme'
import { storefrontPageMetadata } from '@/features/storefront/lib/metadata'
import { getStorefrontNetwork } from '@/features/storefront/lib/network'

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
  // Same rule as every other storefront page: servicing works for any persisted carrier; selling also needs a
  // configured storefront (title, description and an approved brand colour) and direct sales.
  const configured = Boolean(carrier?.storefrontConfigured && storefrontBrandPalette(carrier.storefrontBrandColor))
  const initialDate = carrierCalendarDate(new Date(Date.now() + 14 * 86_400_000), carrier?.defaultTimezone ?? 'UTC')

  return <StorefrontFrame carrier={carrier} current="/">
    <section className="af-board">
      <div className="af-container pb-32 pt-14 sm:pb-36 sm:pt-20">
        <p className="af-eyebrow">{carrier ? <><span className="af-signal">{carrier.code}</span> · </> : null}Book a flight</p>
        <h1 className="af-display mt-4 max-w-4xl text-6xl uppercase sm:text-8xl">{configured ? carrier!.storefrontHomepageTitle : carrier ? carrier.name : 'Flights'}</h1>
        {configured && <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--af-board-ink-2)]">{carrier!.storefrontHomepageDescription}</p>}
      </div>
    </section>
    <section aria-label="Book a flight" className="af-container -mt-24 pb-16">
      {configured && carrier!.salesEnabled ? <FlightShop initialDate={initialDate} carrier={carrier!} network={await getStorefrontNetwork(carrier!.id)} />
        : <div className="af-card relative z-10 flex flex-col gap-4 p-5 shadow-[0_24px_48px_-24px_rgb(15_27_45/0.45)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p role="status" className="af-title-line font-semibold"><span className="af-dot" data-tone="warn" />{configured ? 'Online booking is temporarily unavailable.' : 'Online booking isn’t available yet.'}</p>
          {!configured && <div className="af-track w-fit"><Link href="/dashboard" className="af-pill af-pill-raised af-pill-sm">Operator sign in</Link></div>}
        </div>}
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
