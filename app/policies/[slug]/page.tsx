import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PublicPageShell } from '@/features/storefront/components/PublicPageShell'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { storefrontPageMetadata } from '@/features/storefront/lib/metadata'
import { policies, type PolicySlug } from '@/features/storefront/lib/policies'

export const dynamic = 'force-dynamic'
function policyFor(slug: string) {
  return Object.prototype.hasOwnProperty.call(policies, slug) ? policies[slug as PolicySlug] : null
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return storefrontPageMetadata(policyFor((await params).slug)?.title ?? 'Policy')
}
export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const policy = policyFor((await params).slug)
  if (!policy) notFound()
  const carrier = await getStorefrontCarrierIdentity()
  return <PublicPageShell carrier={carrier} current="/help" eyebrow="Avante Air LLC" title={policy.title}>
    <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <article className="af-card grid min-w-0 gap-7 p-5 sm:p-8">
        {policy.sections.map(([title, body]) => <section key={title}><h2 className="text-xl font-semibold">{title}</h2><p className="mt-2 text-base leading-7 text-[var(--af-ink-2)]">{body}</p></section>)}
        <p className="text-sm text-[var(--af-ink-3)]">Published November 22, 2026. Your accepted booking receipt and applicable passenger rights remain part of your terms.</p>
      </article>
      <nav aria-label="Travel policies" className="grid content-start gap-3">{Object.entries(policies).map(([slug, item]) => <Link key={slug} href={`/policies/${slug}`} className="min-h-11 font-medium underline underline-offset-4">{item.title}</Link>)}<Link href="/contact" className="min-h-11 font-medium underline underline-offset-4">Contact the airline</Link></nav>
    </div>
  </PublicPageShell>
}
