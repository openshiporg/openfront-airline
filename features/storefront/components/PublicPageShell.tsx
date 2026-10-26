import type { PublicCarrierIdentity } from '@/features/storefront/lib/carrier'
import { StorefrontFrame, type StorefrontRoute } from './StorefrontChrome'

// Inside pages: a cover band in the carrier colour with the page title, then the work on white stock.
// `eyebrow` is accepted for older callers and not rendered: the title carries the page.
export function PublicPageShell({
  carrier,
  title,
  current,
  children,
}: {
  carrier: PublicCarrierIdentity | null
  eyebrow?: string
  title: string
  current?: StorefrontRoute
  children: React.ReactNode
}) {
  return <StorefrontFrame carrier={carrier} current={current}>
    <section className="af-board">
      <div className="af-container pb-8 pt-10 sm:pb-10 sm:pt-14">
        <h1 className="af-display text-6xl uppercase sm:text-8xl">{title}</h1>
      </div>
    </section>
    <div className="af-container py-8 pb-20 sm:py-10">{children}</div>
  </StorefrontFrame>
}
