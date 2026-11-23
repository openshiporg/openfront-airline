// Storefront dates and clocks. Flight times read in each airport's own clock, as on every airline's site; a
// service day reads "Tue, Nov 24" while shopping and "Tue, Nov 24, 2026" on a booking.

export function formatServiceDay(value: string, withYear = true) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
}

// An unknown or missing zone falls back to UTC rather than throwing.
export function knownZone(timeZone: string | null | undefined) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: timeZone || 'UTC' }); return timeZone || 'UTC' } catch { return 'UTC' }
}

// "8:20 AM", in the airport's zone.
export function airportClock(value: string, timeZone: string | null | undefined) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: knownZone(timeZone) }).format(new Date(value))
}

// Whole days between departure (origin clock) and arrival (destination clock): 1 for an overnight arrival.
export function dayShift(departure: string, departureZone: string | null | undefined, arrival: string, arrivalZone: string | null | undefined) {
  const day = (value: string, zone: string | null | undefined) => Date.parse(`${new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: knownZone(zone) }).format(new Date(value))}T00:00:00Z`)
  return Math.round((day(arrival, arrivalZone) - day(departure, departureZone)) / 86_400_000)
}
