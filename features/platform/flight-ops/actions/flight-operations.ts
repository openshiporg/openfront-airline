'use server'

import { revalidatePath } from 'next/cache'
import { ClientError, GraphQLClient } from 'graphql-request'

import { getAuthHeaders } from '@/features/dashboard/lib/cookies'
import { getGraphQLEndpoint } from '@/features/dashboard/lib/getBaseUrl'
import type { FlightOperationsInput, FlightOperationsResult } from '@/features/platform/flight-ops/lib/types'

const FIELDS = ['departureTerminal', 'departureGate', 'arrivalTerminal', 'arrivalGate', 'estimatedDepartureAt', 'estimatedArrivalAt', 'actualDepartureAt', 'actualArrivalAt', 'status'] as const
// Domain and access errors carry deliberate wording; anything else stays generic.
const READABLE_CODES = new Set(['BAD_USER_INPUT', 'NOT_FOUND', 'FORBIDDEN', 'CONFLICT', 'RATE_LIMITED', 'KS_ACCESS_DENIED', 'UNAUTHENTICATED'])

function readableError(error: unknown, fallback: string) {
  if (error instanceof ClientError) {
    const first = error.response.errors?.find(entry => READABLE_CODES.has(String(entry.extensions?.code ?? '')))
    if (first?.message) return first.message
  }
  return fallback
}

export async function updateFlightOperationsAction(input: FlightOperationsInput): Promise<FlightOperationsResult> {
  if (!input?.flightInstanceId || typeof input.idempotencyKey !== 'string' || input.idempotencyKey.length < 12) return { success: false, error: 'Request is incomplete.' }
  const variables: Record<string, unknown> = { flightInstanceId: input.flightInstanceId, idempotencyKey: input.idempotencyKey }
  for (const field of FIELDS) if (input[field] !== undefined) variables[field] = input[field]
  if (Object.keys(variables).length === 2) return { success: false, error: 'Nothing to update.' }
  try {
    const client = new GraphQLClient(await getGraphQLEndpoint(), { credentials: 'include', redirect: 'error', headers: (await getAuthHeaders()) || {} })
    const data = await client.request<{ updateFlightOperations: { status: string; replayed: boolean } }>(
      `mutation UpdateFlightOperations($flightInstanceId: ID!, $departureTerminal: String, $departureGate: String, $arrivalTerminal: String, $arrivalGate: String, $estimatedDepartureAt: String, $estimatedArrivalAt: String, $actualDepartureAt: String, $actualArrivalAt: String, $status: String, $idempotencyKey: String!) {
        updateFlightOperations(flightInstanceId: $flightInstanceId, departureTerminal: $departureTerminal, departureGate: $departureGate, arrivalTerminal: $arrivalTerminal, arrivalGate: $arrivalGate, estimatedDepartureAt: $estimatedDepartureAt, estimatedArrivalAt: $estimatedArrivalAt, actualDepartureAt: $actualDepartureAt, actualArrivalAt: $actualArrivalAt, status: $status, idempotencyKey: $idempotencyKey) { status replayed }
      }`,
      variables,
    )
    revalidatePath('/dashboard/platform/flight-ops')
    return { success: true, status: data.updateFlightOperations.status, replayed: data.updateFlightOperations.replayed }
  } catch (error) {
    return { success: false, error: readableError(error, 'Flight could not be updated. Try again.') }
  }
}
