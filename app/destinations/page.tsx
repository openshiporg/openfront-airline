import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { PublicPageShell } from '@/features/storefront/components/PublicPageShell'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { storefrontPageMetadata } from '@/features/storefront/lib/metadata'
import { getStorefrontNetwork, routeDatesKey } from '@/features/storefront/lib/network'

// The root layout is static, so each storefront page renders per request and sets its own carrier title.
export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return storefrontPageMetadata('Destinations')
}

export default async function DestinationsPage() {
  const carrier = await getStorefrontCarrierIdentity()
  const network = carrier ? await getStorefrontNetwork(carrier.id) : { airports: [], routes: [], serviceDates: {} as Record<string, string[]> }
  const city = (code: string) => network.airports.find(airport => airport.code === code)?.city || code
  const origins = [...new Set(network.routes.map(route => route.origin))].sort((left, right) => city(left).localeCompare(city(right)))
  const dateLabel = (date: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00.000Z`))
  return <PublicPageShell carrier={carrier} current="/destinations" eyebrow="Where we fly" title="Destinations">
    {origins.length ? <div className="relative z-10 space-y-4">
      {origins.map(origin => <section key={origin} aria-label={`From ${city(origin)}`} className="af-card overflow-hidden shadow-[0_24px_48px_-24px_rgb(15_27_45/0.35)]">
        <h2 className="af-board flex items-baseline gap-3 px-5 py-4 sm:px-6"><span className="af-board-cell af-signal text-lg font-semibold">{origin}</span><span className="af-display text-2xl uppercase">From {city(origin)}</span></h2>
        <ul className="divide-y divide-[var(--af-line)]">{network.routes.filter(route => route.origin === origin).map(route => {
          const next = network.serviceDates[routeDatesKey(route.origin, route.destination)]?.[0]
          const query = new URLSearchParams({ from: route.origin, to: route.destination, ...(next ? { date: next } : {}) })
          return <li key={`${route.origin}-${route.destination}`}><Link href={`/?${query.toString()}`} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--af-paper)] sm:px-6">
            <span className="af-mono w-12 shrink-0 text-sm font-semibold tracking-[0.12em] text-[var(--af-accent)]">{route.destination}</span>
            <span className="min-w-0 flex-1"><span className="af-display block text-2xl uppercase">{city(route.destination)}</span><span className="af-mono block text-xs uppercase tracking-[0.1em] text-[var(--af-ink-3)]">{next ? `Next flight ${dateLabel(next)}` : 'No flights on sale'}</span></span>
            <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-[var(--af-ink-3)] transition-transform group-hover:translate-x-0.5" />
          </Link></li>
        })}</ul>
      </section>)}
    </div> : <p role="status" className="af-notice relative z-10 shadow-lg" data-tone="warn"><span className="af-dot" data-tone="warn" />No destinations on sale yet.</p>}
  </PublicPageShell>
}
