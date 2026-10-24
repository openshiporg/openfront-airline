// Client-safe constants and helpers shared by the network and fares desks.

export type ActionResult = { ok: true } | { ok: false; error: string }

export type Transition = { label: string; to: string; variant?: 'raised' | 'danger' }

/** Route: draft -> active -> suspended -> archived; suspended routes can be reactivated. */
export const ROUTE_TRANSITIONS: Record<string, Transition[]> = {
  draft: [{ label: 'Activate', to: 'active' }, { label: 'Archive', to: 'archived', variant: 'danger' }],
  active: [{ label: 'Suspend', to: 'suspended' }, { label: 'Archive', to: 'archived', variant: 'danger' }],
  suspended: [{ label: 'Activate', to: 'active' }, { label: 'Archive', to: 'archived', variant: 'danger' }],
  archived: [],
}

/** Schedule: draft -> published -> suspended -> retired; suspended schedules can be republished. */
export const SCHEDULE_TRANSITIONS: Record<string, Transition[]> = {
  draft: [{ label: 'Publish', to: 'published' }, { label: 'Retire', to: 'retired', variant: 'danger' }],
  published: [{ label: 'Suspend', to: 'suspended' }, { label: 'Retire', to: 'retired', variant: 'danger' }],
  suspended: [{ label: 'Publish', to: 'published' }, { label: 'Retire', to: 'retired', variant: 'danger' }],
  retired: [],
}

/** Fare brands, fare rules and ancillaries: draft -> active -> inactive -> archived. */
export const PRODUCT_TRANSITIONS: Record<string, Transition[]> = {
  draft: [{ label: 'Activate', to: 'active' }, { label: 'Archive', to: 'archived', variant: 'danger' }],
  active: [{ label: 'Deactivate', to: 'inactive' }, { label: 'Archive', to: 'archived', variant: 'danger' }],
  inactive: [{ label: 'Activate', to: 'active' }, { label: 'Archive', to: 'archived', variant: 'danger' }],
  archived: [],
}

export function allowedTransition(map: Record<string, Transition[]>, from: string, to: string) {
  return (map[from] ?? []).some(transition => transition.to === to)
}

export const ROUTE_STATUSES = ['draft', 'active', 'suspended', 'archived'] as const
export const SCHEDULE_STATUSES = ['draft', 'published', 'suspended', 'retired'] as const
export const PRODUCT_STATUSES = ['draft', 'active', 'inactive', 'archived'] as const

export const WEEKDAYS = [
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
  { value: 7, short: 'Sun' },
] as const

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
export const FLIGHT_NUMBER_PATTERN = /^[A-Z0-9]{2,3}\s?[0-9]{1,4}[A-Z]?$/
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
export const MAX_MINOR_AMOUNT = 2_147_483_647

export function currencyExponent(currencyCode: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

export function formatMinor(amount: number | null | undefined, currencyCode: string | null | undefined) {
  if (amount == null || !Number.isFinite(amount) || !currencyCode) return '-'
  const major = amount / 10 ** currencyExponent(currencyCode)
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(major)
  } catch {
    return `${currencyCode} ${major.toFixed(currencyExponent(currencyCode))}`
  }
}

/** Major-unit text for an input, from stored minor units. */
export function minorToInput(amount: number | null | undefined, currencyCode: string) {
  if (amount == null || !Number.isFinite(amount)) return ''
  return (amount / 10 ** currencyExponent(currencyCode)).toFixed(currencyExponent(currencyCode))
}

/** Exact major-to-minor conversion; returns an error message when the text is not a valid amount. */
export function majorToMinor(text: string, currencyCode: string): { ok: true; value: number } | { ok: false; error: string } {
  const value = text.trim()
  if (!value) return { ok: true, value: 0 }
  const exponent = currencyExponent(currencyCode)
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value)
  if (!match) return { ok: false, error: 'Enter a positive amount.' }
  const fraction = match[2] ?? ''
  if (fraction.length > exponent) return { ok: false, error: exponent === 0 ? `${currencyCode} has no minor units.` : `Use at most ${exponent} decimal places.` }
  const minor = Number(match[1]) * 10 ** exponent + Number(fraction.padEnd(exponent, '0') || 0)
  if (!Number.isSafeInteger(minor) || minor > MAX_MINOR_AMOUNT) return { ok: false, error: 'Amount is too large.' }
  return { ok: true, value: minor }
}

/** Parses an optional non-negative whole number field. */
export function wholeNumber(text: string, { max }: { max?: number } = {}): { ok: true; value: number | null } | { ok: false; error: string } {
  const value = text.trim()
  if (!value) return { ok: true, value: null }
  if (!/^\d+$/.test(value)) return { ok: false, error: 'Enter a whole number.' }
  const parsed = Number(value)
  if (max !== undefined && parsed > max) return { ok: false, error: `Must be ${max} or less.` }
  if (parsed > MAX_MINOR_AMOUNT) return { ok: false, error: 'Number is too large.' }
  return { ok: true, value: parsed }
}

/** YYYY-MM-DD from a stored timestamp, in UTC (dates are stored as UTC midnight). */
export function dateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : ''
}

export function dateToTimestamp(value: string) {
  return value ? `${value}T00:00:00.000Z` : null
}

export function newIdempotencyKey(prefix: string) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`
  return `${prefix}-${random}`
}
