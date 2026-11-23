import type { ReactNode } from 'react'

// The home hero: a jet above the clouds at dusk, full bleed, with a dark wash on the text side so the headline stays
// legible. `lead` is the headline block; the children are the search widget (or the notice shown while sales are
// closed). `compact` (phones only) folds the hero to the `summary` line once the traveler has results or a booking.
export function HomeHero({ lead, compact, summary, children }: { lead: ReactNode; compact?: boolean; summary?: ReactNode; children: ReactNode }) {
  return <section className="af-hero" id="book" data-compact={compact ? 'true' : undefined}>
    <div aria-hidden="true" className="af-hero-photo" />
    <div className="af-container af-hero-inner">
      <div className="af-lead">{lead}</div>
      {summary}
      <div className="af-widget">{children}</div>
    </div>
  </section>
}
