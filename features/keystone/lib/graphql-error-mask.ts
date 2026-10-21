import crypto from 'node:crypto'
import { GraphQLError } from 'graphql'
import { maskError } from 'graphql-yoga'

/** Yoga mask: deliberate GraphQL errors pass through; unexpected ones are hidden behind a logged correlation ID. */
export function maskGraphqlError(error: unknown, message: string, isDev?: boolean) {
  const masked = maskError(error, message, isDev)
  if (masked === error || !(masked instanceof GraphQLError)) return masked
  const correlationId = crypto.randomUUID()
  // Unknown exception messages/stacks may retain request variables or credentials. Correlate without serializing
  // the exception; detailed diagnostics require a separately redacted observation boundary.
  console.error(JSON.stringify({ event: 'graphql.unexpected_error', correlationId }))
  return new GraphQLError(masked.message, { nodes: masked.nodes, source: masked.source, positions: masked.positions, path: masked.path, extensions: { ...masked.extensions, code: 'INTERNAL_SERVER_ERROR', correlationId } })
}
