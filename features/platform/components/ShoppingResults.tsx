'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { formatMinorUnits } from '@/features/keystone/lib/money'
import { Notice, Panel, Pill, Route, TitleLine, Track, Well, deskInput } from '@/features/platform/components/desk'
import { OptionSelect } from '@/features/platform/components/OptionSelect'

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
  const [added, setAdded] = useState<Passenger[]>([])
  const travelers = useMemo(() => [...added, ...passengers.filter(passenger => !added.some(entry => entry.id === passenger.id))], [added, passengers])
  const [passengerId, setPassengerId] = useState(passengers[0]?.id ?? '')
  const [adding, setAdding] = useState(passengers.length === 0)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageFailed, setMessageFailed] = useState(false)
  const [working, setWorking] = useState<string | null>(null)
  const flightTime = useMemo(() => new Intl.DateTimeFormat('en-US', { timeZone: defaultTimezone, hour: 'numeric', minute: '2-digit' }), [defaultTimezone])

  async function holdFlight(flight: Flight) {
    if (!passengerId) { setMessageFailed(true); return setMessage('Add or choose a traveler before holding a fare.') }
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

  // A caller who has never flown with the carrier: take the name here, without leaving the sale.
  async function addTraveler(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const text = (name: string) => String(form.get(name) ?? '').trim()
    setSaving(true); setMessageFailed(false); setMessage('')
    try {
      const run = async (query: string, variables?: Record<string, unknown>) => {
        const response = await fetch('/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify({ query, variables }) })
        const payload = await response.json() as { data?: { authenticatedItem?: { carrier?: { id: string; code: string } | null } | null; createPassenger?: Passenger }; errors?: Array<{ message: string }> }
        if (!response.ok || payload.errors?.length) throw new Error(payload.errors?.[0]?.message ?? 'The traveler could not be saved.')
        return payload.data ?? {}
      }
      const me = await run('{ authenticatedItem { ... on User { carrier { id code } } } }')
      const carrier = me.authenticatedItem?.carrier
            if (!carrier?.id) throw new Error('Your sign-in has no carrier. Ask an administrator.')
      const birth = text('dateOfBirth')
      const created = await run('mutation($data: PassengerCreateInput!) { createPassenger(data: $data) { id givenName familyName } }', { data: {
        passengerKey: `${carrier.code}:DESK:${crypto.randomUUID().replaceAll('-', '')}`,
        carrier: { connect: { id: carrier.id } },
        givenName: text('givenName'), familyName: text('familyName'),
        ...(birth ? { dateOfBirth: `${birth}T00:00:00.000Z` } : {}),
        email: text('email'), phone: text('phone'),
      } })
      const traveler = created.createPassenger
      if (!traveler) throw new Error('The traveler could not be saved.')
      setAdded(current => [traveler, ...current]); setPassengerId(traveler.id); setAdding(false)
      setMessage(`${traveler.givenName} ${traveler.familyName} added. Hold a fare below.`)
    } catch (error) {
      setMessageFailed(true); setMessage(error instanceof Error ? error.message : 'The traveler could not be saved.')
    } finally { setSaving(false) }
  }

  if (!flights.length) return <Well>No sellable flights match this search.</Well>
  return <div className="min-w-0 space-y-4">
    <div className="flex min-w-0 flex-wrap items-end gap-3">
      {travelers.length > 0 && <label className="flex min-w-0 max-w-sm flex-1 flex-col gap-1.5 text-sm font-medium text-muted-foreground">Traveler
        <OptionSelect className={`${deskInput} h-11 text-base`} value={passengerId} onChange={event => setPassengerId(event.target.value)}>
          {travelers.map(passenger => <option key={passenger.id} value={passenger.id}>{passenger.givenName} {passenger.familyName}</option>)}
        </OptionSelect>
      </label>}
      {!adding && <Track><Pill onClick={() => setAdding(true)}>New traveler</Pill></Track>}
    </div>
    {adding && <form onSubmit={addTraveler} className="grid gap-3 rounded-[4px] border bg-card p-4 sm:grid-cols-2">
      <p className="text-sm font-semibold sm:col-span-2">New traveler</p>
      {([['givenName', 'First name', 'text', true], ['familyName', 'Last name', 'text', true], ['dateOfBirth', 'Date of birth', 'date', true], ['email', 'Email', 'email', true], ['phone', 'Phone (optional)', 'tel', false]] as const).map(([name, text, type, required]) => <label key={name} className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-muted-foreground">{text}
        <input name={name} type={type} required={required} autoComplete="off" className={`${deskInput} h-11 text-base`} />
      </label>)}
      <div className="flex flex-wrap gap-2 sm:col-span-2"><Track><Pill variant="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add traveler'}</Pill>{travelers.length > 0 && <Pill type="button" onClick={() => setAdding(false)}>Cancel</Pill>}</Track></div>
    </form>}
    {message && <Notice tone={messageFailed ? 'bad' : 'ok'} role={messageFailed ? 'alert' : 'status'}>{message}</Notice>}
    <Panel className="divide-y">
      {flights.map(flight => {
        const available = flight.availability.available
        return <article key={`${flight.id}:${flight.inventoryBucketId}`} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3">
          <div className="min-w-0">
            <TitleLine tone={available ? 'ok' : 'bad'} status={available ? 'Available' : 'Sold out'} className="text-sm">
              <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="tabular-nums font-semibold  text-foreground">{flight.flightNumber}</span>
                <Route from={flight.originCode} to={flight.destinationCode} />
              </span>
            </TitleLine>
            <p className="mt-0.5 pl-4 text-xs text-muted-foreground">
              <span className="tabular-nums ">{flightTime.format(new Date(flight.scheduledDepartureAt))}–{flightTime.format(new Date(flight.scheduledArrivalAt))}</span>
              <span> · {flight.fareBrand.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="tabular-nums text-sm font-semibold  text-foreground">{formatMinorUnits(flight.totalAmount, flight.currencyCode)}</p>
              <p className="tabular-nums text-xs  text-muted-foreground">{available} left</p>
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
