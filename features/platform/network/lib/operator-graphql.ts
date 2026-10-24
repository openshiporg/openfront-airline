// Server-only GraphQL access for the network and fares server actions. Unlike keystoneClient, this keeps the
// deliberate (validation, access, domain) error messages the API already exposes so forms can show them inline.
// Unexpected errors are masked by the API and surface here as a fixed message.

import { getAuthHeaders } from '@/features/dashboard/lib/cookies'
import { getGraphQLEndpoint } from '@/features/dashboard/lib/getBaseUrl'

export type OperatorGraphqlResult<T> = { ok: true; data: T } | { ok: false; error: string }

export type OperatorCarrier = { id: string; code: string; defaultCurrencyCode: string | null }

const REQUEST_FAILED = 'The request failed. Try again.'

type GraphqlError = { message?: string; extensions?: { code?: string } }

function describeError(error: GraphqlError): string {
  const code = error.extensions?.code ?? ''
  const message = typeof error.message === 'string' ? error.message : ''
  if (/unique constraint/i.test(message)) return 'A record with the same key already exists.'
  if (!message || code === 'INTERNAL_SERVER_ERROR' || code === 'KS_PRISMA_ERROR' || /^prisma/i.test(message)) return REQUEST_FAILED
  if (code === 'KS_ACCESS_DENIED' || code === 'FORBIDDEN' || code === 'UNAUTHENTICATED') {
    return /access denied|not allowed|permission/i.test(message) ? 'Access denied for this change.' : message
  }
  const lines = message
    .split('\n')
    .map(line => line.replace(/^\s*-\s*/, '').trim())
    .filter(line => line && !/^you provided invalid data/i.test(line))
    .map(line => line.replace(/^[A-Z][A-Za-z]*(\.[A-Za-z]+)?:\s+/, ''))
  return lines.length ? lines.join(' ') : message
}

export async function operatorGraphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<OperatorGraphqlResult<T>> {
  try {
    const [endpoint, authHeaders] = await Promise.all([getGraphQLEndpoint(), getAuthHeaders()])
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(authHeaders || {}) },
      body: JSON.stringify({ query, variables }),
      redirect: 'error',
      cache: 'no-store',
    })
    const payload = (await response.json().catch(() => null)) as { data?: T | null; errors?: GraphqlError[] } | null
    if (payload?.errors?.length) return { ok: false, error: [...new Set(payload.errors.map(describeError))].join(' ') }
    if (!response.ok || !payload?.data) return { ok: false, error: REQUEST_FAILED }
    return { ok: true, data: payload.data }
  } catch {
    return { ok: false, error: REQUEST_FAILED }
  }
}

/** The signed-in operator's carrier; writes connect to it, never to a carrier sent by the browser. */
export async function operatorCarrier(): Promise<OperatorGraphqlResult<OperatorCarrier>> {
  const response = await operatorGraphql<{ authenticatedItem?: { carrier?: OperatorCarrier | null } | null }>(
    'query OperatorCarrier { authenticatedItem { ... on User { carrier { id code defaultCurrencyCode } } } }',
  )
  if (!response.ok) return response
  const carrier = response.data.authenticatedItem?.carrier
  if (!carrier?.id) return { ok: false, error: 'No carrier is linked to this account.' }
  return { ok: true, data: carrier }
}
