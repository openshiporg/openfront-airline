// City photographs the storefront ships with, by airport code. An airport without one gets the plain cabin-blue
// tile, so every route the carrier sells still shows.
const ART: Record<string, string> = {
  JFK: '/storefront/new-york.webp',
  BOS: '/storefront/boston.webp',
  ORD: '/storefront/chicago.webp',
  MIA: '/storefront/miami.webp',
  LAX: '/storefront/los-angeles.webp',
}

export function destinationArt(airportCode: string): string | null {
  return ART[airportCode.toUpperCase()] ?? null
}
