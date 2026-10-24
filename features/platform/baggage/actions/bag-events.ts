'use server'

import { revalidatePath } from 'next/cache'
import { ClientError, GraphQLClient } from 'graphql-request'

import { getAuthHeaders } from '@/features/dashboard/lib/cookies'
import { getGraphQLEndpoint } from '@/features/dashboard/lib/getBaseUrl'
import type { RecordBagEventInput, RecordBagEventResult } from '@/features/platform/baggage/lib/types'

const ACTIONS = new Set(['load', 'transfer', 'arrive', 'deliver', 'delay', 'mishandle', 'close'])
// Domain and access errors carry deliberate wording; anything else stays generic.
const READABLE_CODES = new Set(['BAD_USER_INPUT', 'NOT_FOUND', 'FORBIDDEN', 'CONFLICT', 'RATE_LIMITED', 'KS_ACCESS_DENIED', 'UNAUTHENTICATED'])

function readableError(error: unknown, fallback: string) {
  if (error instanceof ClientError) {
    const first = error.response.errors?.find(entry => READABLE_CODES.has(String(entry.extensions?.code ?? '')))
    if (first?.message) return first.message
  }
  return fallback
}

export async function recordBagEventAction(input: RecordBagEventInput): Promise<RecordBagEventResult> {
  if (!input?.bagId || !ACTIONS.has(input.action) || typeof input.idempotencyKey !== 'string' || input.idempotencyKey.length < 12) return { success: false, error: 'Request is incomplete.' }
  const airportCode = input.airportCode?.trim().toUpperCase() || null
  if (airportCode && !/^[A-Z]{3}$/.test(airportCode)) return { success: false, error: 'Station must be a three-letter code.' }
  const note = input.note?.trim() || null
  if (note && note.length > 300) return { success: false, error: 'Note must be at most 300 characters.' }
  try {
    const client = new GraphQLClient(await getGraphQLEndpoint(), { credentials: 'include', redirect: 'error', headers: (await getAuthHeaders()) || {} })
    const data = await client.request<{ recordBagEvent: { status: string; replayed: boolean } }>(
      `mutation RecordBagEvent($bagId: ID!, $action: String!, $airportCode: String, $note: String, $idempotencyKey: String!) {
        recordBagEvent(bagId: $bagId, action: $action, airportCode: $airportCode, note: $note, idempotencyKey: $idempotencyKey) { status replayed }
      }`,
      { bagId: input.bagId, action: input.action, airportCode, note, idempotencyKey: input.idempotencyKey },
    )
    revalidatePath('/dashboard/platform/baggage')
    revalidatePath(`/dashboard/platform/baggage/${input.bagId}`)
    return { success: true, status: data.recordBagEvent.status, replayed: data.recordBagEvent.replayed }
  } catch (error) {
    return { success: false, error: readableError(error, 'Bag event could not be recorded. Try again.') }
  }
}
