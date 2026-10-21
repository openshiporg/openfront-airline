'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { formatMinorUnits } from '@/features/keystone/lib/money'

type Flight = {
  id: string
  inventoryBucketId: string
  flightNumber: string
  scheduledDepartureAt: string
  scheduledArrivalAt: string
  originCode: string
  destinationCode: string
  fareBrand: { code: string; name: string }
  currencyCode: string
  totalAmount: number
  availability: { available: number }
}

type Passenger = { id: string; givenName: string; familyName: string }

export function ShoppingResults({ flights, passengers, defaultTimezone }: { flights: Flight[]; passengers: Passenger[]; defaultTimezone: string }) {
  const router = useRouter()
  const [passengerId, setPassengerId] = useState(passengers[0]?.id ?? '')
  const [message, setMessage] = useState('')
  const [messageFailed, setMessageFailed] = useState(false)
  const [working, setWorking] = useState<string | null>(null)
  const flightTime = useMemo(() => new Intl.DateTimeFormat('en-US', { timeZone: defaultTimezone, hour: 'numeric', minute: '2-digit' }), [defaultTimezone])

  async function holdFlight(flight: Flight) {
    if (!passengerId) { setMessageFailed(true); return setMessage('Create or select a passenger before holding a fare.') }
    setWorking(flight.id)
    setMessageFailed(false)
    setMessage('')
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          query: `mutation CreateOffer($flight: ID!, $bucket: ID!, $passengers: [ID!]!, $key: String!) {
            createOfferFromShopping(flightInstanceId: $flight, inventoryBucketId: $bucket, passengerIds: $passengers, idempotencyKey: $key) {
              offerId offerNumber status totalAmount currencyCode expiresAt replayed
            }
          }`,
          variables: { flight: flight.id, bucket: flight.inventoryBucketId, passengers: [passengerId], key: `offer-${crypto.randomUUID()}` },
        }),
      })
      const payload = await response.json() as { data?: { createOfferFromShopping?: { offerNumber: string; status: string; totalAmount: number; currencyCode: string; expiresAt?: string | null } }; errors?: Array<{ message: string }> }
      if (!response.ok || payload.errors?.length) { setMessageFailed(true); return setMessage(payload.errors?.[0]?.message ?? 'The offer could not be held.') }
      const offer = payload.data?.createOfferFromShopping
      const expiry = offer?.expiresAt ? ` until ${new Intl.DateTimeFormat('en-US', { timeZone: defaultTimezone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(offer.expiresAt))}` : ''
      setMessage(offer ? `Held ${offer.offerNumber} · ${formatMinorUnits(offer.totalAmount, offer.currencyCode)}${expiry}.` : 'Offer held.')
      router.refresh()
    } catch {
      setMessageFailed(true)
      setMessage('The offer could not be held. Check your connection and try again.')
    } finally {
      setWorking(null)
    }
  }

  if (!flights.length) return <div className="rounded-2xl border border-dashed p-8 text-sm text-muted-foreground">No sellable flights matched this search.</div>
  return <div className="space-y-4">
    <label className="block text-sm font-medium">Passenger
      <select className="mt-2 w-full rounded-lg border bg-background px-3 py-2" value={passengerId} onChange={event => setPassengerId(event.target.value)}>
        {passengers.map(passenger => <option key={passenger.id} value={passenger.id}>{passenger.givenName} {passenger.familyName}</option>)}
      </select>
    </label>
    {!passengers.length && <p className="text-sm text-muted-foreground">No passengers yet. <Link href="/dashboard/passengers/create" className="font-medium underline">Create a passenger</Link> to hold a fare.</p>}
    {message && <p role={messageFailed ? 'alert' : 'status'} className={`rounded-lg px-3 py-2 text-sm ${messageFailed ? 'bg-destructive/10 text-destructive' : 'bg-primary/10'}`}>{message}</p>}
    {flights.map(flight => <article key={`${flight.id}:${flight.inventoryBucketId}`} className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div><p className="text-lg font-semibold">{flight.originCode} → {flight.destinationCode}</p><p className="text-sm text-muted-foreground">Flight {flight.flightNumber} · {flightTime.format(new Date(flight.scheduledDepartureAt))}–{flightTime.format(new Date(flight.scheduledArrivalAt))}</p></div>
      <div className="text-left md:text-right"><p className="font-semibold">{formatMinorUnits(flight.totalAmount, flight.currencyCode)}</p><p className="text-sm text-muted-foreground">{flight.fareBrand.name} · {flight.availability.available} seats left</p><button className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={!flight.availability.available || working === flight.id} onClick={() => holdFlight(flight)}>{working === flight.id ? 'Holding…' : 'Hold fare'}</button></div>
    </article>)}
  </div>
}
