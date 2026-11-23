import '@/features/storefront/styles/stride.css'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { UserRound } from 'lucide-react'

import type { PublicCarrierIdentity } from '@/features/storefront/lib/carrier'
import { storefrontFontFamily, storefrontFontVariables } from '@/features/storefront/lib/fonts'
import { publicNavigation } from '@/features/storefront/lib/public-navigation'
import { experienceTitle } from '@/features/storefront/lib/branding'
import { StorefrontMenu } from './StorefrontMenu'
import { storefrontBrandPalette } from '@/features/storefront/lib/theme'
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from '@/features/platform/store-settings/lib/store-logo'

export type StorefrontRoute = (typeof publicNavigation)[number]['href'] | '/account'

// The carrier's saved logo icon, shown beside its name with the saved hue.
type CarrierLogo = { logoIcon?: string | null; logoColor?: string | null }

// The storefront's own mark: a swept three-stroke wing in the sky accent.
export function WingMark({ className }: { className?: string }) {
  return <svg aria-hidden="true" data-testid="carrier-logo" viewBox="0 0 72 34" fill="none" className={className}>
    <path d="M21 12.5C39 12.5 56 8.5 71.5 0.5 61.5 11 47.5 17.5 31 18.5Z" style={{ fill: 'color-mix(in oklab, var(--af-sky) 82%, var(--af-white))' }} />
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

// The traveler's account (sign in, My trips) lives under the traveler mark on the right; everything else sits in the
// centre of the header.
const TRIPS_ROUTE = '/account'
// The header carries the four main services; the full list stays in the phone menu and the footer.
const centreNavigation = (carrierName: string) => [
  { href: '/', label: 'Book' },
  { href: '/manage-booking', label: 'Manage' },
  { href: '/status', label: 'Flight status' },
  { href: '/#experience', label: experienceTitle(carrierName) },
] as const

export function StorefrontLogo({ carrier }: { carrier: Pick<PublicCarrierIdentity, 'name' | 'code' | 'logoIcon' | 'logoColor'> }) {
  return <Link href="/" className="inline-flex min-h-11 min-w-0 items-center gap-2">
    <CarrierMark carrier={carrier} className="block h-8 w-7 shrink-0 lg:h-9 lg:w-8" wingClassName="af-wing" />
    <span className="af-wordmark truncate">{carrier.name}</span>
  </Link>
}

function StorefrontHeader({ carrier, current, overlay }: { carrier: Pick<PublicCarrierIdentity, 'name' | 'code' | 'logoIcon' | 'logoColor'>; current?: StorefrontRoute; overlay?: boolean }) {
  return <header className="af-header" data-overlay={overlay ? 'true' : undefined}>
    <div className="af-container flex h-16 items-center gap-3 xl:gap-6">
      <StorefrontMenu items={publicNavigation} current={current} tripsHref={TRIPS_ROUTE} />
      <StorefrontLogo carrier={carrier} />
      <nav aria-label="Passenger services" className="mx-auto hidden h-full xl:block">
        <ul className="flex h-full items-stretch gap-10">{centreNavigation(carrier.name).map(item => <li key={item.href} className="flex"><Link href={item.href} aria-current={item.href === current ? 'page' : undefined} className="af-nav-link">{item.label}</Link></li>)}</ul>
      </nav>
      <div className="ml-auto flex items-center gap-4 xl:ml-0 xl:gap-8">
        <span aria-hidden="true" className="af-rule-v" />
        <Link href={TRIPS_ROUTE} aria-current={current === TRIPS_ROUTE ? 'page' : undefined} className="af-nav-link af-nav-trips"><UserRound aria-hidden="true" strokeWidth={1.75} /><span className="af-nav-trips-label">My trips</span></Link>
      </div>
    </div>
  </header>
}

// Policies sit under the main links, beside the legal name, as on every airline's site.
const footerPolicies = [
  { href: '/policies/fares', label: 'Travel policies' },
  { href: '/policies/privacy', label: 'Privacy' },
] as const

export function StorefrontFooter({ carrier }: { carrier: Pick<PublicCarrierIdentity, 'name' | 'code' | 'legalName' | 'logoIcon' | 'logoColor'> }) {
  return <footer className="af-footer">
    <svg aria-hidden="true" className="af-footer-wave" viewBox="0 0 1440 36" preserveAspectRatio="none"><path d="M0 36V16C320 2 1040 0 1440 26v10Z" style={{ fill: 'var(--af-deep)' }} /></svg>
    <div className="af-footer-body">
      <svg aria-hidden="true" className="af-footer-sweep" viewBox="0 0 560 100" preserveAspectRatio="none">
        <path d="M0 100C190 96 400 62 560 0v34C440 76 270 100 130 100Z" style={{ fill: 'var(--af-sky)' }} opacity="0.9" />
        <path d="M170 100C330 96 470 74 560 44v22C490 86 400 100 300 100Z" style={{ fill: 'var(--af-accent)' }} opacity="0.85" />
      </svg>
      <div className="af-container relative flex flex-col gap-2 pt-2 lg:flex-row lg:items-center lg:gap-10">
        <div className="flex items-center gap-2 lg:shrink-0"><CarrierMark carrier={carrier} className="block h-8 w-7 shrink-0" wingClassName="af-wing" /><span className="af-wordmark">{carrier.name}</span></div>
        <nav aria-label="Footer" className="af-footer-nav flex flex-wrap gap-x-5 xl:flex-nowrap xl:whitespace-nowrap">{publicNavigation.map(item => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>
      </div>
      <div className="af-container relative flex flex-wrap items-center gap-x-5 pb-4">
        {carrier.legalName && <p className="af-footer-legal">{carrier.legalName}</p>}
        <nav aria-label="Policies" className="af-footer-nav af-footer-policies flex flex-wrap gap-x-5">{footerPolicies.map(item => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>
      </div>
    </div>
  </footer>
}

function brandPalette(carrier: PublicCarrierIdentity | null) {
  return storefrontBrandPalette(carrier?.storefrontConfigured ? carrier.storefrontBrandColor : null) ?? storefrontBrandPalette('navy')!
}

export function brandStyle(carrier: PublicCarrierIdentity | null) {
  const palette = brandPalette(carrier)
  return { '--storefront-brand': palette.hex, '--storefront-brand-hover': palette.hover, '--storefront-brand-soft': palette.soft } as CSSProperties
}

// Popovers (airports, dates, travelers) portal to <body>, outside the frame; this gives them the carrier colour and
// the storefront family. The values come from the fixed brand palette and next/font, never from free text.
function portalTheme(carrier: PublicCarrierIdentity | null) {
  const palette = brandPalette(carrier)
  return `body:has(.af){--storefront-brand:${palette.hex};--storefront-brand-hover:${palette.hover};--storefront-brand-soft:${palette.soft};--af-font-body:${storefrontFontFamily}}`
}

// Every storefront page renders inside this frame. Without a configured theme (or without a carrier at all) the
// neutral palette is used; new sales stay closed on the server until branding is complete. `overlay` lays the
// header over the page's own hero (home).
export function StorefrontFrame({ carrier, current, overlay, children }: { carrier: PublicCarrierIdentity | null; current?: StorefrontRoute; overlay?: boolean; children: React.ReactNode }) {
  const identity = carrier ?? NEUTRAL_IDENTITY
  return <div style={brandStyle(carrier)} className={`af relative ${storefrontFontVariables}`}>
    <style dangerouslySetInnerHTML={{ __html: portalTheme(carrier) }} />
    <StorefrontHeader carrier={identity} current={current} overlay={overlay} />
    <main className="flex-1">{children}</main>
    <StorefrontFooter carrier={identity} />
  </div>
}
