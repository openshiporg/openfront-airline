import { Kind, visit, type DocumentNode } from 'graphql'

const sensitiveAuthenticationFields = new Set([
  'authenticateUserWithPassword',
  'sendUserPasswordResetLink',
  'redeemUserPasswordResetToken',
])

export function invokesSensitiveAuthentication(document: DocumentNode) {
  let sensitive = false
  visit(document, { Field(node) { if (sensitiveAuthenticationFields.has(node.name.value)) sensitive = true } })
  return sensitive
}

/**
 * The account each sensitive authentication field targets (lowercased email, '' when absent), one entry per field
 * occurrence. Aliases and fragments each count, so one request cannot hide several password guesses.
 */
export function sensitiveAuthenticationAccounts(document: DocumentNode, variables?: Record<string, unknown> | null) {
  const accounts: string[] = []
  visit(document, {
    Field(node) {
      if (!sensitiveAuthenticationFields.has(node.name.value)) return
      const email = node.arguments?.find(argument => argument.name.value === 'email')?.value
      const value = email?.kind === Kind.STRING ? email.value : email?.kind === Kind.VARIABLE ? variables?.[email.name.value] : undefined
      accounts.push(typeof value === 'string' ? value.trim().toLowerCase() : '')
    },
  })
  return accounts
}
