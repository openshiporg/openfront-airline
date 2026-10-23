import 'server-only'

import { cache } from 'react'

import { keystoneContext } from '@/features/keystone/context'

export type StorefrontAirport = { code: string; city: string; name: string }
export type StorefrontNetwork = { airports: StorefrontAirport[]; routes: Array<{ origin: string; destination: string }> }

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
    return { airports: [...airports.values()].sort((a, b) => (a.city || a.code).localeCompare(b.city || b.code)), routes: pairs }
  } catch {
    return { airports: [], routes: [] }
  }
})
