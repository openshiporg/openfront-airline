import '@/features/storefront/styles/airline.css'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'

import type { PublicCarrierIdentity } from '@/features/storefront/lib/carrier'
import { storefrontFontVariables } from '@/features/storefront/lib/fonts'
import { publicNavigation } from '@/features/storefront/lib/public-navigation'
import { storefrontBrandPalette } from '@/features/storefront/lib/theme'

export type StorefrontRoute = (typeof publicNavigation)[number]['href']

// Untitled UI logo registry mark "45 Degrees", drawn in the carrier's brand colour.
export function CarrierMark({ className }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 48" fill="none" className={className}><path d="m0 15.8981h17.3455l-17.061314 17.0613 2.756374 2.7564 17.06134-17.0613v17.3455h.1104l3.7877-3.7877v-15.9638l-4.2485-4.2485h-15.96596l-3.78553995 3.7855z" fill="currentColor" /></svg>
}

export function StorefrontLogo({ carrier }: { carrier: Pick<PublicCarrierIdentity, 'name' | 'code'> }) {
  return <Link href="/" className="inline-flex min-h-11 min-w-0 items-center gap-2.5">
    <span className="grid size-9 shrink-0 place-items-center rounded-[0.7rem] bg-[var(--af-accent)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(15_27_45/0.25)]"><CarrierMark className="h-6 w-auto" /></span>
    <span className="af-display truncate text-[1.6rem] uppercase">{carrier.name}</span>
    <span className="af-mono hidden rounded-md bg-[var(--af-paper-2)] px-1.5 py-0.5 text-[0.6875rem] font-semibold text-[var(--af-ink-2)] sm:inline">{carrier.code}</span>
  </Link>
}

function StorefrontHeader({ carrier, current }: { carrier: PublicCarrierIdentity; current?: StorefrontRoute }) {
  return <header className="sticky top-0 z-30 border-b border-[var(--af-line)] bg-[color-mix(in_srgb,var(--af-paper)_88%,transparent)] backdrop-blur-md">
    <div className="af-container flex h-16 items-center justify-between gap-4">
      <StorefrontLogo carrier={carrier} />
      <nav aria-label="Passenger services" className="hidden lg:block">
        <div className="af-track">{publicNavigation.map(item => <Link key={item.href} href={item.href} aria-current={item.href === current ? 'page' : undefined} className="af-pill af-pill-sm">{item.label}</Link>)}</div>
      </nav>
      <details className="group relative lg:hidden">
        <summary className="af-track cursor-pointer list-none [&::-webkit-details-marker]:hidden"><span className="af-pill af-pill-raised af-pill-sm"><Menu aria-hidden="true" />Menu</span></summary>
        <nav aria-label="Passenger services" className="af-card absolute right-0 top-[calc(100%+0.5rem)] z-40 grid w-[min(18rem,calc(100vw-2rem))] gap-1 p-2 shadow-xl">
          {publicNavigation.map(item => <Link key={item.href} href={item.href} aria-current={item.href === current ? 'page' : undefined} className="flex min-h-11 items-center rounded-lg px-3 text-[0.9375rem] font-semibold hover:bg-[var(--af-paper-2)] aria-[current=page]:bg-[var(--af-paper-2)]">{item.label}</Link>)}
        </nav>
      </details>
    </div>
  </header>
}

export function StorefrontFooter({ carrier }: { carrier: PublicCarrierIdentity }) {
  return <footer className="af-board mt-auto">
    <div className="af-container grid gap-8 py-10 sm:grid-cols-[1fr_auto]">
      <div>
        <div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-lg bg-[var(--af-accent)] text-white"><CarrierMark className="h-5 w-auto" /></span><span className="af-display text-2xl uppercase">{carrier.name}</span></div>
        <p className="af-mono mt-3 text-xs text-[var(--af-board-ink-2)]">{carrier.legalName} · {carrier.code}</p>
      </div>
      <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">{publicNavigation.map(item => <Link key={item.href} href={item.href} className="text-[var(--af-board-ink-2)] hover:text-white">{item.label}</Link>)}</nav>
    </div>
  </footer>
}

export function brandStyle(carrier: PublicCarrierIdentity | null, requireConfigured = true) {
  const palette = storefrontBrandPalette(carrier && (!requireConfigured || carrier.storefrontConfigured) ? carrier.storefrontBrandColor : null) ?? storefrontBrandPalette('slate')!
  return { '--storefront-brand': palette.hex, '--storefront-brand-hover': palette.hover, '--storefront-brand-soft': palette.soft } as CSSProperties
}

export function StorefrontFrame({ carrier, current, children }: { carrier: PublicCarrierIdentity; current?: StorefrontRoute; children: React.ReactNode }) {
  // Servicing pages (status, manage, check-in, help) don't depend on marketing branding; without a configured
  // theme they use the neutral palette. New sales stay closed on the server until branding is complete.
  return <div style={brandStyle(carrier, false)} className={`af ${storefrontFontVariables}`}>
    <StorefrontHeader carrier={carrier} current={current} />
    <main className="flex-1">{children}</main>
    <StorefrontFooter carrier={carrier} />
  </div>
}

export function UnconfiguredStorefront() {
  return <div style={brandStyle(null)} className={`af ${storefrontFontVariables}`}>
    <main className="af-board flex flex-1 items-center">
      <section className="af-container py-24">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white/10 text-white"><CarrierMark className="h-6 w-auto" /></span><span className="af-eyebrow">Flights</span></div>
        <h1 className="af-display mt-8 max-w-3xl text-5xl uppercase sm:text-7xl">Online booking isn&apos;t available yet</h1>
        <div className="mt-10 af-track"><Link href="/" className="af-pill af-pill-raised">Try again</Link></div>
      </section>
    </main>
  </div>
}
