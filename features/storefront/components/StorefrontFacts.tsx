import { Armchair, Clock3, Luggage, Star } from 'lucide-react'

// What a traveler can count on, in four short facts. Each one is something the storefront really does.
const facts = [
  { icon: Armchair, title: 'A more comfortable trip', text: 'Choose your own seat as soon as your ticket is issued.' },
  { icon: Clock3, title: 'On your schedule', text: 'Nonstop flights, shown in local airport time.' },
  { icon: Luggage, title: 'Travel with ease', text: 'Check in online and keep your boarding pass on your phone.' },
  { icon: Star, title: 'Flexible when plans change', text: 'Cancel online and see what comes back before you confirm.' },
] as const

export function StorefrontFacts() {
  return <section id="experience" aria-label="What to expect" className="af-container pb-10 pt-9 lg:pb-9 lg:pt-8">
    <ul className="af-facts">{facts.map(fact => <li key={fact.title} className="af-fact"><fact.icon aria-hidden="true" /><div className="min-w-0"><p className="af-fact-title">{fact.title}</p><p className="af-fact-text">{fact.text}</p></div></li>)}</ul>
  </section>
}
