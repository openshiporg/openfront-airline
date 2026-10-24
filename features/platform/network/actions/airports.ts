'use server'

import { revalidatePath } from 'next/cache'

import { operatorGraphql } from '@/features/platform/network/lib/operator-graphql'
import type { ActionResult } from '@/features/platform/network/lib/desk-shared'
import type { AirportInput } from '@/features/platform/network/lib/types'

export async function registerAirportAction(input: AirportInput): Promise<ActionResult & { status?: string }> {
  const iataCode = String(input.iataCode ?? '').trim().toUpperCase()
  const icaoCode = String(input.icaoCode ?? '').trim().toUpperCase()
  const countryCode = String(input.countryCode ?? '').trim().toUpperCase()
  const idempotencyKey = String(input.idempotencyKey ?? '').trim()
  if (!/^[A-Z]{3}$/.test(iataCode)) return { ok: false, error: 'IATA code must be three letters.' }
  if (icaoCode && !/^[A-Z]{4}$/.test(icaoCode)) return { ok: false, error: 'ICAO code must be four letters.' }
  if (!/^[A-Z]{2}$/.test(countryCode)) return { ok: false, error: 'Country must be a two-letter ISO code.' }
  if (idempotencyKey.length < 12 || idempotencyKey.length > 200) return { ok: false, error: 'Submit the form again.' }
  const response = await operatorGraphql<{ registerAirport: { resourceId: string; status: string } }>(
    `mutation RegisterAirport($iataCode:String!,$icaoCode:String,$name:String!,$city:String!,$countryCode:String!,$subdivisionCode:String,$timezone:String!,$idempotencyKey:String!){
      registerAirport(iataCode:$iataCode,icaoCode:$icaoCode,name:$name,city:$city,countryCode:$countryCode,subdivisionCode:$subdivisionCode,timezone:$timezone,idempotencyKey:$idempotencyKey){ resourceId status }
    }`,
    {
      iataCode,
      icaoCode: icaoCode || null,
      name: String(input.name ?? '').trim(),
      city: String(input.city ?? '').trim(),
      countryCode,
      subdivisionCode: String(input.subdivisionCode ?? '').trim() || null,
      timezone: String(input.timezone ?? '').trim(),
      idempotencyKey,
    },
  )
  if (!response.ok) return response
  revalidatePath('/dashboard/platform/network')
  return { ok: true, status: response.data.registerAirport.status }
}
