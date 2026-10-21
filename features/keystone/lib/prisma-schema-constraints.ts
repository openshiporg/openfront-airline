// Keystone emits every to-one relationship as an optional Prisma relation. Some airline lists were tightened by
// migration SQL instead (20260923044000_itinerary_entitlement_backfill_and_unique: NOT NULL foreign keys and a
// compound unique). Modelling those rules here keeps the generated schema, and every future migration diff, from
// silently dropping them. Each helper throws when the expected generated line is missing, so a Keystone upgrade that
// changes the emitted shape fails generation instead of losing a constraint.

/** Makes a generated to-one relation and its foreign-key column required (deletion of the target is restricted). */
export function requirePrismaRelations(schema: string, relations: readonly string[]) {
  let next = schema
  for (const relation of relations) {
    const relationLine = new RegExp(`^([ \\t]*${relation}[ \\t]+)(\\w+)\\?([ \\t]+@relation\\([^)]*)\\)`, 'm')
    if (!relationLine.test(next)) throw new Error(`Prisma relation ${relation} was not found while applying retained constraints.`)
    next = next.replace(relationLine, (_line, lead: string, type: string, attributes: string) => `${lead}${type}${attributes}, onDelete: Restrict)`)
    const foreignKeyLine = new RegExp(`^([ \\t]*${relation}Id[ \\t]+)String\\?([ \\t]+@map)`, 'm')
    if (!foreignKeyLine.test(next)) throw new Error(`Prisma foreign key ${relation}Id was not found while applying retained constraints.`)
    next = next.replace(foreignKeyLine, '$1String$2')
  }
  return next
}

/** Appends a block attribute (for example a named @@unique) to a generated Prisma model. */
export function addPrismaModelAttribute(schema: string, attribute: string) {
  const end = schema.lastIndexOf('}')
  if (end < 0) throw new Error('Prisma model block was not found while applying retained constraints.')
  return `${schema.slice(0, end).trimEnd()}\n  ${attribute}\n}`
}
