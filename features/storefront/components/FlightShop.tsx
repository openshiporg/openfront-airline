'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'

import type { PublicCarrierIdentity } from '@/features/storefront/lib/carrier'
import { parseBookingAccessForm, parseStorefrontPassengers, parseStorefrontSearchForm } from '@/features/storefront/lib/forms'
import { bookingIntentVariables, CUSTOMER_BOOKING_COMMAND, CUSTOMER_BOOKING_READ, parsePendingBookingIntent, type BookingReceipt, type PendingBookingIntent } from '@/features/storefront/lib/booking-intent'
import { formatMinorUnits } from '@/features/keystone/lib/money'
import { OutcomeUnknownError, postGraphql as graphql } from '@/features/storefront/lib/request-errors'

type Flight = {
  id: string
  inventoryBucketId: string
  flightNumber: string
  serviceDate: string
  scheduledDepartureAt: string
  scheduledArrivalAt: string
  originCode: string
  destinationCode: string
  fareBrand: { name: string }
  totalAmount: number
  perTravelerBaseAmount: number
  perTravelerTaxAmount: number
  perTravelerTotalAmount: number
  partyTotalAmount: number
  passengerCount: number
  currencyCode: string
  availability: { available: number }
}
export type FlightShopMode = 'book' | 'manage' | 'check-in'
type HeldOffer = { offerId: string; offerNumber: string; passengerIds: string[]; totalAmount: number; currencyCode: string; expiresAt: string }
type BoardingPass = { id: string; passNumber: string; status: string; barcodeToken: string; seatDesignatorSnapshot?: string | null; boardingGroup?: string | null; boardingZone?: string | null; gateSnapshot?: string | null; terminalSnapshot?: string | null }
type CustomerBooking = {
  id: string
  recordLocator: string
  status: string
  paymentStatus: string
  ticketingStatus: string
  totalAmount: number
  currencyCode: string
  bookingReceipt: BookingReceipt
  carrier: { id: string; code: string; name: string }
  passengers: Array<{ id: string; passenger: { givenName: string; familyName: string }; acceptedName?: { givenName: string; familyName: string } | null }>
  segments: Array<{ id: string; status: string; flightNumber: string; flightStatus?: string; serviceDate?: string | null; scheduledDepartureAt?: string; scheduledArrivalAt?: string; estimatedDepartureAt?: string | null; estimatedArrivalAt?: string | null; actualDepartureAt?: string | null; actualArrivalAt?: string | null; originCode: string; destinationCode: string; originTimezone?: string | null; destinationTimezone?: string | null; seats: Array<{ id: string; designator: string; seatType: string; surchargeAmount: number; currencyCode: string; isAvailable: boolean; selectedForPassengerId?: string | null }> }>
  checkIns: Array<{ id: string; bookingPassengerId: string; bookingSegmentId: string; status: string; offloadedAt?: string | null; boardingPass?: BoardingPass | null }>
}

const bookingStatusLabels: Record<string, string> = { pending: 'Awaiting payment', confirmed: 'Confirmed', ticketed: 'Ticketed', in_progress: 'Travelling', completed: 'Completed', cancelled: 'Cancelled' }
const paymentStatusLabels: Record<string, string> = { unpaid: 'Not paid yet', failed: 'Payment failed', paid: 'Paid', partially_refunded: 'Partly refunded', refunded: 'Refunded' }
const ticketStatusLabels: Record<string, string> = { not_ticketed: 'Not issued yet', ticketed: 'Issued', voided: 'Voided' }
const segmentStatusLabels: Record<string, string> = { confirmed: 'Confirmed', checked_in: 'Checked in', boarded: 'Boarded', flown: 'Flown', offloaded: 'Offloaded', disrupted: 'Disrupted', reaccommodated: 'Replaced by a new flight', cancelled: 'Cancelled', refunded: 'Refunded' }
const checkInStatusLabels: Record<string, string> = { checked_in: 'Checked in', boarded: 'Boarded', offloaded: 'Offloaded', cancelled: 'Check-in cancelled' }
const label = (labels: Record<string, string>, value: string) => labels[value] ?? value.replaceAll('_', ' ')
type Tone = 'ok' | 'warn' | 'bad' | undefined
const tripTone = (status: string): Tone => ['confirmed', 'ticketed', 'in_progress', 'completed'].includes(status) ? 'ok' : status === 'cancelled' ? 'bad' : 'warn'
const segmentTone = (status: string): Tone => ['confirmed', 'checked_in', 'boarded', 'flown'].includes(status) ? 'ok' : ['cancelled', 'offloaded', 'refunded'].includes(status) ? 'bad' : 'warn'
const checkInTone = (status: string): Tone => ['checked_in', 'boarded'].includes(status) ? 'ok' : 'bad'
const passengerFieldLabels = { givenName: 'Given name', familyName: 'Family name', dateOfBirth: 'Date of birth', email: 'Email', phone: 'Phone (optional)' } as const

// Mirrors the server gate in assignCustomerSeat: ticket issuance refuses bookings that already hold seat artifacts.
function seatSelectionOpen(booking: { status: string; paymentStatus: string; ticketingStatus: string }) {
  return ['ticketed', 'in_progress'].includes(booking.status) && booking.paymentStatus === 'paid' && booking.ticketingStatus === 'ticketed'
}

