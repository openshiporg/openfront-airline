import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { FlightShop } from '@/features/storefront/components/FlightShop'
import { StorefrontFrame } from '@/features/storefront/components/StorefrontChrome'
import { Timetable } from '@/features/storefront/components/Timetable'
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
  { href: '/status', label: 'Flight status', needs: 'Flight number and date' },
  { href: '/check-in', label: 'Check in', needs: 'Booking reference and access code' },
  { href: '/manage-booking', label: 'Manage booking', needs: 'Booking reference and access code' },
] as const

// Cover plate: Unsplash photo 1500835556837-99ac94a94552 (Unsplash License), printed in one ink by CSS.
const COVER_PLATE = 'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=900&q=70&auto=format&fit=crop'

export default async function Home() {
  const carrier = await getStorefrontCarrierIdentity()
  // Same rule as every other storefront page: servicing works for any persisted carrier; selling also needs a
  // configured storefront (title, description and an approved brand colour) and direct sales.
  const configured = Boolean(carrier?.storefrontConfigured && storefrontBrandPalette(carrier.storefrontBrandColor))
  const initialDate = carrierCalendarDate(new Date(Date.now() + 14 * 86_400_000), carrier?.defaultTimezone ?? 'UTC')
  const network = carrier ? await getStorefrontNetwork(carrier.id) : null
  const selling = Boolean(configured && carrier!.salesEnabled)

  return <StorefrontFrame carrier={carrier} current="/">
    <section className="af-board" id="book">
      <div className="af-container grid gap-8 pb-10 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-10">
        <div className="min-w-0">
          <h1 className="af-display max-w-4xl text-6xl uppercase sm:text-8xl">{configured ? carrier!.storefrontHomepageTitle : carrier ? carrier.name : 'Flights'}</h1>
          {configured && <p className="mt-4 max-w-2xl text-lg leading-7 text-[var(--af-board-ink-2)]">{carrier!.storefrontHomepageDescription}</p>}
          <div className="mt-8">
            {selling ? <FlightShop initialDate={initialDate} carrier={carrier!} network={network!} />
              : <div className="af-card flex flex-col gap-4 p-5 text-[var(--af-ink)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <p role="status" className="af-title-line font-semibold"><span className="af-dot" data-tone="warn" />{configured ? 'Online booking is temporarily unavailable.' : 'Online booking isn’t available yet.'}</p>
                {!configured && <Link href="/dashboard" className="af-pill af-pill-sm w-fit">Operator sign in</Link>}
              </div>}
          </div>
        </div>
        <figure aria-hidden="true" className="af-plate hidden rounded-[3px] lg:block"><img src={COVER_PLATE} alt="" loading="eager" decoding="async" /></figure>
      </div>
      <nav aria-label="Passenger services" className="border-t border-[var(--af-board-line)]">
        <ul className="af-container grid sm:grid-cols-3 sm:divide-x sm:divide-[var(--af-board-line)]">
          {services.map(service => <li key={service.href} className="border-b border-[var(--af-board-line)] last:border-b-0 sm:border-b-0"><Link href={service.href} className="group flex items-center justify-between gap-4 py-4 sm:px-5 sm:first:pl-0">
            <span><span className="af-display block text-3xl uppercase">{service.label}</span><span className="block text-sm text-[var(--af-board-ink-2)]">{service.needs}</span></span>
            <ChevronRight aria-hidden="true" className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </Link></li>)}
        </ul>
      </nav>
    </section>
    {carrier && network && network.routes.length > 0 && <section aria-labelledby="timetable-heading" className="af-container py-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h2 id="timetable-heading" className="af-display text-5xl uppercase">Timetable</h2>
        <p className="text-sm text-[var(--af-ink-3)]">Local times · next flight on sale per route</p>
      </div>
      <Timetable network={network} carrierCode={carrier.code} />
    </section>}
  </StorefrontFrame>
}
