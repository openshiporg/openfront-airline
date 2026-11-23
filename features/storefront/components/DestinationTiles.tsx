import { ArrowRight } from 'lucide-react'

import { formatMinorUnits } from '@/features/keystone/lib/money'
import { countWord } from '@/features/storefront/lib/branding'
import { destinationArt } from '@/features/storefront/lib/destination-art'
import { routeDatesKey, type StorefrontNetwork } from '@/features/storefront/lib/network'

/** The routes from one origin as photo tiles: city, the lowest fare on sale, and a link that opens the search on that route. */
export function DestinationTiles({ network, origin, rows = false }: { network: StorefrontNetwork; origin: string; rows?: boolean }) {
  // Home order: Boston, Chicago, Miami, Los Angeles; any other route follows in network order.
  const ORDER = ['BOS', 'ORD', 'MIA', 'LAX']
  const rank = (code: string) => { const index = ORDER.indexOf(code); return index < 0 ? ORDER.length : index }
  const routes = network.routes.filter(route => route.origin === origin).sort((left, right) => rank(left.destination) - rank(right.destination))
  if (!routes.length) return null
  const city = (code: string) => network.airports.find(airport => airport.code === code)?.city || code
  return <ul className="af-dest-grid" data-rows={rows ? 'true' : undefined}>
    {routes.map(route => {
      const key = routeDatesKey(route.origin, route.destination)
      const fare = network.fares?.[key]
      const firstDate = network.serviceDates[key]?.[0]
      const query = new URLSearchParams({ from: route.origin, to: route.destination, ...(firstDate ? { date: firstDate } : {}) })
      const art = destinationArt(route.destination)
      return <li key={key} className="af-dest">
        <div className="af-dest-photo" style={art ? { backgroundImage: `url(${art})` } : undefined} />
        <div className="af-dest-body">
          {/* A plain link: the search reads the route from the address when the page loads. */}
          <h3 className="af-dest-city"><a href={`/?${query.toString()}#book`} className="af-dest-link">{city(route.destination)}</a></h3>
          <p className="af-dest-tag">Nonstop from {origin}</p>
          {fare ? <>
            <p className="af-dest-price"><span className="hidden lg:inline">From </span>{formatMinorUnits(fare.amount, fare.currencyCode)}</p>
            <p className="af-dest-note">{fare.checkedBags ? `Includes seat selection & ${countWord(fare.checkedBags)} checked bag${fare.checkedBags === 1 ? '' : 's'}` : 'Includes seat selection'}</p>
          </> : <p className="af-dest-note">{firstDate ? 'See fares for your dates' : 'Not on sale yet'}</p>}
          {rows && <span aria-hidden="true" className="af-pill af-pill-primary af-dest-cta w-fit">Book now<ArrowRight /></span>}
        </div>
        <ArrowRight aria-hidden="true" className="af-dest-arrow" strokeWidth={1.5} />
      </li>
    })}
  </ul>
}