// Airport-local time with an explicit zone, so travelers outside the carrier timezone read the right date.
function localTime(value: string | null | undefined, timeZone: string | null | undefined) {
  if (!value) return null
  try { return new Intl.DateTimeFormat('en-US', { timeZone: timeZone || 'UTC', dateStyle: 'medium', timeStyle: 'short', timeZoneName: 'short' }).format(new Date(value)) }
  catch { return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short', timeZoneName: 'short' }).format(new Date(value)) }
}

export function FlightShop({ initialDate, carrier, mode = 'book' }: { initialDate: string; carrier: PublicCarrierIdentity; mode?: FlightShopMode }) {
  const storagePrefix = `airline:${carrier.code.toLowerCase()}`
  const shoppingEnabled = mode === 'book'
  const [flights, setFlights] = useState<Flight[]>([])
  const [selected, setSelected] = useState<Flight | null>(null)
  const [heldOffer, setHeldOffer] = useState<HeldOffer | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [recordLocator, setRecordLocator] = useState('')
  const [accessToken, setAccessToken] = useState('')
  // The displayed access code belongs to exactly one booking; it is never shown under another booking's reference.
  const [confirmation, setConfirmation] = useState<{ recordLocator: string; carrierCode: string; token: string } | null>(null)
  // One key per deliberate seat choice; kept only while that choice's outcome is unknown, so a retry cannot apply twice.
  const seatIntent = useRef<{ passengerId: string; segmentId: string; seatId: string; key: string } | null>(null)
  const [managedBooking, setManagedBooking] = useState<CustomerBooking | null>(null)
  const bookingAttempt = useRef<{ offerKey: string; bookingKey: string } | null>(null)
  const [pendingBooking, setPendingBooking] = useState<PendingBookingIntent | null>(null)
  const [intentUnavailable, setIntentUnavailable] = useState(false)
  const intentStorageKey = `${storagePrefix}:original-booking-intent`
  useEffect(() => {
    try { setPendingBooking(parsePendingBookingIntent(sessionStorage.getItem(intentStorageKey))) }
    catch (error) { setIntentUnavailable(true); setStatus(error instanceof Error ? error.message : 'Original booking intent is unavailable; do not create a replacement.') }
  }, [intentStorageKey])
  const recordLocatorInput = useRef<HTMLInputElement>(null)
  const accessTokenInput = useRef<HTMLInputElement>(null)
  const money = useMemo(() => (amount: number) => formatMinorUnits(amount, selected?.currencyCode ?? carrier.defaultCurrencyCode), [selected?.currencyCode, carrier.defaultCurrencyCode])
  const departureDateTime = useMemo(() => new Intl.DateTimeFormat('en-US', { timeZone: carrier.defaultTimezone, dateStyle: 'medium', timeStyle: 'short' }), [carrier.defaultTimezone])
  const arrivalTime = useMemo(() => new Intl.DateTimeFormat('en-US', { timeZone: carrier.defaultTimezone, timeStyle: 'short' }), [carrier.defaultTimezone])
  const flightDuration = (departure: string, arrival: string) => {
    const minutes = Math.round((Date.parse(arrival) - Date.parse(departure)) / 60_000)
    return Number.isFinite(minutes) && minutes > 0 ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m` : null
  }
  const adultBirthDateMax = useMemo(() => { const serviceDate = selected?.serviceDate; if (!serviceDate || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) return undefined; const value = new Date(`${serviceDate}T00:00:00.000Z`); value.setUTCFullYear(value.getUTCFullYear() - 18); return value.toISOString().slice(0, 10) }, [selected?.serviceDate])

  function shoppingToken() {
    const key = `${storagePrefix}:shopping-session`
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const created = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '')
    localStorage.setItem(key, created)
    return created
  }
  function bookingKey(locator: string) { return `${storagePrefix}:booking:${locator.toUpperCase()}` }
  function setBookingCredentials(locator: string, token: string) {
    setRecordLocator(locator)
    setAccessToken(token)
    if (recordLocatorInput.current) recordLocatorInput.current.value = locator
    if (accessTokenInput.current) accessTokenInput.current.value = token
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pendingBooking || intentUnavailable) { setStatus('Check your previous reservation request first. It may have gone through even if the page didn’t confirm it.'); return }
    setBusy(true); setStatus(''); setFlights([]); setSelected(null); setHeldOffer(null); bookingAttempt.current = null
    try {
      const input = parseStorefrontSearchForm(new FormData(event.currentTarget))
      const data = await graphql<{ publicAirlineFlightOptions: Flight[] }>(`query($carrier:String!,$origin:String!,$destination:String!,$date:String!,$passengers:Int!){publicAirlineFlightOptions(carrierCode:$carrier,originCode:$origin,destinationCode:$destination,serviceDate:$date,passengerCount:$passengers){id inventoryBucketId flightNumber serviceDate scheduledDepartureAt scheduledArrivalAt originCode destinationCode fareBrand{name} totalAmount perTravelerBaseAmount perTravelerTaxAmount perTravelerTotalAmount partyTotalAmount passengerCount currencyCode availability{available}}}`, { carrier: carrier.code, origin: input.originCode, destination: input.destinationCode, date: input.serviceDate, passengers: input.passengerCount })
      setFlights(data.publicAirlineFlightOptions)
      if (!data.publicAirlineFlightOptions.length) setStatus(`No ${carrier.name} flights are available for this route, date, and party size.`)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Search failed.') }
    setBusy(false)
  }

  async function holdOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || pendingBooking || intentUnavailable) return
    setBusy(true); setStatus('')
    try {
      const token = shoppingToken()
      const passengers = parseStorefrontPassengers(new FormData(event.currentTarget), selected.passengerCount)
      const attempt = bookingAttempt.current ?? { offerKey: `web-offer-${crypto.randomUUID()}`, bookingKey: `web-booking-${crypto.randomUUID()}` }
      bookingAttempt.current = attempt
      const data = await graphql<{ createCustomerOffer: HeldOffer }>(`mutation($carrier:String!,$flight:ID!,$bucket:ID!,$token:String!,$key:String!,$passengers:[CustomerPassengerInput!]!){createCustomerOffer(carrierCode:$carrier,flightInstanceId:$flight,inventoryBucketId:$bucket,shoppingSessionToken:$token,idempotencyKey:$key,passengers:$passengers){offerId offerNumber passengerIds totalAmount currencyCode expiresAt}}`, { carrier: carrier.code, flight: selected.id, bucket: selected.inventoryBucketId, token, key: attempt.offerKey, passengers })
      setHeldOffer(data.createCustomerOffer)
      setStatus(`Your fare is held (${data.createCustomerOffer.offerNumber}). Review the total below and confirm by ${new Date(data.createCustomerOffer.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}.`)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'The fare could not be held.') }
    setBusy(false)
  }

  async function confirmBooking(recoverOnly = false) {
    if (intentUnavailable || (!pendingBooking && (!heldOffer || !bookingAttempt.current))) return
    setBusy(true); setStatus('')
    try {
      let intent = pendingBooking
      if (!intent) {
        if (!heldOffer || !bookingAttempt.current) return
        if (Date.parse(heldOffer.expiresAt) <= Date.now()) throw new Error('This hold expired before any booking command was sent. Search again for a new hold.')
        intent = { version: 1, offerId: heldOffer.offerId, passengerIds: [...heldOffer.passengerIds], shoppingSessionToken: shoppingToken(), idempotencyKey: bookingAttempt.current.bookingKey, totalAmount: heldOffer.totalAmount, currencyCode: heldOffer.currencyCode, expiresAt: heldOffer.expiresAt }
        // Persist BEFORE dispatch. A failed storage write must not send a command.
        sessionStorage.setItem(intentStorageKey, JSON.stringify(intent))
        setPendingBooking(intent)
      }
      const bookingData = await graphql<{ createCustomerBooking: { recordLocator: string; status: string; bookingAccessToken: string | null; bookingReceipt: BookingReceipt } }>(CUSTOMER_BOOKING_COMMAND, bookingIntentVariables(intent, recoverOnly))
      const created = bookingData.createCustomerBooking
      if (!created.bookingAccessToken || created.bookingReceipt?.accessState !== 'current') throw new Error('We couldn’t confirm this reservation from this browser. Check it with your booking reference and access code, or contact the airline.')
      localStorage.setItem(bookingKey(created.recordLocator), created.bookingAccessToken)
      setBookingCredentials(created.recordLocator, created.bookingAccessToken); setConfirmation({ recordLocator: created.recordLocator, carrierCode: carrier.code, token: created.bookingAccessToken })
      sessionStorage.removeItem(intentStorageKey); setPendingBooking(null)
      bookingAttempt.current = null; setHeldOffer(null); setSelected(null)
      setStatus(`Reservation ${created.recordLocator} is confirmed and awaiting payment.`)
      try {
        const current = await graphql<{ customerBooking: CustomerBooking }>(CUSTOMER_BOOKING_READ, { record: created.recordLocator, token: created.bookingAccessToken })
        setManagedBooking(current.customerBooking)
      } catch { setStatus(`Reservation ${created.recordLocator} is confirmed, but we couldn’t load it yet. Use Retrieve with your access code; don’t book again.`) }
    } catch (error) {
      setStatus(`${error instanceof Error ? error.message : 'We couldn’t confirm your reservation.'} We may still have received it, even if the fare hold has expired. Check its status below before booking again.`)
    } finally { setBusy(false) }
  }

  // `refreshAfterChange` rereads the current booking after a successful command without erasing that command's
  // announced result; a failed refresh says so instead of suggesting the command failed.
  async function manage(event?: FormEvent<HTMLFormElement>, refreshAfterChange = false) {
    event?.preventDefault(); setBusy(true)
    if (!refreshAfterChange) setStatus('')
    try {
      const submitted = event ? parseBookingAccessForm(new FormData(event.currentTarget)) : { recordLocator, accessToken }
      const saved = submitted.accessToken || localStorage.getItem(bookingKey(submitted.recordLocator)) || ''
      if (!saved) throw new Error('Enter the access code from your confirmation.')
      const data = await graphql<{ customerBooking: CustomerBooking }>(CUSTOMER_BOOKING_READ, { record: submitted.recordLocator, token: saved })
      if (confirmation && confirmation.recordLocator !== data.customerBooking.recordLocator) setConfirmation(null)
      setBookingCredentials(submitted.recordLocator, saved); setManagedBooking(data.customerBooking)
    } catch (error) {
      if (refreshAfterChange) setStatus(current => `${current} We couldn’t refresh your booking just now; retrieve it again to see the latest details.`)
      else { setManagedBooking(null); setConfirmation(null); setStatus(error instanceof Error ? error.message : 'Booking could not be retrieved.') }
    }
    setBusy(false)
  }

  async function rotateAccess() {
    if (!window.confirm('Replace your booking access code? The current code stops working immediately, so save the new one before leaving this page.')) return
    setBusy(true)
    try {
      const data = await graphql<{ rotateCustomerBookingAccessToken: { recordLocator: string; accessToken: string } }>(`mutation($record:String!,$token:String!){rotateCustomerBookingAccessToken(recordLocator:$record,accessToken:$token){recordLocator accessToken}}`, { record: recordLocator, token: accessToken })
      const next = data.rotateCustomerBookingAccessToken.accessToken
      localStorage.setItem(bookingKey(recordLocator), next); setBookingCredentials(recordLocator, next); setConfirmation({ recordLocator, carrierCode: carrier.code, token: next }); setStatus('New access code created. Save it now; the old code no longer works.')
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Credential rotation failed.') }
    setBusy(false)
  }

  async function cancelBooking() {
    if (!window.confirm('Cancel this booking? Your seats will be released and this cannot be undone.')) return
    setBusy(true)
    try {
      await graphql(`mutation($record:String!,$token:String!,$reason:String!,$key:String!){cancelCustomerBooking(recordLocator:$record,accessToken:$token,reason:$reason,idempotencyKey:$key){status}}`, { record: recordLocator, token: accessToken, reason: 'Traveler cancelled before departure through self-service.', key: `customer-cancel-${managedBooking?.id ?? recordLocator}` })
      setStatus('Booking cancelled. Your seats have been released.'); await manage(undefined, true)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Cancellation failed.') }
    setBusy(false)
  }

  async function chooseSeat(passengerId: string, segmentId: string, seat: { id: string; surchargeAmount: number }) {
    if (seat.surchargeAmount > 0) { setStatus('Paid seats can’t be selected online.'); return }
    const current = seatIntent.current
    // Reuse the key only to retry the same choice whose outcome was unknown; any new choice (even A → B → A) gets its own.
    const intent = current && current.passengerId === passengerId && current.segmentId === segmentId && current.seatId === seat.id
      ? current
      : { passengerId, segmentId, seatId: seat.id, key: `seat-${crypto.randomUUID()}` }
    seatIntent.current = intent
    setBusy(true)
    try {
      const data = await graphql<{ assignCustomerSeat: { status: string; replayed?: boolean | null } }>(`mutation($record:String!,$token:String!,$passenger:ID!,$segment:ID!,$seat:ID!,$key:String!){assignCustomerSeat(recordLocator:$record,accessToken:$token,bookingPassengerId:$passenger,bookingSegmentId:$segment,seatId:$seat,idempotencyKey:$key){status replayed}}`, { record: recordLocator, token: accessToken, passenger: passengerId, segment: segmentId, seat: seat.id, key: intent.key })
      seatIntent.current = null
      setStatus(data.assignCustomerSeat.replayed ? 'This seat choice was already recorded. Your current seat is shown below.' : 'Seat selected.')
      await manage(undefined, true)
    } catch (error) {
      if (!(error instanceof OutcomeUnknownError)) seatIntent.current = null
      setStatus(error instanceof Error ? error.message : 'Seat selection failed.')
    }
    setBusy(false)
  }

  async function customerCheckIn(passengerId: string, segmentId: string, retryMarker = 'initial') {
    setBusy(true)
    try { await graphql(`mutation($record:String!,$token:String!,$passenger:ID!,$segment:ID!,$key:String!){checkInCustomerBooking(recordLocator:$record,accessToken:$token,bookingPassengerId:$passenger,bookingSegmentId:$segment,idempotencyKey:$key){status}}`, { record: recordLocator, token: accessToken, passenger: passengerId, segment: segmentId, key: `customer-checkin-${passengerId}-${segmentId}-${retryMarker}` }); setStatus(`Check-in completed with ${carrier.name}. Boarding-pass details are shown below.`); await manage(undefined, true) }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Check-in failed.') }
    setBusy(false)
  }

  const passLabel = selected ? `${selected.passengerCount} traveler${selected.passengerCount === 1 ? '' : 's'}` : ''

  return <div className="space-y-6">
    {shoppingEnabled && <form onSubmit={search} className="af-card relative z-10 p-4 shadow-[0_24px_48px_-24px_rgb(15_27_45/0.45)] sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.1fr_0.9fr_auto] lg:items-end">
        <label className="af-field"><span className="af-field-label">From</span><input aria-label="Origin airport" name="originCode" defaultValue="JFK" autoCapitalize="characters" autoComplete="off" inputMode="text" pattern="[A-Za-z0-9]{3}" maxLength={3} required className="af-input af-input-code text-lg" /></label>
        <label className="af-field"><span className="af-field-label">To</span><input aria-label="Destination airport" name="destinationCode" defaultValue="BOS" autoCapitalize="characters" autoComplete="off" inputMode="text" pattern="[A-Za-z0-9]{3}" maxLength={3} required className="af-input af-input-code text-lg" /></label>
        <label className="af-field"><span className="af-field-label">Departure</span><input aria-label="Departure date" name="serviceDate" type="date" defaultValue={initialDate} required className="af-input" /></label>
        <label className="af-field"><span className="af-field-label">Adults 18+</span><select aria-label="Adult travelers, 18 or older on the departure date" name="passengerCount" defaultValue="1" className="af-input">{Array.from({ length: 9 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
        <div className="af-track sm:col-span-2 lg:col-span-1" data-block="true"><button disabled={busy} className="af-pill af-pill-primary min-h-11 px-6">{busy ? 'Searching…' : 'Search flights'}</button></div>
      </div>
      <p className="af-mono mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] uppercase tracking-[0.12em] text-[var(--af-ink-3)]"><span>Reservation only</span><span>Pay the airline directly</span><span>Unpaid holds expire in 24 h</span><span>Adults 18+ on departure</span></p>
    </form>}
    {status && <p role="status" className="af-notice" data-tone={/fail|couldn|can’t|cannot|expired|invalid|unavailable|not available|enter /i.test(status) ? 'warn' : 'ok'}><span className="af-dot" data-tone={/fail|couldn|can’t|cannot|expired|invalid|unavailable|not available|enter /i.test(status) ? 'warn' : 'ok'} />{status}</p>}
    {pendingBooking && <section aria-label="Original reservation command recovery" className="af-notice flex-col items-stretch gap-3 p-5" data-tone="warn">
      <h2 className="af-title-line font-semibold"><span className="af-dot" data-tone="warn" />We’re checking your reservation</h2>
      <p>Your request is saved in this tab. Checking never creates a booking, and a retry sends the same request.</p>
      <div className="af-track w-fit"><button disabled={busy} onClick={() => void confirmBooking(true)} className="af-pill af-pill-raised">Check status</button><button disabled={busy} onClick={() => void confirmBooking(false)} className="af-pill">Retry original request</button></div>
      <p>Don’t book again. If your access code changed, contact the airline.</p>
    </section>}
    {confirmation && <section className="af-pass" aria-label={`${carrier.name} reservation confirmation`}>
      <div className="min-w-0">
        <div className="af-pass-head flex items-center justify-between gap-3 px-5 py-3 sm:px-6"><span className="af-eyebrow !text-white/80">{carrier.name} · Reservation</span><span className="af-mono text-xs font-semibold">{confirmation.carrierCode}</span></div>
        <div className="p-5 sm:p-6">
          <p className="af-field-label">Booking reference</p>
          <h2 className="af-mono mt-1 text-4xl font-semibold tracking-[0.18em] sm:text-5xl">{confirmation.recordLocator}</h2>
          <p className="af-title-line mt-4 text-sm font-medium"><span className="af-dot" data-tone="warn" />Awaiting payment · expires after 24 hours unless paid</p>
        </div>
      </div>
      <div className="af-pass-stub p-5 sm:p-6">
        <p className="af-field-label">Access code</p>
        <code className="af-mono af-well mt-2 block overflow-x-auto px-3 py-2.5 text-xs">{confirmation.token}</code>
        <p className="mt-2 text-xs text-[var(--af-ink-3)]">Save it now. It can’t be emailed or texted.</p>
        <div className="af-track mt-3" data-block="true"><button onClick={() => navigator.clipboard.writeText(confirmation.token).then(() => setStatus('Access code copied.'), () => setStatus('Copy failed. Select the access code and copy it manually.'))} className="af-pill af-pill-raised">Copy access code</button></div>
      </div>
    </section>}
    {shoppingEnabled && flights.length > 0 && <section aria-label="Available flights" className="af-board overflow-hidden rounded-2xl">
      <div className="hidden grid-cols-[1.1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 md:grid"><span className="af-eyebrow">Flight</span><span className="af-eyebrow">Departs</span><span className="af-eyebrow">Arrives</span><span className="af-eyebrow">Fare</span><span className="af-eyebrow w-36 text-right">Per traveler</span></div>
      {flights.map(flight => {
        const duration = flightDuration(flight.scheduledDepartureAt, flight.scheduledArrivalAt)
        const isSelected = selected?.id === flight.id && selected?.inventoryBucketId === flight.inventoryBucketId
        const soldOut = flight.availability.available < flight.passengerCount
        return <article key={`${flight.id}:${flight.inventoryBucketId}`} data-selected={isSelected ? 'true' : undefined} className="af-board-row grid gap-3 px-5 py-4 data-[selected=true]:bg-white/[0.06] md:grid-cols-[1.1fr_1fr_1fr_1fr_auto] md:items-center md:gap-4">
          <div className="flex items-baseline justify-between gap-3 md:block"><p className="af-board-cell af-signal text-lg font-semibold">{carrier.code} {flight.flightNumber}</p><p className="af-board-cell text-sm text-[var(--af-board-ink-2)]">{flight.originCode}–{flight.destinationCode}</p></div>
          <div className="grid grid-cols-3 gap-3 md:contents">
            <div><p className="af-board-cell text-xl font-semibold">{arrivalTime.format(new Date(flight.scheduledDepartureAt))}</p><p className="text-xs text-[var(--af-board-ink-2)]">{departureDateTime.format(new Date(flight.scheduledDepartureAt)).replace(/,?\s*\d{1,2}:\d{2}\s*[AP]M$/, '')}</p></div>
            <div><p className="af-board-cell text-xl font-semibold">{arrivalTime.format(new Date(flight.scheduledArrivalAt))}</p><p className="text-xs text-[var(--af-board-ink-2)]">{duration ?? '—'}</p></div>
            <div><p className="text-sm font-semibold">{flight.fareBrand.name}</p><p className="af-board-cell text-xs text-[var(--af-board-ink-2)]">{flight.availability.available} seats</p></div>
          </div>
          <div className="flex items-center justify-between gap-4 md:w-auto md:flex-col md:items-end md:gap-2">
            <div className="md:text-right"><p className="af-board-cell text-xl font-semibold">{formatMinorUnits(flight.perTravelerTotalAmount, flight.currencyCode)}</p><p className="af-board-cell text-xs text-[var(--af-board-ink-2)]">{formatMinorUnits(flight.partyTotalAmount, flight.currencyCode)} · {flight.passengerCount} pax</p></div>
            <div className="af-track"><button onClick={() => { setSelected(flight); setHeldOffer(null); bookingAttempt.current = null }} disabled={busy || Boolean(pendingBooking) || intentUnavailable || soldOut} aria-pressed={isSelected} className={`af-pill af-pill-sm ${isSelected ? '' : 'af-pill-primary'}`}>{soldOut ? 'Sold out' : isSelected ? 'Selected' : 'Select'}</button></div>
          </div>
        </article>
      })}
    </section>}
    {shoppingEnabled && selected && !pendingBooking && !intentUnavailable && <form onSubmit={holdOffer} className="af-pass">
      <div className="min-w-0">
        <div className="af-pass-head flex items-center justify-between gap-3 px-5 py-3 sm:px-6"><span className="af-eyebrow !text-white/80">Travelers · {passLabel}</span><div className="af-track !bg-black/20"><button type="button" onClick={() => { setSelected(null); setHeldOffer(null); bookingAttempt.current = null }} className="af-pill af-pill-sm !text-white/85 hover:!text-white">Close</button></div></div>
        <div className="space-y-6 p-5 sm:p-6">{Array.from({ length: selected.passengerCount }, (_, passengerIndex) => <fieldset disabled={Boolean(heldOffer)} key={passengerIndex} className="grid gap-4 disabled:opacity-70 sm:grid-cols-2">
          <legend className="af-title-line mb-3 text-sm font-semibold"><span className="af-mono grid size-6 place-items-center rounded-md bg-[var(--af-paper-2)] text-xs">{passengerIndex + 1}</span>Traveler {passengerIndex + 1}</legend>
          {(['givenName', 'familyName', 'dateOfBirth', 'email', 'phone'] as const).map(field => <label key={field} className={`af-field ${field === 'email' ? 'sm:col-span-1' : ''}`}><span className="af-field-label">{passengerFieldLabels[field]}</span><input required={field !== 'phone'} type={field === 'email' ? 'email' : field === 'dateOfBirth' ? 'date' : 'text'} max={field === 'dateOfBirth' ? adultBirthDateMax : undefined} name={`passenger.${passengerIndex}.${field}`} autoComplete={field === 'email' ? 'email' : field === 'phone' ? 'tel' : passengerIndex === 0 && field === 'givenName' ? 'given-name' : passengerIndex === 0 && field === 'familyName' ? 'family-name' : passengerIndex === 0 && field === 'dateOfBirth' ? 'bday' : 'off'} defaultValue="" className="af-input" /></label>)}
        </fieldset>)}</div>
      </div>
      <div className="af-pass-stub flex flex-col gap-4 p-5 sm:p-6">
        <div><p className="af-field-label">Flight</p><p className="af-mono mt-1 text-lg font-semibold">{carrier.code} {selected.flightNumber}</p><p className="af-display mt-1 flex items-center gap-2 text-3xl uppercase">{selected.originCode}<span className="af-path text-[var(--af-ink-3)]" />{selected.destinationCode}</p><p className="mt-1 text-xs text-[var(--af-ink-3)]">{departureDateTime.format(new Date(selected.scheduledDepartureAt))} · {selected.fareBrand.name}</p></div>
        <div className="af-rule pt-4"><p className="af-field-label">Total</p><p className="af-mono mt-1 text-2xl font-semibold">{heldOffer ? formatMinorUnits(heldOffer.totalAmount, heldOffer.currencyCode) : money(selected.partyTotalAmount)}</p><p className="af-mono text-xs text-[var(--af-ink-3)]">{money(selected.perTravelerTotalAmount)} × {selected.passengerCount}</p></div>
        {heldOffer ? <div className="space-y-3">
          <p className="af-title-line text-sm font-medium"><span className="af-dot" data-tone="ok" />Fare held · <span className="af-mono">{heldOffer.offerNumber}</span></p>
          <p className="af-mono text-xs text-[var(--af-ink-3)]">Held until {new Date(heldOffer.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })} · No online payment</p>
          <div className="af-track" data-block="true"><button type="button" disabled={busy} onClick={() => void confirmBooking()} className="af-pill af-pill-primary">Confirm reservation</button></div>
        </div> : <div className="af-track mt-auto" data-block="true"><button disabled={busy} className="af-pill af-pill-primary">Hold fare for {passLabel}</button></div>}
      </div>
    </form>}
    <form onSubmit={manage} className={`af-card relative z-10 p-4 sm:p-6 ${shoppingEnabled ? '' : 'shadow-[0_24px_48px_-24px_rgb(15_27_45/0.45)]'}`}>
      <h2 className="af-eyebrow">{mode === 'check-in' ? `Check in with ${carrier.name}` : `Manage ${carrier.name} booking`}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1.6fr_auto] sm:items-end">
        <label className="af-field"><span className="af-field-label">Booking reference</span><input ref={recordLocatorInput} aria-label="Booking reference" name="recordLocator" defaultValue="" autoCapitalize="characters" autoComplete="off" placeholder="ABC123" required className="af-input af-input-code text-lg" /></label>
        <label className="af-field"><span className="af-field-label">Access code</span><input ref={accessTokenInput} aria-label="Access code" name="accessToken" type="password" defaultValue="" autoComplete="off" className="af-input" /></label>
        <div className="af-track" data-block="true"><button disabled={busy} className={`af-pill ${shoppingEnabled ? 'af-pill-raised' : 'af-pill-primary'} min-h-11 px-6`}>{busy ? 'Retrieving…' : mode === 'check-in' ? 'Retrieve for check-in' : 'Retrieve'}</button></div>
      </div>
    </form>
    {managedBooking && <section aria-label={`Booking ${managedBooking.recordLocator}`} className="space-y-5">
      <div className="af-card overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="af-eyebrow">{managedBooking.carrier.name}</p>
            <h2 className="af-title-line mt-2"><span className="af-dot" data-tone={tripTone(managedBooking.status)} /><span className="af-mono text-3xl font-semibold tracking-[0.16em]">{managedBooking.recordLocator}</span><span className="text-sm font-semibold text-[var(--af-ink-2)]">{label(bookingStatusLabels, managedBooking.status)}</span></h2>
            <dl className="af-mono mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs uppercase tracking-[0.1em] text-[var(--af-ink-3)]"><div className="flex gap-2"><dt>Payment</dt><dd className="text-[var(--af-ink)]">{label(paymentStatusLabels, managedBooking.paymentStatus)}</dd></div><div className="flex gap-2"><dt>Ticket</dt><dd className="text-[var(--af-ink)]">{label(ticketStatusLabels, managedBooking.ticketingStatus)}</dd></div></dl>
          </div>
          {mode !== 'check-in' && <div className="af-track w-fit"><button onClick={rotateAccess} className="af-pill af-pill-raised af-pill-sm">Replace access code</button>{!['cancelled', 'completed'].includes(managedBooking.status) && <button onClick={cancelBooking} className="af-pill af-pill-danger af-pill-sm">Cancel booking</button>}</div>}
        </div>
        <div className="af-rule bg-[var(--af-paper)] px-5 py-4 sm:px-6">
          {managedBooking.bookingReceipt.accepted ? <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1"><p className="af-field-label">Booked fare · <span className="normal-case tracking-normal">{managedBooking.bookingReceipt.accepted.offerNumber}</span></p>{managedBooking.bookingReceipt.accepted.items.map((item, index) => <p key={index} className="text-sm">{item.description} · {item.quantity} travelers · {item.fareName ?? 'Accepted fare'}{item.includedBaggage ? ` · ${item.includedBaggage.pieces} bag(s), ${item.includedBaggage.maxWeightGrams / 1000} kg` : ''}</p>)}</div>
            <p className="af-mono text-xl font-semibold">{formatMinorUnits(managedBooking.bookingReceipt.accepted.totalAmount, managedBooking.bookingReceipt.accepted.currencyCode)}</p>
          </div> : <p role="status" className="text-sm text-[var(--af-ink-2)]">Original fare details unavailable.</p>}
          <p className="af-mono mt-3 text-[0.6875rem] uppercase tracking-[0.12em] text-[var(--af-ink-3)]">No online payment · paid once the airline confirms</p>
        </div>
      </div>
      {managedBooking.segments.map(segment => {
        const departure = localTime(segment.actualDepartureAt ?? segment.estimatedDepartureAt ?? segment.scheduledDepartureAt, segment.originTimezone)
        const arrival = localTime(segment.actualArrivalAt ?? segment.estimatedArrivalAt ?? segment.scheduledArrivalAt, segment.destinationTimezone)
        return <article key={segment.id} className="af-card overflow-hidden">
          <header className="af-board px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3"><p className="af-board-cell af-signal text-sm font-semibold">{managedBooking.carrier.code} {segment.flightNumber}{segment.serviceDate ? ` · ${segment.serviceDate}` : ''}</p><p className="af-title-line text-sm font-semibold"><span className="af-dot" data-tone={segmentTone(segment.status)} />{label(segmentStatusLabels, segment.status)}</p></div>
            <p className="af-display mt-3 flex items-center gap-3 text-5xl uppercase">{segment.originCode}<span className="af-path" />{segment.destinationCode}</p>
            {segment.scheduledDepartureAt && <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="af-eyebrow">Departs · {segment.actualDepartureAt ? 'actual' : segment.estimatedDepartureAt ? 'estimated' : 'scheduled'}</dt><dd className="af-board-cell mt-1">{departure}{segment.estimatedDepartureAt && !segment.actualDepartureAt ? <span className="block text-xs text-[var(--af-board-ink-2)]">Scheduled {localTime(segment.scheduledDepartureAt, segment.originTimezone)}</span> : null}</dd></div><div><dt className="af-eyebrow">Arrives · {segment.actualArrivalAt ? 'actual' : segment.estimatedArrivalAt ? 'estimated' : 'scheduled'}</dt><dd className="af-board-cell mt-1">{arrival}</dd></div></dl>}
          </header>
          <div className="divide-y divide-[var(--af-line)]">{managedBooking.passengers.map(passenger => {
            const checkIn = managedBooking.checkIns.find(entry => entry.bookingPassengerId === passenger.id && entry.bookingSegmentId === segment.id)
            const pass = checkIn?.boardingPass
            const currentSeat = segment.seats.find(seat => seat.selectedForPassengerId === passenger.id)
            return <div key={`${segment.id}:${passenger.id}`} className="space-y-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="af-title-line font-semibold"><span className="af-dot" data-tone={checkIn ? checkInTone(checkIn.status) : undefined} />{passenger.passenger.givenName} {passenger.passenger.familyName}</h3>
                  <p className="af-mono mt-1 pl-4 text-xs uppercase tracking-[0.1em] text-[var(--af-ink-3)]">{checkIn ? label(checkInStatusLabels, checkIn.status) : 'Not checked in'}{currentSeat ? ` · Seat ${currentSeat.designator}` : ''}</p>
                  {passenger.acceptedName && (passenger.acceptedName.givenName !== passenger.passenger.givenName || passenger.acceptedName.familyName !== passenger.passenger.familyName) && <p className="mt-2 pl-4 text-xs text-[var(--af-warn)]">Booked as {passenger.acceptedName.givenName} {passenger.acceptedName.familyName}. Contact the airline to update.</p>}
                </div>
                {(!checkIn || checkIn.status === 'offloaded') && <div className="af-track"><button onClick={() => customerCheckIn(passenger.id, segment.id, checkIn?.offloadedAt ?? 'initial')} className="af-pill af-pill-primary af-pill-sm">{checkIn?.status === 'offloaded' ? 'Re-check in' : 'Check in'}</button></div>}
              </div>
              {seatSelectionOpen(managedBooking) ? <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="af-field-label">Choose a seat</p><p className="af-mono flex gap-3 text-[0.6875rem] text-[var(--af-ink-3)]"><span className="inline-flex items-center gap-1"><span className="af-seat !min-h-0 size-3 !rounded-sm" data-state="selected" />Yours</span><span className="inline-flex items-center gap-1"><span className="af-seat !min-h-0 size-3 !rounded-sm" data-state="taken" />Taken</span><span className="inline-flex items-center gap-1"><span className="af-seat !min-h-0 size-3 !rounded-sm" data-state="paid" />Paid</span></p></div>
                <div aria-label={`Seats for ${segment.originCode} to ${segment.destinationCode}`} className="af-well grid max-h-80 grid-cols-4 gap-2 overflow-y-auto p-3 sm:grid-cols-6">{segment.seats.map(seat => { const mine = seat.selectedForPassengerId === passenger.id; return <button key={seat.id} disabled={seat.surchargeAmount > 0 || !seat.isAvailable || Boolean(checkIn && checkIn.status !== 'offloaded')} onClick={() => chooseSeat(passenger.id, segment.id, seat)} data-state={mine ? 'selected' : !seat.isAvailable ? 'taken' : seat.surchargeAmount > 0 ? 'paid' : undefined} aria-label={`Seat ${seat.designator}${mine ? ', selected' : !seat.isAvailable ? ', occupied' : ''}${seat.surchargeAmount ? `, ${formatMinorUnits(seat.surchargeAmount, seat.currencyCode)}, not available online` : ''}`} className="af-seat">{seat.designator}</button> })}</div>
              </div> : <p className="af-mono text-xs uppercase tracking-[0.1em] text-[var(--af-ink-3)]">Seats open once your ticket is issued</p>}
              {pass && <div className="af-pass" aria-label={`Boarding pass ${pass.passNumber}`}>
                <div className="min-w-0">
                  <div className="af-pass-head flex items-center justify-between gap-3 px-5 py-2.5"><span className="af-eyebrow !text-white/80">Boarding pass</span><span className="af-mono text-xs font-semibold capitalize">{pass.status.replaceAll('_', ' ')}</span></div>
                  <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
                    {[['Seat', pass.seatDesignatorSnapshot], ['Group', pass.boardingGroup], ['Terminal', pass.terminalSnapshot], ['Gate', pass.gateSnapshot]].map(([name, value]) => <div key={name}><p className="af-field-label">{name}</p><p className="af-mono mt-1 text-2xl font-semibold">{value ?? 'TBD'}</p></div>)}
                  </div>
                </div>
                <div className="af-pass-stub p-5"><p className="af-field-label">Pass</p><p className="af-mono mt-1 font-semibold">{pass.passNumber}</p><code className="af-mono af-well mt-3 block overflow-x-auto px-3 py-2 text-[0.6875rem]">{pass.barcodeToken}</code></div>
              </div>}
            </div>
          })}</div>
        </article>
      })}
    </section>}
  </div>
}
