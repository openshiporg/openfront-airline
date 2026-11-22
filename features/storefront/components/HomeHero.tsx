import type { ReactNode } from 'react'

import { WingMark } from './StorefrontChrome'

// The home hero: the cabin wall in the carrier colour, a window with the hub city in it and the seat edge with
// the wing on its headrest. `lead` is the headline block; the children are the search widget (or the notice shown
// while sales are closed).
// `compact` (phones only) folds the hero to the `summary` line once the traveler has results or a booking.
export function HomeHero({ lead, windowImage, compact, summary, children }: { lead: ReactNode; windowImage?: string | null; compact?: boolean; summary?: ReactNode; children: ReactNode }) {
  return <section className="af-hero" id="book" data-compact={compact ? 'true' : undefined}>
    <div aria-hidden="true" className="af-window" style={windowImage ? { backgroundImage: `url(${windowImage})` } : undefined} />
    <div aria-hidden="true" className="af-seat-edge"><WingMark className="af-seat-wing" /></div>
    <div className="af-container af-hero-inner">
      <div className="af-lead lg:pl-12">{lead}</div>
      {summary}
      <div className="af-widget">{children}</div>
    </div>
  </section>
}
