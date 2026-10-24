'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

type ActionResult = { ok: true } | { ok: false; error: string }

const STATIONS_PATH = '/dashboard/platform/stations'

function parseInstant(value: unknown): Date | null | 'invalid' {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return 'invalid'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'invalid' : date
}

function checkWindow(validFrom: unknown, validUntil: unknown): { from: Date | null; until: Date | null } | string {
  const from = parseInstant(validFrom)
  const until = parseInstant(validUntil)
  if (from === 'invalid') return 'Valid from is not a valid date.'
  if (until === 'invalid') return 'Valid until is not a valid date.'
  if (from && until && until <= from) return 'Valid until must be after valid from.'
  return { from, until }
}

export async function createStationAssignment(input: {
  userId: string
  airportId: string
  canCheckIn: boolean
  canAcceptBags: boolean
  canBoard: boolean
  validFrom: string | null
  validUntil: string | null
}): Promise<ActionResult> {
  if (!input.userId) return { ok: false, error: 'Select a user.' }
  if (!input.airportId) return { ok: false, error: 'Select an airport.' }
  if (!input.canCheckIn && !input.canAcceptBags && !input.canBoard) return { ok: false, error: 'Select at least one capability.' }
  const window = checkWindow(input.validFrom, input.validUntil)
  if (typeof window === 'string') return { ok: false, error: window }

  const lookup = await keystoneClient<{
    authenticatedItem: { carrier: { id: string } | null } | null
    airport: { id: string; iataCode: string | null; isActive: boolean | null } | null
    user: { id: string; carrier: { id: string } | null } | null
    stationAssignmentsCount: number | null
  }>(
    `query StationAssignmentCreateCheck($airportId: ID!, $userId: ID!) {
      authenticatedItem { ... on User { carrier { id } } }
      airport(where: { id: $airportId }) { id iataCode isActive }
      user(where: { id: $userId }) { id carrier { id } }
      stationAssignmentsCount(where: { user: { id: { equals: $userId } }, airport: { id: { equals: $airportId } }, status: { equals: active } })
    }`,
    { airportId: input.airportId, userId: input.userId },
  )
  if (!lookup.success) return { ok: false, error: lookup.error }
  const carrierId = lookup.data.authenticatedItem?.carrier?.id
  if (!carrierId) return { ok: false, error: 'Your account is not linked to a carrier.' }
  const airport = lookup.data.airport
  if (!airport?.iataCode) return { ok: false, error: 'Airport not found.' }
  if (!airport.isActive) return { ok: false, error: 'Station assignments require an active airport.' }
  if (lookup.data.user?.carrier?.id !== carrierId) return { ok: false, error: 'User not found for this carrier.' }
  if ((lookup.data.stationAssignmentsCount ?? 0) > 0) return { ok: false, error: `This user already has an active assignment at ${airport.iataCode}.` }

  const assignmentKey = `${input.userId}:${airport.iataCode}:${Date.now()}`
  const response = await keystoneClient<{ createStationAssignment: { id: string } | null }>(
    `mutation CreateStationAssignment($data: StationAssignmentCreateInput!) { createStationAssignment(data: $data) { id } }`,
    {
      data: {
        assignmentKey,
        carrier: { connect: { id: carrierId } },
        user: { connect: { id: input.userId } },
        airport: { connect: { id: input.airportId } },
        status: 'active',
        canCheckIn: Boolean(input.canCheckIn),
        canAcceptBags: Boolean(input.canAcceptBags),
        canBoard: Boolean(input.canBoard),
        ...(window.from ? { validFrom: window.from.toISOString() } : {}),
        validUntil: window.until ? window.until.toISOString() : null,
      },
    },
  )
  if (!response.success) return { ok: false, error: response.error }
  if (!response.data.createStationAssignment) return { ok: false, error: 'Assignment could not be created.' }
  revalidatePath(STATIONS_PATH)
  return { ok: true }
}

export async function updateStationAssignment(input: {
  id: string
  canCheckIn: boolean
  canAcceptBags: boolean
  canBoard: boolean
  validFrom: string | null
  validUntil: string | null
}): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: 'Assignment not found.' }
  if (!input.canCheckIn && !input.canAcceptBags && !input.canBoard) return { ok: false, error: 'Select at least one capability.' }
  const window = checkWindow(input.validFrom, input.validUntil)
  if (typeof window === 'string') return { ok: false, error: window }
  if (!window.from) return { ok: false, error: 'Valid from is required.' }

  const response = await keystoneClient<{ updateStationAssignment: { id: string } | null }>(
    `mutation UpdateStationAssignment($id: ID!, $data: StationAssignmentUpdateInput!) { updateStationAssignment(where: { id: $id }, data: $data) { id } }`,
    {
      id: input.id,
      data: {
        canCheckIn: Boolean(input.canCheckIn),
        canAcceptBags: Boolean(input.canAcceptBags),
        canBoard: Boolean(input.canBoard),
        validFrom: window.from.toISOString(),
        validUntil: window.until ? window.until.toISOString() : null,
      },
    },
  )
  if (!response.success) return { ok: false, error: response.error }
  if (!response.data.updateStationAssignment) return { ok: false, error: 'Assignment not found.' }
  revalidatePath(STATIONS_PATH)
  return { ok: true }
}

const TRANSITIONS: Record<string, string[]> = {
  active: ['suspended', 'revoked'],
  suspended: ['active', 'revoked'],
  revoked: [],
}

export async function setStationAssignmentStatus(id: string, status: 'active' | 'suspended' | 'revoked'): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'Assignment not found.' }
  const current = await keystoneClient<{ stationAssignment: { id: string; status: string | null } | null }>(
    `query StationAssignmentStatus($id: ID!) { stationAssignment(where: { id: $id }) { id status } }`,
    { id },
  )
  if (!current.success) return { ok: false, error: current.error }
  const from = current.data.stationAssignment?.status
  if (!from) return { ok: false, error: 'Assignment not found.' }
  if (!(TRANSITIONS[from] ?? []).includes(status)) return { ok: false, error: `Cannot change a ${from} assignment to ${status}.` }

  const response = await keystoneClient<{ updateStationAssignment: { id: string } | null }>(
    `mutation SetStationAssignmentStatus($id: ID!, $status: StationAssignmentStatusType!) { updateStationAssignment(where: { id: $id }, data: { status: $status }) { id } }`,
    { id, status },
  )
  if (!response.success) return { ok: false, error: response.error }
  if (!response.data.updateStationAssignment) return { ok: false, error: 'Assignment not found.' }
  revalidatePath(STATIONS_PATH)
  return { ok: true }
}
