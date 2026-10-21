import type { CSSProperties } from 'react'

import type { PublicCarrierIdentity } from '@/features/storefront/lib/carrier'
import { storefrontBrandPalette } from '@/features/storefront/lib/theme'
import { StorefrontFooter, StorefrontNavigation, UnconfiguredStorefront } from './StorefrontChrome'

export function PublicPageShell({
  carrier,
  eyebrow,
  title,
  description,
  children,
}: {
  carrier: PublicCarrierIdentity | null
  eyebrow: string
  title: string
  description: string
  children: React.ReactNode
}) {
  if (!carrier) return <UnconfiguredStorefront />
  // Servicing an existing booking (status, manage, check-in, help) doesn't depend on marketing branding: without a
  // configured theme these pages use a neutral one. New sales stay closed on the server until branding is complete.
  const palette = storefrontBrandPalette(carrier.storefrontConfigured ? carrier.storefrontBrandColor : null) ?? storefrontBrandPalette('slate')!
  const style = { '--storefront-brand': palette.hex, '--storefront-brand-hover': palette.hover, '--storefront-brand-soft': palette.soft } as CSSProperties
  return <main style={style} className="min-h-screen bg-slate-50 text-slate-950">
    <section className="mx-auto max-w-6xl px-5 py-6 sm:px-6 lg:px-10">
      <StorefrontNavigation carrier={carrier} />
      <header className="max-w-3xl py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--storefront-brand)]">{eyebrow}</p><h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{title}</h1><p className="mt-4 text-lg leading-8 text-slate-600">{description}</p></header>
      <section className="pb-16">{children}</section>
    </section>
    <StorefrontFooter carrier={carrier} />
  </main>
}
