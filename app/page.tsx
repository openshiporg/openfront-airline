import { ArrowRight } from 'lucide-react'

import { DestinationTiles } from '@/features/storefront/components/DestinationTiles'
import { FlightShop } from '@/features/storefront/components/FlightShop'
import { HomeHero } from '@/features/storefront/components/HomeHero'
import { StorefrontFacts } from '@/features/storefront/components/StorefrontFacts'
import { StorefrontFrame } from '@/features/storefront/components/StorefrontChrome'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { carrierDateFromToday, countWord, experienceTitle } from '@/features/storefront/lib/branding'
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
  const initialDate = carrierDateFromToday(14, carrier?.defaultTimezone ?? 'UTC')
  const network = carrier ? await getStorefrontNetwork(carrier.id) : null
  const selling = Boolean(configured && carrier!.salesEnabled)
  const hub = networkHub(network)
  // The home headline counts the cities on the network ("Four Iconic Cities. One *Elevated* Way to Fly."); without a
  // network it falls back to the carrier's own homepage title from the storefront settings.
  const cities = hub?.destinations.length ?? 0
  const cityWord = cities > 0 && cities <= 10 ? countWord(cities).replace(/^./, letter => letter.toUpperCase()) : null
  const settingsTitle = configured ? carrier!.storefrontHomepageTitle! : carrier ? carrier.name : 'Flights'
  const title = cityWord ? `${cityWord} Iconic ${cities === 1 ? 'City' : 'Cities'}. One *Elevated* Way to Fly.` : settingsTitle
  const kicker = hub ? `Nonstop from ${hub.city}` : null

  const lead = <>
    {kicker && kicker.toLowerCase() !== title.replaceAll('*', '').trim().toLowerCase() && <p className="af-kicker">{kicker}</p>}
    <h1 className="af-display af-hero-title mt-4"><Headline text={title} /></h1>
    {configured && <p className="af-lead-text mt-4">{carrier!.storefrontHomepageDescription}</p>}
    {hub && <a href="#routes" className="af-pill af-pill-ghost mt-6">Explore our routes<ArrowRight aria-hidden="true" /></a>}
  </>

  return <StorefrontFrame carrier={carrier} current="/" overlay>
    {selling ? <FlightShop initialDate={initialDate} carrier={carrier!} network={network!} hero={{ lead }} />
      : <HomeHero lead={lead}>
        <div className="af-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p role="status" className="af-title-line font-semibold"><span className="af-dot" />{configured ? 'Online booking is temporarily unavailable.' : 'Online booking isn’t available yet.'}</p>
        </div>
      </HomeHero>}
    {carrier && network && hub && <section id="routes" aria-labelledby="routes-heading" className="af-container scroll-mt-6 pt-8 lg:pt-9">
      <h2 id="routes-heading" className="af-section-head">Our nonstop routes from {hub.code}</h2>
      <div className="mt-5 lg:mt-6"><DestinationTiles network={network} origin={hub.code} /></div>
    </section>}
    <StorefrontFacts title={experienceTitle(carrier?.name ?? 'Flights')} />
  </StorefrontFrame>
}
