import '@/features/storefront/styles/timetable.css'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'

import type { PublicCarrierIdentity } from '@/features/storefront/lib/carrier'
import { storefrontFontVariables } from '@/features/storefront/lib/fonts'
import { publicNavigation } from '@/features/storefront/lib/public-navigation'
import { storefrontBrandPalette } from '@/features/storefront/lib/theme'
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from '@/features/platform/store-settings/lib/store-logo'

export type StorefrontRoute = (typeof publicNavigation)[number]['href']

// The carrier's saved logo icon, always shown beside its name with the saved hue. An empty icon renders the default icon.
type CarrierLogo = { logoIcon?: string | null; logoColor?: string | null }

export function CarrierMark({ carrier, className }: { carrier: CarrierLogo; className?: string }) {
  return <span aria-hidden="true" data-testid="carrier-logo" style={{ filter: `hue-rotate(${normalizeStoreLogoColor(carrier.logoColor)}deg)` }} className={`${className ?? ''} [&>svg]:block [&>svg]:h-full [&>svg]:w-full`} dangerouslySetInnerHTML={{ __html: carrier.logoIcon?.trim() || DEFAULT_STORE_LOGO_ICON }} />
}

// Shown before any carrier exists, so the storefront always has a working header and footer.
const NEUTRAL_IDENTITY = { name: 'Flights', code: '', legalName: '' }

export function StorefrontLogo({ carrier }: { carrier: Pick<PublicCarrierIdentity, 'name' | 'code' | 'logoIcon' | 'logoColor'> }) {
  return <Link href="/" className="inline-flex min-h-11 min-w-0 items-center gap-2.5">
    <CarrierMark carrier={carrier} className="block h-9 w-8 shrink-0" />
    <span className="af-display truncate text-[1.75rem] uppercase">{carrier.name}</span>
    {carrier.code && <span className="hidden h-6 items-center rounded-[2px] border border-[var(--af-line-2)] px-1.5 text-xs font-bold tracking-[0.06em] text-[var(--af-ink-2)] sm:inline-flex">{carrier.code}</span>}
  </Link>
}

function StorefrontHeader({ carrier, current }: { carrier: Pick<PublicCarrierIdentity, 'name' | 'code' | 'logoIcon' | 'logoColor'>; current?: StorefrontRoute }) {
  return <header className="sticky top-0 z-30 border-b border-[var(--af-line)] bg-[var(--af-card)]">
    <div className="af-container flex h-16 items-center justify-between gap-4">
      <StorefrontLogo carrier={carrier} />
      <nav aria-label="Passenger services" className="hidden h-full lg:block">
        <ul className="flex h-full items-stretch">{publicNavigation.map(item => <li key={item.href} className="flex"><Link href={item.href} aria-current={item.href === current ? 'page' : undefined} className="flex items-center border-b-2 border-transparent px-3 text-[0.9375rem] font-semibold text-[var(--af-ink-2)] transition-colors hover:text-[var(--af-ink)] aria-[current=page]:border-[var(--af-accent)] aria-[current=page]:text-[var(--af-ink)]">{item.label}</Link></li>)}</ul>
      </nav>
      <details className="group relative lg:hidden">
        <summary className="af-pill af-pill-sm af-menu-toggle cursor-pointer list-none [&::-webkit-details-marker]:hidden"><Menu aria-hidden="true" />Menu</summary>
        <nav aria-label="Passenger services" className="af-card absolute right-0 top-[calc(100%+0.5rem)] z-40 grid w-[min(18rem,calc(100vw-2rem))] divide-y divide-[var(--af-line)] p-0">
          {publicNavigation.map(item => <Link key={item.href} href={item.href} aria-current={item.href === current ? 'page' : undefined} className="flex min-h-12 items-center px-4 text-[0.9375rem] font-semibold hover:bg-[var(--af-paper)] aria-[current=page]:text-[var(--af-accent)] aria-[current=page]:shadow-[inset_3px_0_0_var(--af-accent)]">{item.label}</Link>)}
        </nav>
      </details>
    </div>
  </header>
}

export function StorefrontFooter({ carrier }: { carrier: Pick<PublicCarrierIdentity, 'name' | 'code' | 'legalName' | 'logoIcon' | 'logoColor'> }) {
  return <footer className="af-board mt-auto">
    <div className="af-container grid gap-8 py-10 sm:grid-cols-[1fr_auto]">
      <div>
        <div className="flex items-center gap-2.5"><CarrierMark carrier={carrier} className="block h-8 w-7 shrink-0" /><span className="af-display text-3xl uppercase">{carrier.name}</span></div>
        {carrier.code && <p className="mt-3 text-sm text-[var(--af-board-ink-2)]">{carrier.legalName} · {carrier.code}</p>}
      </div>
      <nav aria-label="Footer" className="af-footer-nav grid grid-cols-2 gap-x-10 text-[0.9375rem]">{publicNavigation.map(item => <Link key={item.href} href={item.href} className="text-[var(--af-board-ink-2)] underline-offset-4 hover:text-white hover:underline">{item.label}</Link>)}</nav>
    </div>
  </footer>
}

export function brandStyle(carrier: PublicCarrierIdentity | null) {
  const palette = storefrontBrandPalette(carrier?.storefrontConfigured ? carrier.storefrontBrandColor : null) ?? storefrontBrandPalette('slate')!
  return { '--storefront-brand': palette.hex, '--storefront-brand-hover': palette.hover, '--storefront-brand-soft': palette.soft } as CSSProperties
}

// Every storefront page renders inside this frame. Without a configured theme (or without a carrier at all) the
// neutral palette is used; new sales stay closed on the server until branding is complete.
export function StorefrontFrame({ carrier, current, children }: { carrier: PublicCarrierIdentity | null; current?: StorefrontRoute; children: React.ReactNode }) {
  const identity = carrier ?? NEUTRAL_IDENTITY
  return <div style={brandStyle(carrier)} className={`af ${storefrontFontVariables}`}>
    <StorefrontHeader carrier={identity} current={current} />
    <main className="flex-1">{children}</main>
    <StorefrontFooter carrier={identity} />
  </div>
}
