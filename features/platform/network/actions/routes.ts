'use server'

import { revalidatePath } from 'next/cache'

import { operatorCarrier, operatorGraphql } from '@/features/platform/network/lib/operator-graphql'
import { allowedTransition, ROUTE_TRANSITIONS, type ActionResult } from '@/features/platform/network/lib/desk-shared'
import type { RouteInput } from '@/features/platform/network/lib/types'

const NETWORK_PATH = '/dashboard/platform/network'

function optionalWhole(value: unknown, label: string): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === '') return { ok: true, value: null }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 2_147_483_647) return { ok: false, error: `${label} must be a whole number.` }
  return { ok: true, value }
}

async function airportCodes(originId: string, destinationId: string) {
  const response = await operatorGraphql<{ airports: Array<{ id: string; iataCode: string }> }>(
    'query RouteAirports($ids:[ID!]){ airports(where:{ id:{ in:$ids } }){ id iataCode } }',
    { ids: [originId, destinationId] },
  )
  if (!response.ok) return response
  const origin = response.data.airports.find(airport => airport.id === originId)
  const destination = response.data.airports.find(airport => airport.id === destinationId)
  if (!origin || !destination) return { ok: false as const, error: 'Choose an origin and a destination airport.' }
  return { ok: true as const, data: { origin: origin.iataCode, destination: destination.iataCode } }
}

function validate(input: RouteInput) {
  if (!input?.originId || !input?.destinationId) return { ok: false as const, error: 'Choose an origin and a destination airport.' }
  if (input.originId === input.destinationId) return { ok: false as const, error: 'Origin and destination must differ.' }
  const distance = optionalWhole(input.distanceKilometers, 'Distance')
  if (!distance.ok) return distance
  const connection = optionalWhole(input.minimumConnectionMinutes, 'Minimum connection')
  if (!connection.ok) return connection
  return { ok: true as const, distance: distance.value, connection: connection.value }
}

export async function createRouteAction(input: RouteInput): Promise<ActionResult> {
  const checked = validate(input)
  if (!checked.ok) return checked
  const carrier = await operatorCarrier()
  if (!carrier.ok) return carrier
  const codes = await airportCodes(input.originId, input.destinationId)
  if (!codes.ok) return codes
  const response = await operatorGraphql(
    'mutation CreateRoute($data:RouteCreateInput!){ createRoute(data:$data){ id } }',
    {
      data: {
        carrier: { connect: { id: carrier.data.id } },
        routeKey: `${carrier.data.code}:${codes.data.origin}:${codes.data.destination}`,
        origin: { connect: { id: input.originId } },
        destination: { connect: { id: input.destinationId } },
        status: 'draft',
        distanceKilometers: checked.distance,
        minimumConnectionMinutes: checked.connection,
        isInternational: Boolean(input.isInternational),
      },
    },
  )
  if (!response.ok) return response
  revalidatePath(NETWORK_PATH)
  return { ok: true }
}

export async function updateRouteAction(id: string, input: RouteInput): Promise<ActionResult> {
  const checked = validate(input)
  if (!checked.ok) return checked
  const current = await operatorGraphql<{ route: { id: string; origin: { id: string } | null; destination: { id: string } | null; carrier: { code: string } | null } | null }>(
    'query RouteForUpdate($id:ID!){ route(where:{ id:$id }){ id origin { id } destination { id } carrier { code } } }',
    { id },
  )
  if (!current.ok) return current
  const route = current.data.route
  if (!route) return { ok: false, error: 'Route not found.' }
  const data: Record<string, unknown> = {
    distanceKilometers: checked.distance,
    minimumConnectionMinutes: checked.connection,
    isInternational: Boolean(input.isInternational),
  }
  if (route.origin?.id !== input.originId || route.destination?.id !== input.destinationId) {
    const codes = await airportCodes(input.originId, input.destinationId)
    if (!codes.ok) return codes
    const carrierCode = route.carrier?.code
    if (!carrierCode) return { ok: false, error: 'Route carrier could not be read.' }
    data.routeKey = `${carrierCode}:${codes.data.origin}:${codes.data.destination}`
    data.origin = { connect: { id: input.originId } }
    data.destination = { connect: { id: input.destinationId } }
  }
  const response = await operatorGraphql('mutation UpdateRoute($id:ID!,$data:RouteUpdateInput!){ updateRoute(where:{ id:$id }, data:$data){ id } }', { id, data })
  if (!response.ok) return response
  revalidatePath(NETWORK_PATH)
  return { ok: true }
}

export async function setRouteStatusAction(id: string, to: string): Promise<ActionResult> {
  const current = await operatorGraphql<{ route: { status: string } | null }>('query RouteStatus($id:ID!){ route(where:{ id:$id }){ status } }', { id })
  if (!current.ok) return current
  const from = current.data.route?.status
  if (!from) return { ok: false, error: 'Route not found.' }
  if (!allowedTransition(ROUTE_TRANSITIONS, from, to)) return { ok: false, error: `Route cannot move from ${from} to ${to}.` }
  const response = await operatorGraphql('mutation SetRouteStatus($id:ID!,$status:RouteStatusType!){ updateRoute(where:{ id:$id }, data:{ status:$status }){ id } }', { id, status: to })
  if (!response.ok) return response
  revalidatePath(NETWORK_PATH)
  return { ok: true }
}
