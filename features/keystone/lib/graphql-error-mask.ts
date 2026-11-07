import crypto from 'node:crypto'
import { GraphQLError } from 'graphql'
import { maskError } from 'graphql-yoga'

import { CONSTRAINT_MESSAGES, constraintRefusal } from './constraint-errors'

/** Yoga mask: deliberate GraphQL errors pass through; unexpected ones are hidden behind a logged correlation ID. */
export function maskGraphqlError(error: unknown, message: string, isDev?: boolean) {
  // A database rule refused the write: say which rule in words, with a stable code, instead of "Unexpected error."
  let refusal = constraintRefusal(error)
  if (refusal) {
    const source = error instanceof GraphQLError ? error : null
    // Cabin and fare-brand codes share a field pair; the mutation that failed says which one was meant.
    const field = String(source?.path?.[0] ?? '')
    if (refusal.code === 'AIRLINE_DUPLICATE_CODE' && /Cabin/.test(field)) refusal = CONSTRAINT_MESSAGES.Cabin_carrier_code_key
    if (refusal.code === 'AIRLINE_DUPLICATE_CODE' && /FareBrand/.test(field)) refusal = CONSTRAINT_MESSAGES.FareBrand_carrier_code_key
    return new GraphQLError(refusal.message, { nodes: source?.nodes, source: source?.source, positions: source?.positions, path: source?.path, extensions: { code: refusal.code } })
  }
  const masked = maskError(error, message, isDev)
  if (masked === error || !(masked instanceof GraphQLError)) return masked
  const correlationId = crypto.randomUUID()
  // Unknown exception messages/stacks may retain request variables or credentials. Correlate without serializing
  // the exception; detailed diagnostics require a separately redacted observation boundary.
  console.error(JSON.stringify({ event: 'graphql.unexpected_error', correlationId }))
  return new GraphQLError(masked.message, { nodes: masked.nodes, source: masked.source, positions: masked.positions, path: masked.path, extensions: { ...masked.extensions, code: 'INTERNAL_SERVER_ERROR', correlationId } })
}
