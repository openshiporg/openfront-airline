import 'server-only'

import { cache } from 'react'

import { keystoneContext } from '@/features/keystone/context'

export type StorefrontAirport = { code: string; city: string; name: string }
// One timetable line per route: the first upcoming flight's number and local clock times. Public schedule data only.
export type StorefrontTimetableLine = { flightNumber: string; departsAt: string; arrivesAt: string; originTimezone: string; destinationTimezone: string }
export type StorefrontNetwork = { airports: StorefrontAirport[]; routes: Array<{ origin: string; destination: string }>; serviceDates: Record<string, string[]>; timetable?: Record<string, StorefrontTimetableLine> }

export const routeDatesKey = (origin: string, destination: string) => `${origin}-${destination}`

// The carrier's active routes, for the search console's airport pickers. Public data: codes, cities and names only.
export const getStorefrontNetwork = cache(async (carrierId: string): Promise<StorefrontNetwork> => {
  try {
    const routes = await (keystoneContext.prisma as any).route.findMany({
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
    const flights = await (keystoneContext.prisma as any).flightInstance.findMany({
      where: { carrierId, status: { in: ['scheduled', 'open_for_sale', 'delayed'] }, scheduledDepartureAt: { gt: new Date() } },
      select: { serviceDate: true, flightNumber: true, scheduledDepartureAt: true, scheduledArrivalAt: true, origin: { select: { iataCode: true, timezone: true } }, destination: { select: { iataCode: true, timezone: true } } },
      orderBy: [{ scheduledDepartureAt: 'asc' }],
      take: 500,
    })
    const serviceDates: Record<string, string[]> = {}
    const timetable: Record<string, StorefrontTimetableLine> = {}
    for (const flight of flights) {
      if (!flight.origin?.iataCode || !flight.destination?.iataCode) continue
      const key = routeDatesKey(flight.origin.iataCode, flight.destination.iataCode)
      if (!timetable[key] && flight.flightNumber) timetable[key] = { flightNumber: flight.flightNumber, departsAt: flight.scheduledDepartureAt.toISOString(), arrivesAt: flight.scheduledArrivalAt.toISOString(), originTimezone: flight.origin.timezone || 'UTC', destinationTimezone: flight.destination.timezone || 'UTC' }
      const date = flight.serviceDate.toISOString().slice(0, 10)
      const dates = serviceDates[key] ?? (serviceDates[key] = [])
      if (!dates.includes(date) && dates.length < 60) dates.push(date)
    }
    return { airports: [...airports.values()].sort((a, b) => (a.city || a.code).localeCompare(b.city || b.code)), routes: pairs, serviceDates, timetable }
  } catch {
    return { airports: [], routes: [], serviceDates: {} }
  }
})
