// Rules that live only in migration SQL (Prisma 6.5 cannot express partial indexes, CHECK constraints or the
// nondeletion triggers) and must never be dropped by a generated migration, plus statements that destroy data.
const protectedIndexes = ['TicketCoupon_one_spendable_coupon_per_service_obligation', 'TicketCouponLineage_parentCoupon_childCoupon_key']
const protectedConstraints = [
  'TicketCoupon_serviceObligationVersion_positive', 'ServiceObligation_currentVersion_positive', 'ServiceObligation_obligationKey_required',
  'TicketCouponLineage_distinct_coupons', 'TicketCouponLineage_keys_required',
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
