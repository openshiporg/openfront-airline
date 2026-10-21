import type { CSSProperties } from 'react'
import { ShieldCheck, Workflow } from 'lucide-react'

import { FlightShop } from '@/features/storefront/components/FlightShop'
import { StorefrontFooter, StorefrontNavigation, UnconfiguredStorefront } from '@/features/storefront/components/StorefrontChrome'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { carrierCalendarDate } from '@/features/storefront/lib/branding'
import { storefrontBrandPalette } from '@/features/storefront/lib/theme'
import { storefrontPageMetadata } from '@/features/storefront/lib/metadata'

// The root layout is static, so each storefront page renders per request and sets its own carrier title.
export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return storefrontPageMetadata()
}

export default async function Home() {
  const carrier = await getStorefrontCarrierIdentity()
  if (!carrier?.storefrontConfigured) return <UnconfiguredStorefront />
  const palette = storefrontBrandPalette(carrier.storefrontBrandColor)
  if (!palette) return <UnconfiguredStorefront />
  const initialDate = carrierCalendarDate(new Date(Date.now() + 14 * 86_400_000), carrier.defaultTimezone)
  const style = { '--storefront-brand': palette.hex, '--storefront-brand-hover': palette.hover, '--storefront-brand-soft': palette.soft } as CSSProperties

  return <main style={style} className="min-h-screen bg-slate-50 text-slate-950">
    <section className="mx-auto max-w-6xl px-5 py-6 sm:px-6 lg:px-10">
      <StorefrontNavigation carrier={carrier} includeHome={false} />
      <div className="grid gap-10 py-14 lg:grid-cols-[1.1fr_.9fr] lg:items-end lg:py-20"><div><p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--storefront-brand)]">Passenger services</p><h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.05em] sm:text-6xl">{carrier.storefrontHomepageTitle}</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">{carrier.storefrontHomepageDescription}</p></div><div className="rounded-3xl bg-slate-950 p-6 text-white shadow-2xl shadow-slate-300"><div className="space-y-5"><div className="flex gap-3"><Workflow className="mt-1 h-5 w-5 text-[var(--storefront-brand-soft)]" /><div><p className="font-medium">Manage your trip online</p><p className="mt-1 text-sm leading-6 text-slate-300">Book, check your flight status, choose your seat, and check in from one place.</p></div></div><div className="flex gap-3"><ShieldCheck className="mt-1 h-5 w-5 text-emerald-400" /><div><p className="font-medium">Your fare is held while you book</p><p className="mt-1 text-sm leading-6 text-slate-300">Seats and price are reserved for you while you enter traveler details.</p></div></div></div></div></div>
      <section aria-labelledby="book-flight" className="pb-16"><div className="mb-5"><p className="text-sm font-medium text-[var(--storefront-brand)]">Book a flight</p><h2 id="book-flight" className="text-2xl font-semibold tracking-tight">Find a flight</h2></div>{carrier.salesEnabled ? <FlightShop initialDate={initialDate} carrier={carrier} /> : <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">Online booking is temporarily unavailable. You can still check flight status or manage an existing booking.</p>}</section>
    </section>
    <StorefrontFooter carrier={carrier} />
  </main>
}
