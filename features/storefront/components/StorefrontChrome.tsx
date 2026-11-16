import '@/features/storefront/styles/stride.css'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { Menu, UserRound } from 'lucide-react'

import type { PublicCarrierIdentity } from '@/features/storefront/lib/carrier'
import { storefrontFontVariables } from '@/features/storefront/lib/fonts'
import { publicNavigation } from '@/features/storefront/lib/public-navigation'
import { storefrontBrandPalette } from '@/features/storefront/lib/theme'
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from '@/features/platform/store-settings/lib/store-logo'

export type StorefrontRoute = (typeof publicNavigation)[number]['href']

// The carrier's saved logo icon, shown beside its name with the saved hue.
type CarrierLogo = { logoIcon?: string | null; logoColor?: string | null }

// The storefront's own mark: a swept three-stroke wing in the sky accent.
export function WingMark({ className }: { className?: string }) {
  return <svg aria-hidden="true" data-testid="carrier-logo" viewBox="0 0 72 34" fill="none" className={className}>
    <path d="M21 12.5C39 12.5 56 8.5 71.5 0.5 61.5 11 47.5 17.5 31 18.5Z" style={{ fill: 'color-mix(in oklab, var(--af-sky) 82%, #fff)' }} />
    <path d="M10.5 19.5C28.5 20.5 44.5 17.5 58.5 11 49.5 20 36.5 25 21 25.5Z" style={{ fill: 'var(--af-sky)' }} />
    <path d="M0.5 27C16.5 29 31.5 27 45.5 21 37.5 29 25.5 33 11 33.5Z" style={{ fill: 'color-mix(in oklab, var(--af-sky) 78%, var(--af-accent))' }} />
  </svg>
}

// A carrier that chose its own logo icon in store settings keeps it; the platform's default icon gives way to the wing.
function hasOwnLogo(carrier: CarrierLogo) {
  const icon = carrier.logoIcon?.trim()
  return Boolean(icon && icon !== DEFAULT_STORE_LOGO_ICON.trim())
}

export function CarrierMark({ carrier, className, wingClassName }: { carrier: CarrierLogo; className?: string; wingClassName?: string }) {
  if (!hasOwnLogo(carrier)) return <WingMark className={wingClassName ?? className} />
  return <span aria-hidden="true" data-testid="carrier-logo" style={{ filter: `hue-rotate(${normalizeStoreLogoColor(carrier.logoColor)}deg)` }} className={`${className ?? ''} [&>svg]:block [&>svg]:h-full [&>svg]:w-full`} dangerouslySetInnerHTML={{ __html: carrier.logoIcon?.trim() || DEFAULT_STORE_LOGO_ICON }} />
}

// Shown before any carrier exists, so the storefront always has a working header and footer.
const NEUTRAL_IDENTITY = { name: 'Flights', code: '', legalName: '' }

// Trips live under the traveler mark on the right; everything else sits in the centre of the header.
const TRIPS_ROUTE = '/manage-booking'
// The header carries the four main services; the full list stays in the phone menu and the footer.
const centreNavigation = (carrierName: string) => [
  { href: '/', label: 'Book' },
  { href: TRIPS_ROUTE, label: 'Manage' },
  { href: '/status', label: 'Flight Status' },
  { href: '/#experience', label: `The ${carrierName.split(' ')[0]} Experience` },
] as const

export function StorefrontLogo({ carrier }: { carrier: Pick<PublicCarrierIdentity, 'name' | 'code' | 'logoIcon' | 'logoColor'> }) {
  return <Link href="/" className="inline-flex min-h-11 min-w-0 items-center gap-2 text-white">
    <CarrierMark carrier={carrier} className="block h-8 w-7 shrink-0 lg:h-9 lg:w-8" wingClassName="block h-6 w-[3.25rem] shrink-0 lg:h-8 lg:w-[4.25rem]" />
    <span className="af-wordmark truncate">{carrier.name}</span>
  </Link>
}

