import { Armchair, CalendarX2, Clock3, Luggage } from 'lucide-react'

// What a traveler can count on, in four short facts. Each one is something the storefront really does.
const facts = [
  { icon: Armchair, title: 'A more comfortable trip', text: 'Choose your own seat as soon as your ticket is issued.' },
  { icon: Clock3, title: 'On your schedule', text: 'Nonstop flights, shown in local airport time.' },
  { icon: Luggage, title: 'Travel with ease', text: 'Check in online and keep your boarding pass on your phone.' },
  { icon: CalendarX2, title: 'Flexible when plans change', text: 'Cancel online and see what comes back before you confirm.' },
] as const

// The home section the header's "Experience" link opens, titled like the link.
export function StorefrontFacts({ title }: { title: string }) {
  return <section id="experience" aria-labelledby="experience-heading" className="af-container scroll-mt-6 pb-12 pt-10 lg:pt-12">
    <h2 id="experience-heading" className="af-section-head">{title}</h2>
    <ul className="af-facts mt-6 lg:mt-8">{facts.map(fact => <li key={fact.title} className="af-fact"><fact.icon aria-hidden="true" /><div className="min-w-0"><p className="af-fact-title">{fact.title}</p><p className="af-fact-text">{fact.text}</p></div></li>)}</ul>
  </section>
}
