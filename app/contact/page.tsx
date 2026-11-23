import Link from 'next/link'
import { ChevronRight, Mail, Phone } from 'lucide-react'

import { PublicPageShell } from '@/features/storefront/components/PublicPageShell'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { carrierContact } from '@/features/storefront/lib/contact'
import { storefrontPageMetadata } from '@/features/storefront/lib/metadata'

const online = [
  { href: '/manage-booking', label: 'View or cancel a booking', needs: 'Booking reference and last name' },
  { href: '/check-in', label: 'Check in', needs: 'Booking reference and last name' },
  { href: '/status', label: 'Flight status', needs: 'Flight number and date' },
] as const

// The root layout is static, so each storefront page renders per request and sets its own carrier title.
export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return storefrontPageMetadata('Contact')
}

export default async function ContactPage() {
  const carrier = await getStorefrontCarrierIdentity()
  const contact = carrierContact(carrier)
  const airline = carrier?.name ?? 'the airline'
  return <PublicPageShell carrier={carrier} current="/contact" eyebrow="Contact" title={`Contact ${airline}`}>
    <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
      <section aria-labelledby="contact-online" className="af-card p-5 sm:p-6">
        <h2 id="contact-online" className="af-card-title">Do it online</h2>
        <p className="mt-1 text-sm text-[var(--af-ink-2)]">Most changes take a minute, any time of day.</p>
        <ul className="af-list mt-4">{online.map(item => <li key={item.href}><Link href={item.href} className="af-list-link"><span className="min-w-0 flex-1"><span className="af-list-title">{item.label}</span><span className="af-list-note">{item.needs}</span></span><ChevronRight aria-hidden="true" /></Link></li>)}</ul>
      </section>
      <section aria-labelledby="contact-service" className="af-card flex flex-col p-5 sm:p-6">
        <h2 id="contact-service" className="af-card-title">Customer service</h2>
        {contact.hours && <p className="mt-1 text-sm text-[var(--af-ink-2)]">{contact.hours}</p>}
        {contact.email || contact.phone ? <ul className="af-list mt-4">
          {contact.phone && <li><a href={contact.phone.href} className="af-list-link"><Phone aria-hidden="true" className="af-list-icon" /><span className="min-w-0 flex-1"><span className="af-list-title">{contact.phone.label}</span><span className="af-list-note">Call us</span></span></a></li>}
          {contact.email && <li><a href={`mailto:${contact.email}`} className="af-list-link"><Mail aria-hidden="true" className="af-list-icon" /><span className="min-w-0 flex-1"><span className="af-list-title break-all">{contact.email}</span><span className="af-list-note">Email us your booking reference and question</span></span></a></li>}
        </ul> : <p className="mt-4 text-sm text-[var(--af-ink-2)]">Speak to the {airline} service desk at your departure airport, from 3 hours before each departure.</p>}
        <p className="af-title-line mt-auto pt-6 text-sm font-medium text-[var(--af-ink-2)]"><span className="af-dot" data-tone="info" />We never ask for your card number or password.</p>
      </section>
    </div>
  </PublicPageShell>
}
