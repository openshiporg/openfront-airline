import Link from 'next/link'

import { formatAirportClock } from '@/features/airline/lib/time'
import { routeDatesKey, type StorefrontNetwork } from '@/features/storefront/lib/network'

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

// Days of operation from the dates actually on sale (Monday = 0), as a printed timetable's 1–7 columns.
function operatingDays(dates: string[] | undefined) {
  const days = new Set<number>()
  for (const date of dates ?? []) days.add((new Date(`${date}T00:00:00.000Z`).getUTCDay() + 6) % 7)
  return days
}

function clock(value: string, timeZone: string) {
  return (formatAirportClock(value, timeZone) ?? '').replace(/\s+[A-Z]{2,5}$/, '')
}

/** The carrier's schedule set as a pocket timetable: one group per origin, one line per route. Live data only. */
export function Timetable({ network, carrierCode }: { network: StorefrontNetwork; carrierCode: string }) {
  const city = (code: string) => network.airports.find(airport => airport.code === code)?.city || code
  // The hub (the origin with the most routes) leads, as on a carrier's printed timetable; the rest follow by city.
  const routeCount = (code: string) => network.routes.filter(route => route.origin === code).length
  const origins = [...new Set(network.routes.map(route => route.origin))].sort((left, right) => routeCount(right) - routeCount(left) || city(left).localeCompare(city(right)))
  if (!origins.length) return null
  return <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
    {origins.map(origin => <section key={origin} aria-label={`From ${city(origin)}`} className="min-w-0">
      <h3 className="flex items-baseline gap-3 border-b-2 border-[var(--af-accent)] pb-1.5"><span className="af-display text-3xl uppercase">From {city(origin)}</span><span className="text-sm font-bold tracking-[0.06em] text-[var(--af-accent)]">{origin}</span></h3>
      <table className="af-timetable w-full text-sm">
        <colgroup><col className="w-[34%]" /><col className="w-[17%]" /><col className="w-[17%]" /><col className="w-[17%]" /><col /></colgroup>
        <thead><tr className="text-left text-xs text-[var(--af-ink-3)] [&>th]:py-2 [&>th]:font-semibold"><th scope="col">To</th><th scope="col">Flight</th><th scope="col">Dep</th><th scope="col">Arr</th><th scope="col"><span className="sr-only">Days of operation</span><span aria-hidden="true">Days</span></th></tr></thead>
        <tbody className="divide-y divide-[var(--af-line)] border-t border-[var(--af-line)]">
          {network.routes.filter(route => route.origin === origin).map(route => {
            const key = routeDatesKey(route.origin, route.destination)
            const line = network.timetable?.[key]
            const dates = network.serviceDates[key]
            const days = operatingDays(dates)
            const query = new URLSearchParams({ from: route.origin, to: route.destination, ...(dates?.[0] ? { date: dates[0] } : {}) })
            return <tr key={key} className="group align-baseline [&>td]:py-2.5">
              <td className="pr-3"><Link href={`/?${query.toString()}#book`} className="font-semibold underline-offset-4 group-hover:underline">{city(route.destination)}</Link> <span className="text-xs font-bold tracking-[0.06em] text-[var(--af-ink-3)]">{route.destination}</span></td>
              <td className="whitespace-nowrap pr-3 text-[var(--af-ink-2)]">{line ? `${carrierCode} ${line.flightNumber}` : '—'}</td>
              <td className="whitespace-nowrap pr-3 font-semibold">{line ? clock(line.departsAt, line.originTimezone) : '—'}</td>
              <td className="whitespace-nowrap pr-3">{line ? clock(line.arrivesAt, line.destinationTimezone) : '—'}</td>
              <td>{dates?.length && days.size === 7 ? <span className="af-daily">Daily</span> : dates?.length ? <span className="af-days" aria-label={`Operates ${DAY_NAMES.filter((_, index) => days.has(index)).join(', ')}`}>{DAYS.map((day, index) => <span key={index} className="af-day" data-on={days.has(index) ? 'true' : undefined}>{day}</span>)}</span> : <span className="text-xs text-[var(--af-ink-3)]">Not on sale</span>}</td>
            </tr>
          })}
        </tbody>
      </table>
    </section>)}
  </div>
}
