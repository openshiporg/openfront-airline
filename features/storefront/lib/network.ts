import 'server-only'

import { cache } from 'react'

import { keystoneContext } from '@/features/keystone/context'

export type StorefrontAirport = { code: string; city: string; name: string }
// One timetable line per route: the first upcoming flight's number and local clock times. Public schedule data only.
export type StorefrontTimetableLine = { flightNumber: string; departsAt: string; arrivesAt: string; originTimezone: string; destinationTimezone: string }
// The lowest fare on sale per route (base plus taxes, per traveler) and whether that fare includes a checked bag.
export type StorefrontRouteFare = { amount: number; currencyCode: string; checkedBags: number }
export type StorefrontNetwork = { airports: StorefrontAirport[]; routes: Array<{ origin: string; destination: string }>; serviceDates: Record<string, string[]>; timetable?: Record<string, StorefrontTimetableLine>; fares?: Record<string, StorefrontRouteFare> }

function checkedBagPieces(value: unknown) {
  const pieces = value && typeof value === 'object' ? Number((value as { pieces?: unknown }).pieces) : 0
  return Number.isInteger(pieces) && pieces > 0 ? pieces : 0
}

// The two reads below, typed by the fields they select.
type NetworkAirportRow = { iataCode: string | null; city: string; name: string; timezone?: string | null }
type NetworkRouteRow = { origin: NetworkAirportRow | null; destination: NetworkAirportRow | null }
type NetworkFlightRow = {
  serviceDate: Date; flightNumber: string | null; scheduledDepartureAt: Date; scheduledArrivalAt: Date
  origin: Pick<NetworkAirportRow, 'iataCode' | 'timezone'> | null; destination: Pick<NetworkAirportRow, 'iataCode' | 'timezone'> | null
  inventoryBuckets?: Array<{ baseAmount: unknown; taxAmount: unknown; currencyCode: string | null; fareBrand: { includedBaggage: unknown } | null }>
}
type FindMany<Row> = { findMany(args: object): Promise<Row[]> }
const networkDb = () => keystoneContext.prisma as unknown as { route: FindMany<NetworkRouteRow>; flightInstance: FindMany<NetworkFlightRow> }

export const routeDatesKey = (origin: string, destination: string) => `${origin}-${destination}`

// The carrier's active routes, for the search console's airport pickers. Public data: codes, cities and names only.
export const getStorefrontNetwork = cache(async (carrierId: string): Promise<StorefrontNetwork> => {
  try {
    const routes = await networkDb().route.findMany({
      where: { carrierId, status: 'active', origin: { isActive: true }, destination: { isActive: true } },
      select: { origin: { select: { iataCode: true, city: true, name: true } }, destination: { select: { iataCode: true, city: true, name: true } } },
      orderBy: [{ origin: { iataCode: 'asc' } }, { destination: { iataCode: 'asc' } }],
      take: 500,
    })
    const airports = new Map<string, StorefrontAirport>()
    const pairs: StorefrontNetwork['routes'] = []
    for (const route of routes) {
      if (!route.origin?.iataCode || !route.destination?.iataCode) continue
      airports.set(route.origin.iataCode, { code: route.origin.iataCode, city: route.origin.city, name: route.origin.name })
      airports.set(route.destination.iataCode, { code: route.destination.iataCode, city: route.destination.city, name: route.destination.name })
      pairs.push({ origin: route.origin.iataCode, destination: route.destination.iataCode })
    }
    // Upcoming dates with a flight on sale, per route, so search can start on (and point to) a date that flies.
    const flights = await networkDb().flightInstance.findMany({
      where: { carrierId, status: { in: ['scheduled', 'open_for_sale', 'delayed'] }, scheduledDepartureAt: { gt: new Date() } },
      select: { serviceDate: true, flightNumber: true, scheduledDepartureAt: true, scheduledArrivalAt: true, origin: { select: { iataCode: true, timezone: true } }, destination: { select: { iataCode: true, timezone: true } }, inventoryBuckets: { where: { status: 'open', fareBrand: { status: 'active' } }, select: { baseAmount: true, taxAmount: true, currencyCode: true, fareBrand: { select: { includedBaggage: true } } }, take: 3 } },
      orderBy: [{ scheduledDepartureAt: 'asc' }],
      take: 500,
    })
    const serviceDates: Record<string, string[]> = {}
    const timetable: Record<string, StorefrontTimetableLine> = {}
    const fares: Record<string, StorefrontRouteFare> = {}
    for (const flight of flights) {
      if (!flight.origin?.iataCode || !flight.destination?.iataCode) continue
      const key = routeDatesKey(flight.origin.iataCode, flight.destination.iataCode)
      if (!timetable[key] && flight.flightNumber) timetable[key] = { flightNumber: flight.flightNumber, departsAt: flight.scheduledDepartureAt.toISOString(), arrivesAt: flight.scheduledArrivalAt.toISOString(), originTimezone: flight.origin.timezone || 'UTC', destinationTimezone: flight.destination.timezone || 'UTC' }
      for (const bucket of flight.inventoryBuckets ?? []) {
        const amount = Number(bucket.baseAmount) + Number(bucket.taxAmount)
        if (Number.isSafeInteger(amount) && amount > 0 && bucket.currencyCode && (!fares[key] || amount < fares[key].amount)) fares[key] = { amount, currencyCode: bucket.currencyCode, checkedBags: checkedBagPieces(bucket.fareBrand?.includedBaggage) }
      }
      const date = flight.serviceDate.toISOString().slice(0, 10)
      const dates = serviceDates[key] ?? (serviceDates[key] = [])
      if (!dates.includes(date) && dates.length < 60) dates.push(date)
    }
    return { airports: [...airports.values()].sort((a, b) => (a.city || a.code).localeCompare(b.city || b.code)), routes: pairs, serviceDates, timetable, fares }
  } catch {
    return { airports: [], routes: [], serviceDates: {} }
  }
})
