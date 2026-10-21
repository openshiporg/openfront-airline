import { GraphQLError } from 'graphql'

export type DomainErrorCode = 'BAD_USER_INPUT' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'RATE_LIMITED'

/**
 * An expected, deliberately worded failure (validation, readiness, permission, concurrency, abuse limit). It is a
 * GraphQLError, so the served endpoint returns its message and code in every environment instead of masking it.
 * Any other exception stays masked (graphql-error-mask.ts).
 */
export class DomainError extends GraphQLError {
  constructor(message: string, code: DomainErrorCode = 'BAD_USER_INPUT') {
    super(message, { extensions: { code } })
  }
}
