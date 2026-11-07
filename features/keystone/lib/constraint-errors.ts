/** Database rules (migrations/20261107140000_airline_invariants) and what a person should read when one refuses a write. */
export const CONSTRAINT_MESSAGES: Record<string, { code: string; message: string; fields?: string[] }> = {
  Booking_carrier_recordLocator_key: { code: 'AIRLINE_DUPLICATE_RECORD_LOCATOR', message: 'That record locator is already in use. Try the booking again.', fields: ['carrier', 'recordLocator'] },
  Cabin_carrier_code_key: { code: 'AIRLINE_DUPLICATE_CABIN', message: 'A cabin with this code already exists.' },
  FareBrand_carrier_code_key: { code: 'AIRLINE_DUPLICATE_FARE_BRAND', message: 'A fare brand with this code already exists.' },
  Seat_seatMap_designator_key: { code: 'AIRLINE_DUPLICATE_SEAT', message: 'That seat already exists on this seat map.', fields: ['seatMap', 'designator'] },
  StationAssignment_one_active_per_user_airport: { code: 'AIRLINE_DUPLICATE_STATION_ASSIGNMENT', message: 'This user already has an active assignment at that airport.', fields: ['user', 'airport'] },
  Payment_one_fare_capture_per_booking: { code: 'AIRLINE_DUPLICATE_CAPTURE', message: 'This booking’s fare has already been paid.', fields: ['booking'] },
  Payment_provider_reference_key: { code: 'AIRLINE_DUPLICATE_PAYMENT_REFERENCE', message: 'That payment reference has already been applied.', fields: ['provider', 'providerPaymentId'] },
  Refund_within_payment: { code: 'AIRLINE_REFUND_EXCEEDS_PAYMENT', message: 'Refunds can’t exceed what was captured, and must be in the payment’s currency.' },
  Payment_amounts_valid: { code: 'AIRLINE_INVALID_AMOUNT', message: 'A payment must be positive, and can’t capture more than it authorized or refund more than it captured.' },
  Refund_amount_positive: { code: 'AIRLINE_INVALID_AMOUNT', message: 'A refund must be a positive amount.' },
  Booking_amounts_balance: { code: 'AIRLINE_INVALID_AMOUNT', message: 'A booking total must equal base + tax + fees − discount, with no negative parts.' },
  Offer_amounts_balance: { code: 'AIRLINE_INVALID_AMOUNT', message: 'An offer total must equal base + tax + fees − discount, with no negative parts.' },
  Seat_surcharge_non_negative: { code: 'AIRLINE_INVALID_AMOUNT', message: 'A seat surcharge can’t be negative.' },
  InventoryBucket_amounts_non_negative: { code: 'AIRLINE_INVALID_AMOUNT', message: 'Fare amounts can’t be negative.' },
  InventoryBucket_counts_valid: { code: 'AIRLINE_INVENTORY_EXCEEDED', message: 'Sold, held and blocked seats can’t exceed authorized inventory, and authorized can’t exceed the cabin’s capacity.' },
  InventoryHold_quantity_positive: { code: 'AIRLINE_INVALID_QUANTITY', message: 'A seat hold must be for at least one seat.' },
  Payment_currency_code: { code: 'AIRLINE_INVALID_CURRENCY', message: 'Currency must be a three-letter code, such as USD.' },
  Refund_currency_code: { code: 'AIRLINE_INVALID_CURRENCY', message: 'Currency must be a three-letter code, such as USD.' },
  Booking_currency_code: { code: 'AIRLINE_INVALID_CURRENCY', message: 'Currency must be a three-letter code, such as USD.' },
  Offer_currency_code: { code: 'AIRLINE_INVALID_CURRENCY', message: 'Currency must be a three-letter code, such as USD.' },
  Seat_currency_code: { code: 'AIRLINE_INVALID_CURRENCY', message: 'Currency must be a three-letter code, such as USD.' },
  InventoryBucket_currency_code: { code: 'AIRLINE_INVALID_CURRENCY', message: 'Currency must be a three-letter code, such as USD.' },
  FlightInstance_arrives_after_departure: { code: 'AIRLINE_INVALID_TIME_RANGE', message: 'A flight must arrive after it departs.' },
  FlightSchedule_effective_range: { code: 'AIRLINE_INVALID_TIME_RANGE', message: 'A schedule must end after it starts.' },
  StationAssignment_validity_range: { code: 'AIRLINE_INVALID_TIME_RANGE', message: 'A station assignment must end after it starts.' },
  Route_distinct_endpoints: { code: 'AIRLINE_INVALID_ROUTE', message: 'Origin and destination must differ.' },
}

type ErrorLink = {
  message?: unknown; meta?: { target?: unknown }; code?: unknown; originalError?: unknown; cause?: unknown
  // Keystone returns uncoded Prisma failures (CHECK and trigger violations) as "Prisma error" with the text here.
  extensions?: { debug?: { message?: unknown }; prisma?: { meta?: unknown } }
} | null | undefined

function chain(error: unknown) {
  const out: ErrorLink[] = []
  let current = error as ErrorLink
  for (let depth = 0; current && depth < 6; depth++) { out.push(current); current = (current.originalError ?? current.cause) as ErrorLink }
  return out
}

/** The readable, coded refusal for a known constraint violation anywhere in the error's cause chain, or null. */
export function constraintRefusal(error: unknown): { code: string; message: string } | null {
  for (const link of chain(error)) {
    const text = [
      link?.message, typeof link?.meta === 'object' ? JSON.stringify(link.meta) : '',
      link?.extensions?.debug?.message ?? '', link?.extensions?.prisma?.meta ? JSON.stringify(link.extensions.prisma.meta) : '',
    ].join(' ')
    for (const [name, rule] of Object.entries(CONSTRAINT_MESSAGES)) if (text.includes(name)) return rule
    // Prisma sometimes reports a unique violation by its fields instead of the index name.
    const listed = /Unique constraint failed on the fields: \(([^)]*)\)/.exec(String(link?.message || ''))?.[1]?.match(/`([^`]+)`/g)?.map(field => field.slice(1, -1))
    // Raw SQL writes surface Postgres's own detail instead: Key ("user", airport)=(…) already exists.
    const keyed = /Key \(([^)]*)\)=\(.*\) already exists/.exec(text)?.[1]?.split(',').map(field => field.trim().replace(/^"|"$/g, ''))
    const fields = link?.code === 'P2002' && Array.isArray(link?.meta?.target) ? link.meta.target : listed ?? keyed
    if (fields?.length) {
      const target = [...fields].map(String).sort().join(',')
      const match = Object.values(CONSTRAINT_MESSAGES).find(rule => rule.fields && [...rule.fields].sort().join(',') === target)
      if (match) return match
      // Cabin and fare brand codes share the same field pair; without the index name, say what both mean.
      if (target === 'carrier,code') return { code: 'AIRLINE_DUPLICATE_CODE', message: 'A record with this code already exists.' }
    }
  }
  return null
}
