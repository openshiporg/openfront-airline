import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { DestinationTiles } from '@/features/storefront/components/DestinationTiles'
import { FlightShop } from '@/features/storefront/components/FlightShop'
import { HomeHero } from '@/features/storefront/components/HomeHero'
import { StorefrontFacts } from '@/features/storefront/components/StorefrontFacts'
import { StorefrontFrame } from '@/features/storefront/components/StorefrontChrome'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { carrierCalendarDate } from '@/features/storefront/lib/branding'
import { destinationArt } from '@/features/storefront/lib/destination-art'
import { networkHub } from '@/features/storefront/lib/hub'
import { storefrontBrandPalette } from '@/features/storefront/lib/theme'
import { storefrontPageMetadata } from '@/features/storefront/lib/metadata'
import { getStorefrontNetwork } from '@/features/storefront/lib/network'

// The root layout is static, so each storefront page renders per request and sets its own carrier title.
export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return storefrontPageMetadata()
}

// The carrier's own headline: one line per sentence on wide screens, and a word or phrase wrapped in
// *asterisks* is set in the accented italic.
function Headline({ text }: { text: string }) {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text]
  return <>{sentences.map((sentence, line) => <span key={line}>{sentence.split(/\*([^*]+)\*/).map((part, index) => index % 2 ? <em key={index}>{part}</em> : part)}</span>)}</>
}

export default async function Home() {
  const carrier = await getStorefrontCarrierIdentity()
  // Same rule as every other storefront page: servicing works for any persisted carrier; selling also needs a
  // configured storefront (title, description and an approved brand colour) and direct sales.
  const configured = Boolean(carrier?.storefrontConfigured && storefrontBrandPalette(carrier.storefrontBrandColor))
  const initialDate = carrierCalendarDate(new Date(Date.now() + 14 * 86_400_000), carrier?.defaultTimezone ?? 'UTC')
  const network = carrier ? await getStorefrontNetwork(carrier.id) : null
  const selling = Boolean(configured && carrier!.salesEnabled)
  const hub = networkHub(network)
  const title = configured ? carrier!.storefrontHomepageTitle! : carrier ? carrier.name : 'Flights'
  const kicker = hub ? `Nonstop from ${hub.city}` : null

  const lead = <>
    {kicker && kicker.toLowerCase() !== title.replaceAll('*', '').trim().toLowerCase() && <p className="af-kicker text-white/90">{kicker}</p>}
    <h1 className="af-display af-hero-title mt-4 "><Headline text={title} /></h1>
    {configured && <p className="mt-4 max-w-[34rem] text-lg leading-[1.4] text-[var(--af-board-ink-2)] sm:text-xl">{carrier!.storefrontHomepageDescription}</p>}
    {hub && <a href="#routes" className="af-pill af-pill-ghost mt-6 px-7">Explore our routes<ArrowRight aria-hidden="true" /></a>}
  </>
  const windowImage = hub ? destinationArt(hub.code) : null

  return <StorefrontFrame carrier={carrier} current="/" overlay>
    {selling ? <FlightShop initialDate={initialDate} carrier={carrier!} network={network!} hero={{ lead, windowImage }} />
      : <HomeHero lead={lead} windowImage={windowImage}>
        <div className="af-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p role="status" className="af-title-line font-semibold"><span className="af-dot" data-tone="warn" />{configured ? 'Online booking is temporarily unavailable.' : 'Online booking isn’t available yet.'}</p>
          {!configured && <Link href="/dashboard" className="af-pill af-pill-sm w-fit">Operator sign in</Link>}
        </div>
      </HomeHero>}
    {carrier && network && hub && <section id="routes" aria-labelledby="routes-heading" className="af-container scroll-mt-6 pt-8 lg:pt-9">
      <h2 id="routes-heading" className="af-section-head">Our nonstop routes from {hub.code}</h2>
      <div className="mt-5 lg:mt-6"><DestinationTiles network={network} origin={hub.code} /></div>
    </section>}
    <StorefrontFacts />
  </StorefrontFrame>
}