function StorefrontHeader({ carrier, current, overlay }: { carrier: Pick<PublicCarrierIdentity, 'name' | 'code' | 'logoIcon' | 'logoColor'>; current?: StorefrontRoute; overlay?: boolean }) {
  return <header className="af-header" data-overlay={overlay ? 'true' : undefined}>
    <div className="af-container flex h-16 items-center gap-3 xl:gap-6">
      <details className="group relative xl:hidden">
        <summary aria-label="Menu" className="af-menu-toggle list-none [&::-webkit-details-marker]:hidden"><Menu aria-hidden="true" className="size-6" /></summary>
        <nav aria-label="Passenger services" className="af-menu absolute left-0 top-[calc(100%+0.25rem)] z-40 grid w-[min(18rem,calc(100vw-2rem))] divide-y divide-[var(--af-line)]">
          {publicNavigation.map(item => <Link key={item.href} href={item.href} aria-current={item.href === current ? 'page' : undefined} className="flex min-h-12 items-center px-4 font-medium hover:bg-[var(--af-paper)] aria-[current=page]:font-semibold aria-[current=page]:shadow-[inset_3px_0_0_var(--af-accent)]">{item.label}</Link>)}
        </nav>
      </details>
      <StorefrontLogo carrier={carrier} />
      <nav aria-label="Passenger services" className="mx-auto hidden h-full xl:block">
        <ul className="flex h-full items-stretch gap-10">{centreNavigation(carrier.name).map(item => <li key={item.href} className="flex"><Link href={item.href} aria-current={item.href === current ? 'page' : undefined} className="af-nav-link">{item.label}</Link></li>)}</ul>
      </nav>
      <div className="ml-auto flex items-center gap-4 xl:ml-0 xl:gap-8">
        <span aria-hidden="true" className="h-6 w-px bg-white/50" />
        <Link href={TRIPS_ROUTE} aria-current={current === TRIPS_ROUTE ? 'page' : undefined} className="af-nav-link af-nav-trips min-h-11 gap-2.5 whitespace-nowrap text-sm xl:text-base"><UserRound aria-hidden="true" className="size-5 xl:size-6" strokeWidth={1.75} />My trips</Link>
      </div>
    </div>
  </header>
}

export function StorefrontFooter({ carrier }: { carrier: Pick<PublicCarrierIdentity, 'name' | 'code' | 'legalName' | 'logoIcon' | 'logoColor'> }) {
  return <footer className="af-footer">
    <svg aria-hidden="true" className="af-footer-wave" viewBox="0 0 1440 36" preserveAspectRatio="none"><path d="M0 36V16C320 2 1040 0 1440 26v10Z" style={{ fill: 'var(--af-deep)' }} /></svg>
    <div className="af-footer-body">
      <svg aria-hidden="true" className="af-footer-sweep" viewBox="0 0 560 100" preserveAspectRatio="none">
        <path d="M0 100C190 96 400 62 560 0v34C440 76 270 100 130 100Z" style={{ fill: 'var(--af-sky)' }} opacity="0.9" />
        <path d="M170 100C330 96 470 74 560 44v22C490 86 400 100 300 100Z" style={{ fill: 'var(--af-accent)' }} opacity="0.85" />
      </svg>
      <div className="af-container relative flex flex-col gap-3 pb-4 pt-2 lg:flex-row lg:items-center lg:gap-10">
        <div className="flex flex-wrap items-center gap-x-9 gap-y-2 lg:shrink-0">
          <div className="flex items-center gap-2.5"><CarrierMark carrier={carrier} className="block h-8 w-7 shrink-0" wingClassName="block h-7 w-[3.75rem] shrink-0" /><span className="af-wordmark">{carrier.name}</span></div>
          {carrier.legalName && <><span aria-hidden="true" className="hidden h-7 w-px bg-white/60 sm:block" /><p className="af-kicker text-xs text-white/85">{carrier.legalName}{carrier.code ? ` · ${carrier.code}` : ''}</p></>}
        </div>
        <nav aria-label="Footer" className="af-footer-nav flex flex-wrap gap-x-5 text-sm lg:ml-auto lg:mr-[min(13rem,15vw)] lg:justify-end xl:flex-nowrap xl:whitespace-nowrap">{publicNavigation.map(item => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>
      </div>
    </div>
  </footer>
}

export function brandStyle(carrier: PublicCarrierIdentity | null) {
  const palette = storefrontBrandPalette(carrier?.storefrontConfigured ? carrier.storefrontBrandColor : null) ?? storefrontBrandPalette('navy')!
  return { '--storefront-brand': palette.hex, '--storefront-brand-hover': palette.hover, '--storefront-brand-soft': palette.soft } as CSSProperties
}

// Every storefront page renders inside this frame. Without a configured theme (or without a carrier at all) the
// neutral palette is used; new sales stay closed on the server until branding is complete. `overlay` lays the
// header over the page's own hero (home).
export function StorefrontFrame({ carrier, current, overlay, children }: { carrier: PublicCarrierIdentity | null; current?: StorefrontRoute; overlay?: boolean; children: React.ReactNode }) {
  const identity = carrier ?? NEUTRAL_IDENTITY
  return <div style={brandStyle(carrier)} className={`af relative ${storefrontFontVariables}`}>
    <StorefrontHeader carrier={identity} current={current} overlay={overlay} />
    <main className="flex-1">{children}</main>
    <StorefrontFooter carrier={identity} />
  </div>
}
