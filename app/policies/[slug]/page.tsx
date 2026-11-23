import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PublicPageShell } from '@/features/storefront/components/PublicPageShell'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { carrierContact } from '@/features/storefront/lib/contact'
import { storefrontPageMetadata } from '@/features/storefront/lib/metadata'
import { policies, type PolicySlug } from '@/features/storefront/lib/policies'

export const dynamic = 'force-dynamic'
function policyFor(slug: string) {
  return Object.prototype.hasOwnProperty.call(policies, slug) ? slug as PolicySlug : null
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const slug = policyFor((await params).slug)
  return storefrontPageMetadata(slug ? policies[slug].title : 'Policy')
}
export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = policyFor((await params).slug)
  if (!slug) notFound()
  const policy = policies[slug]
  const carrier = await getStorefrontCarrierIdentity()
  const sections = policy.sections({ airline: carrier?.name ?? 'The airline', operator: carrier?.legalName || carrier?.name || 'The airline', email: carrierContact(carrier).email })
  return <PublicPageShell carrier={carrier} current="/help" eyebrow="Travel policies" title={policy.title}>
    <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <article className="af-card grid min-w-0 gap-7 p-5 sm:p-8">
        {sections.map(([title, body]) => <section key={title}><h2 className="af-card-title">{title}</h2><p className="mt-2 text-base leading-7 text-[var(--af-ink-2)]">{body}</p></section>)}
        <p className="text-sm text-[var(--af-ink-3)]">Published November 22, 2026. Your accepted booking receipt and applicable passenger rights remain part of your terms.</p>
      </article>
      <nav aria-label="Travel policies" className="af-side-nav">
        {Object.entries(policies).map(([key, item]) => <Link key={key} href={`/policies/${key}`} aria-current={key === slug ? 'page' : undefined}>{item.title}</Link>)}
        <Link href="/contact">Contact the airline</Link>
      </nav>
    </div>
  </PublicPageShell>
}
