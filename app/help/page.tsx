import Link from 'next/link'

import { PublicPageShell } from '@/features/storefront/components/PublicPageShell'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { storefrontPageMetadata } from '@/features/storefront/lib/metadata'

const services = [
  { href: '/status', title: 'Check flight status', detail: 'Enter your flight number and date to see the latest schedule and any delay or disruption.' },
  { href: '/manage-booking', title: 'Manage a booking', detail: 'Use the booking reference and access code from your confirmation to view or change your trip.' },
  { href: '/check-in', title: 'Check in', detail: 'Check in once your ticket is issued, choose a seat, and get your boarding pass.' },
] as const

// The root layout is static, so each storefront page renders per request and sets its own carrier title.
export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return storefrontPageMetadata('Help')
}

export default async function HelpPage() {
  const carrier = await getStorefrontCarrierIdentity()
  return <PublicPageShell carrier={carrier} eyebrow="Help" title="How can we help?" description="Manage your trip online with the options below. If something isn&apos;t available for your booking, we&apos;ll tell you why.">
    <div className="grid gap-4 md:grid-cols-3">{services.map(service => <Link key={service.href} href={service.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-[var(--storefront-brand)]"><h2 className="font-semibold">{service.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{service.detail}</p></Link>)}</div>
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"><p className="font-semibold">Need more help?</p><p className="mt-1">See how to contact the airline.</p><Link href="/contact" className="mt-3 inline-flex font-medium underline">View contact availability</Link></div>
  </PublicPageShell>
}
