'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { formatMinorUnits } from '@/features/keystone/lib/money'
import { Notice, Panel, Pill, Route, TitleLine, Track, Well, deskInput } from '@/features/platform/components/desk'

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

  if (!flights.length) return <Well>No sellable flights match this search.</Well>
  return <div className="min-w-0 space-y-4">
    <label className="flex min-w-0 max-w-sm flex-col gap-1.5 text-xs font-medium text-muted-foreground">Passenger
      <select className={deskInput} value={passengerId} onChange={event => setPassengerId(event.target.value)}>
        {passengers.map(passenger => <option key={passenger.id} value={passenger.id}>{passenger.givenName} {passenger.familyName}</option>)}
      </select>
    </label>
    {!passengers.length && <Notice tone="warn">No passengers. <Link href="/dashboard/passengers/create" className="font-medium underline underline-offset-2">Create a passenger</Link></Notice>}
    {message && <Notice tone={messageFailed ? 'bad' : 'ok'} role={messageFailed ? 'alert' : 'status'}>{message}</Notice>}
    <Panel className="divide-y">
      {flights.map(flight => {
        const available = flight.availability.available
        return <article key={`${flight.id}:${flight.inventoryBucketId}`} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3">
          <div className="min-w-0">
            <TitleLine tone={available ? 'ok' : 'bad'} status={available ? 'Available' : 'Sold out'} className="text-sm">
              <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono font-semibold tabular-nums text-foreground">{flight.flightNumber}</span>
                <Route from={flight.originCode} to={flight.destinationCode} />
              </span>
            </TitleLine>
            <p className="mt-0.5 pl-4 text-xs text-muted-foreground">
              <span className="font-mono tabular-nums">{flightTime.format(new Date(flight.scheduledDepartureAt))}–{flightTime.format(new Date(flight.scheduledArrivalAt))}</span>
              <span> · {flight.fareBrand.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-mono text-sm font-semibold tabular-nums text-foreground">{formatMinorUnits(flight.totalAmount, flight.currencyCode)}</p>
              <p className="font-mono text-xs tabular-nums text-muted-foreground">{available} left</p>
            </div>
            <Track>
              <Pill variant="primary" disabled={!available || working === flight.id} onClick={() => holdFlight(flight)}>{working === flight.id ? 'Holding…' : 'Hold fare'}</Pill>
            </Track>
          </div>
        </article>
      })}
    </Panel>
  </div>
}
