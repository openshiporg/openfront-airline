import type { PublicCarrierIdentity } from '@/features/storefront/lib/carrier'
import { StorefrontFrame, type StorefrontRoute } from './StorefrontChrome'

export function PublicPageShell({
  carrier,
  eyebrow,
  title,
  current,
  children,
}: {
  carrier: PublicCarrierIdentity | null
  eyebrow: string
  title: string
  current?: StorefrontRoute
  children: React.ReactNode
}) {
  return <StorefrontFrame carrier={carrier} current={current}>
    <section className="af-board">
      <div className="af-container pb-28 pt-12 sm:pb-32 sm:pt-16">
        <p className="af-eyebrow">{eyebrow}</p>
        <h1 className="af-display mt-3 text-5xl uppercase sm:text-7xl">{title}</h1>
      </div>
    </section>
    <div className="af-container -mt-20 pb-20 sm:-mt-24">{children}</div>
  </StorefrontFrame>
}
