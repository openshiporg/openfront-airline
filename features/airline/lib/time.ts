// Airport-local date and time with an explicit zone, e.g. "Nov 7, 2026, 8:00 AM EST". Intl rejects dateStyle or
// timeStyle together with timeZoneName, so the fields are spelled out. Falls back to UTC for an unknown zone.
const FIELDS = { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' } as const

export function formatAirportTime(value: string | number | Date | null | undefined, timeZone?: string | null) {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  try { return new Intl.DateTimeFormat('en-US', { ...FIELDS, timeZone: timeZone || 'UTC' }).format(date) }
  catch { return new Intl.DateTimeFormat('en-US', { ...FIELDS, timeZone: 'UTC' }).format(date) }
}

// Time of day only, with zone: "7:49 PM EST".
export function formatAirportClock(value: string | number | Date | null | undefined, timeZone?: string | null) {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const fields = { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' } as const
  try { return new Intl.DateTimeFormat('en-US', { ...fields, timeZone: timeZone || 'UTC' }).format(date) }
  catch { return new Intl.DateTimeFormat('en-US', { ...fields, timeZone: 'UTC' }).format(date) }
}
