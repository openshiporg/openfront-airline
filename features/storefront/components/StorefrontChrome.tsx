import Link from 'next/link'
import { Plane } from 'lucide-react'

import type { PublicCarrierIdentity } from '@/features/storefront/lib/carrier'
import { publicNavigation } from '@/features/storefront/lib/public-navigation'

export function StorefrontLogo({ carrier }: { carrier: PublicCarrierIdentity }) {
  return <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--storefront-brand)] text-white"><Plane className="h-4 w-4" aria-hidden="true" /></span>{carrier.name}</Link>
}

export function StorefrontNavigation({ carrier, includeHome = true }: { carrier: PublicCarrierIdentity; includeHome?: boolean }) {
  return <nav aria-label="Passenger services" className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
    <StorefrontLogo carrier={carrier} />
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">{publicNavigation.filter(item => includeHome || item.href !== '/').map(item => <Link key={item.href} href={item.href} className="font-medium hover:text-[var(--storefront-brand)]">{item.label}</Link>)}</div>
  </nav>
}

export function StorefrontFooter({ carrier }: { carrier: PublicCarrierIdentity }) {
  return <footer className="border-t border-slate-200"><div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-slate-500 sm:flex-row sm:justify-between lg:px-10"><span>{carrier.legalName}</span></div></footer>
}

export function UnconfiguredStorefront() {
  return <main className="min-h-screen bg-slate-50 text-slate-950"><section className="mx-auto max-w-3xl px-6 py-20"><div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8"><p className="text-sm font-medium text-slate-500">Flights</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Online booking isn&apos;t available yet</h1><p className="mt-3 max-w-xl leading-7 text-slate-600">This airline&apos;s booking site is still being set up. Please check back soon.</p><Link href="/" className="mt-6 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium">Try again</Link></div></section></main>
}
