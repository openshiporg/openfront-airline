import type { StorefrontNetwork } from './network'

// The carrier's hub: the origin with the most routes. Null when nothing is on the network yet.
export function networkHub(network: StorefrontNetwork | null | undefined) {
  if (!network?.routes.length) return null
  const counts = new Map<string, number>()
  for (const route of network.routes) counts.set(route.origin, (counts.get(route.origin) ?? 0) + 1)
  const [code] = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]
  const city = network.airports.find(airport => airport.code === code)?.city || code
  return { code, city, destinations: network.routes.filter(route => route.origin === code).map(route => route.destination) }
}
