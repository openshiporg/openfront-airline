export type OfferItemType = 'flight' | 'ancillary' | 'fee' | 'tax' | 'discount'

type JsonObject = Record<string, unknown>

export type BookingLineSnapshotInput = {
  sourceOfferItemId: string
  itemType: OfferItemType
  description: string
  quantity: number
  unitAmount: number
  baseAmount: number
  taxAmount: number
  feeAmount: number
  totalAmount: number
  currencyCode: string
  product: JsonObject
}

export type IncludedBaggageSnapshot = { pieces: number; maxWeightGrams: number }

export function normalizeIncludedBaggageSnapshot(value: unknown): IncludedBaggageSnapshot {
  if (value === undefined || value === null) value = {}
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Included baggage policy must be an object.')
  const policy = value as Record<string, unknown>
  const pieces = policy.pieces ?? 0
  const maxWeightGrams = policy.maxWeightGrams ?? 0
  if (!Number.isInteger(pieces) || (pieces as number) < 0 || (pieces as number) > 10) throw new Error('Included baggage pieces must be an integer between 0 and 10.')
  if (!Number.isInteger(maxWeightGrams) || (maxWeightGrams as number) < 0 || (maxWeightGrams as number) > 100_000) throw new Error('Included baggage weight must be an integer between 0 and 100000 grams.')
  return deepFreeze({ pieces: pieces as number, maxWeightGrams: maxWeightGrams as number })
}

export type BookingSegmentSnapshotInput = {
  sourceOfferItemId: string
  marketingCarrierCode: string
  operatingCarrierCode: string
  flightNumber: string
  originCode: string
  destinationCode: string
  scheduledDepartureAt: string | Date
  scheduledArrivalAt: string | Date
  cabinCode: string
  bookingClassCode: string
  fareBrandCode: string
  fareBasisCode: string
  includedBaggage?: unknown
}

function requiredText(value: string, label: string) {
  const normalized = value?.trim()
  if (!normalized) throw new Error(`${label} is required.`)
  return normalized
}

function nonNegativeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer in minor units.`)
  }
  return value
}

function normalizeCode(value: string, label: string, pattern: RegExp) {
  const normalized = requiredText(value, label).toUpperCase()
  if (!pattern.test(normalized)) throw new Error(`${label} has an invalid format.`)
  return normalized
}

function normalizeDate(value: string | Date, label: string) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date.`)
  return date
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

export function normalizeCurrencyCode(value: string) {
  const normalized = requiredText(value, 'Currency code').toUpperCase()
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error('Currency code must be a three-letter ISO 4217 code.')
  }
  return normalized
}

export function buildBookingLineSnapshot(input: BookingLineSnapshotInput) {
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) {
    throw new Error('Quantity must be a positive safe integer.')
  }

  const unitAmount = nonNegativeInteger(input.unitAmount, 'Unit amount')
  const baseAmount = nonNegativeInteger(input.baseAmount, 'Base amount')
  const expectedBaseAmount = unitAmount * input.quantity
  if (!Number.isSafeInteger(expectedBaseAmount) || expectedBaseAmount !== baseAmount) {
    throw new Error('Base amount must equal unit amount multiplied by quantity.')
  }
  const taxAmount = nonNegativeInteger(input.taxAmount, 'Tax amount')
  const feeAmount = nonNegativeInteger(input.feeAmount, 'Fee amount')
  const totalAmount = nonNegativeInteger(input.totalAmount, 'Total amount')
  if (baseAmount + taxAmount + feeAmount !== totalAmount) {
    throw new Error('Line total must equal base, tax, and fee amounts.')
  }

  return deepFreeze({
    sourceOfferItemId: requiredText(input.sourceOfferItemId, 'Source offer item id'),
    itemType: input.itemType,
    description: requiredText(input.description, 'Description'),
    quantity: input.quantity,
    unitAmount,
    baseAmount,
    taxAmount,
    feeAmount,
    totalAmount,
    currencyCode: normalizeCurrencyCode(input.currencyCode),
    productSnapshot: cloneJson(input.product),
  })
}

export function buildBookingSegmentSnapshot(input: BookingSegmentSnapshotInput) {
  const scheduledDepartureAt = normalizeDate(input.scheduledDepartureAt, 'Scheduled departure')
  const scheduledArrivalAt = normalizeDate(input.scheduledArrivalAt, 'Scheduled arrival')
  if (scheduledArrivalAt <= scheduledDepartureAt) {
    throw new Error('Scheduled arrival must be after departure.')
  }

  const originCode = normalizeCode(input.originCode, 'Origin code', /^[A-Z0-9]{3}$/)
  const destinationCode = normalizeCode(input.destinationCode, 'Destination code', /^[A-Z0-9]{3}$/)
  if (originCode === destinationCode) throw new Error('Origin and destination must differ.')

  return deepFreeze({
    sourceOfferItemId: requiredText(input.sourceOfferItemId, 'Source offer item id'),
    marketingCarrierCode: normalizeCode(input.marketingCarrierCode, 'Marketing carrier code', /^[A-Z0-9]{2,3}$/),
    operatingCarrierCode: normalizeCode(input.operatingCarrierCode, 'Operating carrier code', /^[A-Z0-9]{2,3}$/),
    flightNumber: normalizeCode(input.flightNumber, 'Flight number', /^[A-Z0-9]{1,6}$/),
    originCode,
    destinationCode,
    scheduledDepartureAt: scheduledDepartureAt.toISOString(),
    scheduledArrivalAt: scheduledArrivalAt.toISOString(),
    cabinCode: normalizeCode(input.cabinCode, 'Cabin code', /^[A-Z0-9]{1,4}$/),
    bookingClassCode: normalizeCode(input.bookingClassCode, 'Booking class code', /^[A-Z0-9]{1,4}$/),
    fareBrandCode: normalizeCode(input.fareBrandCode, 'Fare brand code', /^[A-Z0-9_-]{1,32}$/),
    fareBasisCode: normalizeCode(input.fareBasisCode, 'Fare basis code', /^[A-Z0-9_-]{1,32}$/),
    includedBaggage: normalizeIncludedBaggageSnapshot(input.includedBaggage),
  })
}
