// Rules that live only in migration SQL (Prisma 6.5 cannot express partial indexes, CHECK constraints or the
// nondeletion triggers) and must never be dropped by a generated migration, plus statements that destroy data.
const protectedIndexes = [
  'TicketCoupon_one_spendable_coupon_per_service_obligation', 'TicketCouponLineage_parentCoupon_childCoupon_key',
  // 20261107140000_airline_invariants
  'Booking_carrier_recordLocator_key', 'Cabin_carrier_code_key', 'FareBrand_carrier_code_key', 'Seat_seatMap_designator_key',
  'StationAssignment_one_active_per_user_airport', 'Payment_one_fare_capture_per_booking', 'Payment_provider_reference_key',
]
const protectedConstraints = [
  'TicketCoupon_serviceObligationVersion_positive', 'ServiceObligation_currentVersion_positive', 'ServiceObligation_obligationKey_required',
  'TicketCouponLineage_distinct_coupons', 'TicketCouponLineage_keys_required',
  // 20261107140000_airline_invariants
  'Payment_amounts_valid', 'Payment_currency_code', 'Refund_amount_positive', 'Refund_currency_code', 'Booking_amounts_balance',
  'Booking_currency_code', 'Offer_amounts_balance', 'Offer_currency_code', 'Seat_surcharge_non_negative', 'Seat_currency_code',
  'InventoryBucket_counts_valid', 'InventoryBucket_amounts_non_negative', 'InventoryBucket_currency_code', 'InventoryHold_quantity_positive',
  'FlightInstance_arrives_after_departure', 'FlightSchedule_effective_range', 'StationAssignment_validity_range', 'Route_distinct_endpoints',
]

/** Statements a generated migration must not contain without an explicit, separately reviewed migration. */
export function unsafeMigrationStatements(sql: string) {
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map(statement => statement.trim()).filter(Boolean)
  return statements.filter(statement => /\bDROP\s+(TABLE|COLUMN|SCHEMA|TYPE)\b/i.test(statement)
    || /\bTRUNCATE\b/i.test(statement)
    || /\bDELETE\s+FROM\b/i.test(statement)
    || /\bDROP\s+NOT\s+NULL\b/i.test(statement)
    || /\bDROP\s+(TRIGGER|FUNCTION)\b/i.test(statement)
    || protectedIndexes.some(name => new RegExp(`\\bDROP\\s+INDEX\\b[^;]*"${name}"`, 'i').test(statement))
    || protectedConstraints.some(name => new RegExp(`\\bDROP\\s+CONSTRAINT\\b[^;]*"${name}"`, 'i').test(statement)))
}
