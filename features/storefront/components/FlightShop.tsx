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
const passengerFieldLabels = { givenName: 'Given name', familyName: 'Family name', dateOfBirth: 'Date of birth (18 or older on departure)', email: 'Email', phone: 'Phone (optional)' } as const

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

  return <div className="space-y-6">
    {shoppingEnabled && <aside className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"><p className="font-semibold">Reservations only — no online payment</p><p className="mt-1">Confirming creates a reservation that you pay for directly with the airline. It becomes a ticket once the airline confirms your payment; unpaid reservations expire after 24 hours.</p><p className="mt-1">Online booking is for adults who are 18 or older on the departure date.</p></aside>}
    {shoppingEnabled && <form onSubmit={search} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-5 sm:p-5">
      <label className="text-sm font-medium">From<input aria-label="Origin airport" name="originCode" defaultValue="JFK" autoCapitalize="characters" autoComplete="off" inputMode="text" pattern="[A-Za-z0-9]{3}" maxLength={3} required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 uppercase" /></label>
      <label className="text-sm font-medium">To<input aria-label="Destination airport" name="destinationCode" defaultValue="BOS" autoCapitalize="characters" autoComplete="off" inputMode="text" pattern="[A-Za-z0-9]{3}" maxLength={3} required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 uppercase" /></label>
      <label className="text-sm font-medium">Departure<input aria-label="Departure date" name="serviceDate" type="date" defaultValue={initialDate} required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3" /></label>
      <label className="text-sm font-medium">Adults (18+ on departure)<select aria-label="Adult travelers, 18 or older on the departure date" name="passengerCount" defaultValue="1" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3">{Array.from({ length: 9 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
      <button disabled={busy} className="self-end rounded-xl bg-[var(--storefront-brand)] px-4 py-3 font-medium text-white disabled:opacity-50">{busy ? 'Working…' : 'Search flights'}</button>
    </form>}
    {status && <p role="status" className="rounded-2xl bg-[var(--storefront-brand-soft)] px-4 py-3 text-sm text-slate-950">{status}</p>}
    {pendingBooking && <section aria-label="Original reservation command recovery" className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm"><h2 className="font-semibold">We’re checking your reservation</h2><p>Your reservation request is saved in this browser tab. Even if the fare hold has expired, we may have received it. Checking its status never creates a booking, and retrying sends the exact same request, so it can’t book twice.</p><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => void confirmBooking(true)} className="rounded-lg border px-3 py-2">Recover original receipt (read only)</button><button disabled={busy} onClick={() => void confirmBooking(false)} className="rounded-lg border px-3 py-2">Retry exact original command</button></div><p>If your access code changed, or the airline needs to review this reservation, contact the airline. Please don’t book again.</p></section>}
    {confirmation && <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"><p className="text-sm font-semibold">{carrier.name} reservation confirmation</p><h2 className="mt-1 text-2xl font-semibold">{confirmation.recordLocator}</h2><p className="mt-3 text-sm">This is your booking access code for {confirmation.carrierCode} {confirmation.recordLocator}. Save it now: you need it with your booking reference to manage your trip or check in, and we can’t email or text it to you. Unpaid reservations expire after 24 hours unless the airline confirms your payment.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2 text-xs">{confirmation.token}</code><button onClick={() => navigator.clipboard.writeText(confirmation.token).then(() => setStatus('Access code copied.'), () => setStatus('Copy failed. Select the access code and copy it manually.'))} className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-medium">Copy access code</button></div></section>}
    <form onSubmit={manage} className="rounded-3xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">{mode === 'check-in' ? `Check in with ${carrier.name}` : `Manage ${carrier.name} booking`}</h2><p className="mt-1 text-sm text-slate-600">Enter your booking reference and the access code from your confirmation.</p><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto]"><input ref={recordLocatorInput} aria-label="Booking reference" name="recordLocator" defaultValue="" autoCapitalize="characters" autoComplete="off" placeholder="Booking reference" required className="rounded-xl border px-3 py-3 uppercase" /><input ref={accessTokenInput} aria-label="Access code" name="accessToken" type="password" defaultValue="" autoComplete="off" placeholder="Access code" className="rounded-xl border px-3 py-3" /><button disabled={busy} className="rounded-xl border px-4 py-3 font-medium">{mode === 'check-in' ? 'Retrieve for check-in' : 'Retrieve'}</button></div></form>
    {managedBooking && <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium text-[var(--storefront-brand)]">{managedBooking.carrier.name}</p><h2 className="text-lg font-semibold">{managedBooking.recordLocator} · {label(bookingStatusLabels, managedBooking.status)}</h2><p className="text-sm text-slate-600">Payment: {label(paymentStatusLabels, managedBooking.paymentStatus)} · Ticket: {label(ticketStatusLabels, managedBooking.ticketingStatus)}</p>{managedBooking.bookingReceipt.accepted ? <div className="mt-2 rounded-lg border p-3 text-sm"><p className="font-medium">Booked fare {managedBooking.bookingReceipt.accepted.offerNumber}: {formatMinorUnits(managedBooking.bookingReceipt.accepted.totalAmount, managedBooking.bookingReceipt.accepted.currencyCode)}</p><p className="mt-1 text-xs text-slate-500">These are the terms you booked. Current flight times and status are shown with each flight below.</p>{managedBooking.bookingReceipt.accepted.items.map((item, index) => <p key={index} className="mt-1 text-xs">{item.description} · {item.quantity} travelers · {item.fareName ?? 'Accepted fare'}{item.includedBaggage ? ` · ${item.includedBaggage.pieces} included bag(s), ${item.includedBaggage.maxWeightGrams}g allowance` : ''}</p>)}</div> : <p role="status" className="mt-2 text-xs">Your original booked fare details aren’t available here. Contact the airline if you need them.</p>}<p className="mt-1 text-xs text-slate-500">Online payment isn’t available. Your reservation is paid once the airline confirms your payment.</p></div>{mode !== 'check-in' && <div className="flex gap-2"><button onClick={rotateAccess} className="rounded-xl border px-4 py-2 text-sm">Replace access code</button>{!['cancelled', 'completed'].includes(managedBooking.status) && <button onClick={cancelBooking} className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-700">Cancel booking</button>}</div>}</div>{managedBooking.segments.map(segment => <article key={segment.id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{segment.originCode} → {segment.destinationCode} · {managedBooking.carrier.code} {segment.flightNumber}{segment.serviceDate ? ` · ${segment.serviceDate}` : ''}</p>{segment.scheduledDepartureAt && <p className="mt-1 text-sm text-slate-600">Departs {localTime(segment.actualDepartureAt ?? segment.estimatedDepartureAt ?? segment.scheduledDepartureAt, segment.originTimezone)}{segment.actualDepartureAt ? ' (actual)' : segment.estimatedDepartureAt ? ` (estimated; scheduled ${localTime(segment.scheduledDepartureAt, segment.originTimezone)})` : ' (scheduled)'} · Arrives {localTime(segment.actualArrivalAt ?? segment.estimatedArrivalAt ?? segment.scheduledArrivalAt, segment.destinationTimezone)}{segment.actualArrivalAt ? ' (actual)' : segment.estimatedArrivalAt ? ' (estimated)' : ' (scheduled)'}</p>}</div><span className="rounded-full border px-2 py-1 text-xs">{label(segmentStatusLabels, segment.status)}</span></div>{managedBooking.passengers.map(passenger => { const checkIn = managedBooking.checkIns.find(entry => entry.bookingPassengerId === passenger.id && entry.bookingSegmentId === segment.id); const pass = checkIn?.boardingPass; return <div key={`${segment.id}:${passenger.id}`} className="mt-4 rounded-xl bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium">{passenger.passenger.givenName} {passenger.passenger.familyName}</p>{passenger.acceptedName && (passenger.acceptedName.givenName !== passenger.passenger.givenName || passenger.acceptedName.familyName !== passenger.passenger.familyName) && <p className="mt-1 text-xs text-slate-500">Accepted traveler: {passenger.acceptedName.givenName} {passenger.acceptedName.familyName}. Your current details differ from the booking; contact the airline to update them.</p>}</div><span className="text-xs text-slate-500">{checkIn ? label(checkInStatusLabels, checkIn.status) : 'Not checked in'}</span></div>{seatSelectionOpen(managedBooking) ? <div aria-label={`Seats for ${segment.originCode} to ${segment.destinationCode}`} className="mt-3 grid max-h-72 grid-cols-4 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-6">{segment.seats.map(seat => { const selected = seat.selectedForPassengerId === passenger.id; return <button key={seat.id} disabled={seat.surchargeAmount > 0 || !seat.isAvailable || Boolean(checkIn && checkIn.status !== 'offloaded')} onClick={() => chooseSeat(passenger.id, segment.id, seat)} className="rounded-lg border bg-white px-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">{seat.designator}{selected ? ' · selected' : !seat.isAvailable ? ' · occupied' : ''}{seat.surchargeAmount ? ` · ${formatMinorUnits(seat.surchargeAmount, seat.currencyCode)} not available online` : ''}</button> })}</div> : <p className="mt-3 text-sm text-slate-600">Seat selection is available after your ticket is issued.</p>}{(!checkIn || checkIn.status === 'offloaded') && <button onClick={() => customerCheckIn(passenger.id, segment.id, checkIn?.offloadedAt ?? 'initial')} className="mt-3 rounded-xl border bg-white px-4 py-2 text-sm">{checkIn?.status === 'offloaded' ? 'Re-check in' : 'Check in'}</button>}{pass && <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><p className="font-semibold">Boarding pass {pass.passNumber} · {pass.status}</p><p className="mt-1 text-blue-950">Seat {pass.seatDesignatorSnapshot ?? 'TBD'} · Group {pass.boardingGroup ?? 'TBD'} · Terminal {pass.terminalSnapshot ?? 'TBD'} · Gate {pass.gateSnapshot ?? 'TBD'}</p><code className="mt-2 block overflow-x-auto text-xs">{pass.barcodeToken}</code></div>}</div>})}</article>)}</section>}
    {shoppingEnabled && <div className="space-y-3">{flights.map(flight => <article key={`${flight.id}:${flight.inventoryBucketId}`} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{flight.originCode} → {flight.destinationCode} · {carrier.code} {flight.flightNumber}</p><p className="mt-1 text-sm text-slate-600">{departureDateTime.format(new Date(flight.scheduledDepartureAt))} → {arrivalTime.format(new Date(flight.scheduledArrivalAt))}{flightDuration(flight.scheduledDepartureAt, flight.scheduledArrivalAt) ? ` (${flightDuration(flight.scheduledDepartureAt, flight.scheduledArrivalAt)})` : ''} · {flight.fareBrand.name} · {flight.passengerCount} traveler{flight.passengerCount === 1 ? '' : 's'}</p></div><div className="sm:text-right"><p className="font-semibold">{formatMinorUnits(flight.perTravelerTotalAmount, flight.currencyCode)} per traveler</p><p className="text-sm font-medium">{formatMinorUnits(flight.partyTotalAmount, flight.currencyCode)} party total</p><p className="text-sm text-slate-600">{flight.availability.available} available</p><button onClick={() => { setSelected(flight); setHeldOffer(null); bookingAttempt.current = null }} disabled={busy || Boolean(pendingBooking) || intentUnavailable || flight.availability.available < flight.passengerCount} className="mt-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50">Passenger details</button></div></article>)}</div>}
    {shoppingEnabled && selected && !pendingBooking && !intentUnavailable && <form onSubmit={holdOffer} className="rounded-3xl bg-[var(--storefront-brand)] p-5 text-white sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-white/85">Complete reservation details</p><h2 className="mt-1 text-xl font-semibold">{selected.originCode} → {selected.destinationCode} · {money(selected.partyTotalAmount)} party total</h2><p className="mt-1 text-sm text-white/85">{money(selected.perTravelerTotalAmount)} per traveler × {selected.passengerCount}</p></div><button type="button" onClick={() => { setSelected(null); setHeldOffer(null); bookingAttempt.current = null }} className="text-sm text-white/85">Close</button></div><div className="mt-5 space-y-5">{Array.from({ length: selected.passengerCount }, (_, passengerIndex) => <fieldset disabled={Boolean(heldOffer)} key={passengerIndex} className="grid gap-3 border-t border-white/20 pt-4 disabled:opacity-70 sm:grid-cols-2"><legend className="pr-3 text-sm font-semibold">Traveler {passengerIndex + 1}</legend>{(['givenName', 'familyName', 'dateOfBirth', 'email', 'phone'] as const).map(field => <label key={field} className="text-sm">{passengerFieldLabels[field]}<input required={field !== 'phone'} type={field === 'email' ? 'email' : field === 'dateOfBirth' ? 'date' : 'text'} max={field === 'dateOfBirth' ? adultBirthDateMax : undefined} name={`passenger.${passengerIndex}.${field}`} autoComplete={field === 'email' ? 'email' : field === 'phone' ? 'tel' : passengerIndex === 0 && field === 'givenName' ? 'given-name' : passengerIndex === 0 && field === 'familyName' ? 'family-name' : passengerIndex === 0 && field === 'dateOfBirth' ? 'bday' : 'off'} defaultValue="" className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-white" /></label>)}</fieldset>)}</div>{heldOffer ? <div className="mt-5 rounded-2xl border border-emerald-300/40 bg-emerald-300/10 p-4"><p className="text-sm text-emerald-100">Fare held · {heldOffer.offerNumber}</p><p className="mt-1 text-xl font-semibold">{formatMinorUnits(heldOffer.totalAmount, heldOffer.currencyCode)} party total</p><p className="mt-1 text-xs text-emerald-100">This total is fixed for your reservation. No payment is taken online. Your fare is held until {new Date(heldOffer.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}.</p><button type="button" disabled={busy} onClick={() => void confirmBooking()} className="mt-4 rounded-xl bg-white px-5 py-3 font-medium text-slate-950 disabled:opacity-50">Confirm reservation</button></div> : <button disabled={busy} className="mt-5 rounded-xl bg-white px-5 py-3 font-medium text-slate-950 disabled:opacity-50">Hold fare for {selected.passengerCount} traveler{selected.passengerCount === 1 ? '' : 's'}</button>}</form>}
  </div>
}
