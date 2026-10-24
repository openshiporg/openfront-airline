// Airport-local wall time helpers. Flight times are stored as instants; operators read and type them in the
// timezone of the airport they happen at.

function safeZone(timezone: string | null | undefined) {
  const zone = timezone || 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return zone
  } catch {
    return 'UTC'
  }
}

function wallParts(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value ?? '0')
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute'), second: get('second') }
}

function offsetMs(instant: Date, timezone: string) {
  const p = wallParts(instant, timezone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

const pad = (value: number) => String(value).padStart(2, '0')

/** ISO instant to a `datetime-local` value in the airport's timezone. */
export function instantToAirportLocal(iso: string | null | undefined, timezone: string | null | undefined) {
  if (!iso) return ''
  const instant = new Date(iso)
  if (Number.isNaN(instant.getTime())) return ''
  const p = wallParts(instant, safeZone(timezone))
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/** A `datetime-local` value read as airport wall time, to an ISO instant. Null when blank or invalid. */
export function airportLocalToInstant(local: string, timezone: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local.trim())
  if (!match) return null
  const zone = safeZone(timezone)
  const [, y, mo, d, h, mi] = match.map(Number)
  const wall = Date.UTC(y, mo - 1, d, h, mi)
  let guess = wall - offsetMs(new Date(wall), zone)
  guess = wall - offsetMs(new Date(guess), zone)
  const result = new Date(guess)
  return Number.isNaN(result.getTime()) ? null : result.toISOString()
}

/** Short airport-local time, with the date when it differs from the reference day. */
export function formatAirportTime(iso: string | null | undefined, timezone: string | null | undefined, referenceDay?: string) {
  const local = instantToAirportLocal(iso, timezone)
  if (!local) return ''
  const [day, time] = local.split('T')
  return referenceDay && day !== referenceDay ? `${day.slice(5)} ${time}` : time
}

/** Short timezone name (for example EDT) for an airport at an instant. */
export function airportZoneLabel(iso: string | null | undefined, timezone: string | null | undefined) {
  const zone = safeZone(timezone)
  const instant = iso ? new Date(iso) : new Date()
  if (Number.isNaN(instant.getTime())) return zone
  const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' }).formatToParts(instant).find(entry => entry.type === 'timeZoneName')
  return part?.value ?? zone
}
