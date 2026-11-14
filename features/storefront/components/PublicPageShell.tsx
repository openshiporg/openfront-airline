import type { PublicCarrierIdentity } from '@/features/storefront/lib/carrier'
import { StorefrontFrame, type StorefrontRoute } from './StorefrontChrome'

// Inside pages: a head on the deep cabin ground (tracked label, light title), then the work on warm white.
export function PublicPageShell({
  carrier,
  eyebrow,
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
    <section className="af-board border-t border-[var(--af-board-line)]">
      <div className="af-container pb-9 pt-8 sm:pb-12 sm:pt-11">
        {eyebrow && <p className="af-kicker text-white/85">{eyebrow}</p>}
        <h1 className={`af-display text-4xl sm:text-6xl ${eyebrow ? 'mt-3' : ''}`}>{title}</h1>
      </div>
    </section>
    <div className="af-container py-8 pb-20 sm:py-10 sm:pb-24">{children}</div>
  </StorefrontFrame>
}
