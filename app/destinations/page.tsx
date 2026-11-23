import { DestinationTiles } from '@/features/storefront/components/DestinationTiles'
import { PublicPageShell } from '@/features/storefront/components/PublicPageShell'
import { Timetable } from '@/features/storefront/components/Timetable'
import { getStorefrontCarrierIdentity } from '@/features/storefront/lib/carrier'
import { networkHub } from '@/features/storefront/lib/hub'
import { storefrontPageMetadata } from '@/features/storefront/lib/metadata'
import { getStorefrontNetwork } from '@/features/storefront/lib/network'

// The root layout is static, so each storefront page renders per request and sets its own carrier title.
export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return storefrontPageMetadata('Destinations')
}

export default async function DestinationsPage() {
  const carrier = await getStorefrontCarrierIdentity()
  const network = carrier ? await getStorefrontNetwork(carrier.id) : { airports: [], routes: [], serviceDates: {} as Record<string, string[]> }
  const hub = networkHub(network)
  return <PublicPageShell carrier={carrier} current="/destinations" eyebrow={hub ? `Nonstop from ${hub.city}` : undefined} title="Destinations">
    {carrier && hub ? <>
      <h2 className="af-section-head">Our nonstop routes from {hub.code}</h2>
      <div className="mt-5"><DestinationTiles network={network} origin={hub.code} rows /></div>
      <h2 className="af-section-head mt-12">Timetable</h2>
      <p className="mb-6 mt-4 max-w-2xl text-[var(--af-ink-2)]">Every route on sale, with the next flight’s local times and the days it operates. Choose a destination to search that route.</p>
      <Timetable network={network} carrierCode={carrier.code} />
    </> : <p role="status" className="af-notice" data-tone="warn"><span className="af-dot" data-tone="warn" />No destinations on sale yet.</p>}
  </PublicPageShell>
}
