import { DomainError } from './domain-error'

// Amounts are stored as integer minor units. The exponent comes from the currency (JPY 0, USD 2, KWD 3), so
// display code never assumes a fixed division by 100.
export function currencyExponent(currencyCode: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

export function minorToMajor(amount: number, currencyCode: string) {
  return amount / 10 ** currencyExponent(currencyCode)
}

export function formatMinorUnits(amount: number | null | undefined, currencyCode: string | null | undefined) {
  if (amount == null || !Number.isFinite(amount) || !currencyCode) return '—'
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(minorToMajor(amount, currencyCode))
  } catch {
    return `${currencyCode} ${minorToMajor(amount, currencyCode).toFixed(currencyExponent(currencyCode))}`
  }
}

// Amounts are GraphQL Int and Prisma Int columns: every stored or returned total must fit in a signed 32-bit integer.
export const MAX_MINOR_AMOUNT = 2_147_483_647

/** Exact sum/product of minor-unit amounts, rejected (never clamped or rounded) when it would not fit. */
export function checkedMinorTotal(perUnit: readonly number[], quantity = 1) {
  const unit = perUnit.reduce((sum, value) => sum + value, 0)
  const total = unit * quantity
  if (![...perUnit, unit, total].every(value => Number.isSafeInteger(value) && value >= 0 && value <= MAX_MINOR_AMOUNT)) {
    throw new DomainError('This fare total exceeds the largest supported amount.')
  }
  return total
}

/** Parse a user-entered decimal exactly. Blank, exponent notation and excess precision are never rounded. */
export function decimalToMinorUnits(value: string, currencyCode: string) {
  const input = value.trim()
  if (input.length > 32 || !/^(0|[1-9]\d*)(?:\.\d+)?$/.test(input)) throw new DomainError('Enter a valid non-negative decimal amount.')
  const [whole, fraction = ''] = input.split('.')
  const exponent = currencyExponent(currencyCode)
  if (fraction.length > exponent) throw new DomainError(`Use at most ${exponent} decimal places for ${currencyCode}.`)
  const amount = Number(whole + fraction.padEnd(exponent, '0'))
  if (!Number.isSafeInteger(amount) || amount > MAX_MINOR_AMOUNT) throw new DomainError('Amount exceeds the largest supported value.')
  return amount
}
