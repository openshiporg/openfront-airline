'use client'

import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftRight, ArrowRight, Check, ChevronDown, Luggage, MapPin, Minus, Plane, Plus, Ticket, UserRound } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

import { PlatformDateInput } from '@/features/platform/components/PlatformDateTime'
import { PlatformSelect } from '@/features/platform/components/PlatformSelect'

import { HomeHero } from '@/features/storefront/components/HomeHero'
import type { PublicCarrierIdentity } from '@/features/storefront/lib/carrier'
import type { StorefrontNetwork } from '@/features/storefront/lib/network'
import { networkHub } from '@/features/storefront/lib/hub'
import { parseBookingAccessForm, parseStorefrontPassengers, parseStorefrontSearchForm } from '@/features/storefront/lib/forms'
import { bookingIntentVariables, CUSTOMER_BOOKING_COMMAND, CUSTOMER_BOOKING_READ, parsePendingBookingIntent, type BookingReceipt, type PendingBookingIntent } from '@/features/storefront/lib/booking-intent'
import { formatMinorUnits } from '@/features/keystone/lib/money'
import { formatAirportClock, formatAirportTime } from '@/features/airline/lib/time'
import { airportClock, dayShift, formatServiceDay } from '@/features/storefront/lib/airport-time'
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
  fareBrand: { name: string; description?: string | null; baggagePieces?: number | null; baggageWeightGrams?: number | null }
  cabinName?: string | null
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
  segments: Array<{ id: string; status: string; flightNumber: string; flightStatus?: string; serviceDate?: string | null; scheduledDepartureAt?: string; scheduledArrivalAt?: string; estimatedDepartureAt?: string | null; estimatedArrivalAt?: string | null; actualDepartureAt?: string | null; actualArrivalAt?: string | null; originCode: string; destinationCode: string; originTimezone?: string | null; destinationTimezone?: string | null; seats: Array<{ id: string; designator: string; rowNumber?: number | null; columnCode?: string | null; seatType: string; surchargeAmount: number; currencyCode: string; isAvailable: boolean; selectedForPassengerId?: string | null }> }>
  checkIns: Array<{ id: string; bookingPassengerId: string; bookingSegmentId: string; status: string; offloadedAt?: string | null; boardingPass?: BoardingPass | null }>
}

const bookingStatusLabels: Record<string, string> = { pending: 'Awaiting payment', confirmed: 'Confirmed', ticketed: 'Ticketed', in_progress: 'Travelling', completed: 'Completed', cancelled: 'Cancelled' }
const paymentStatusLabels: Record<string, string> = { unpaid: 'Not paid yet', failed: 'Payment failed', paid: 'Paid', partially_refunded: 'Partly refunded', refunded: 'Refunded' }
const ticketStatusLabels: Record<string, string> = { not_ticketed: 'Not issued yet', ticketed: 'Issued', voided: 'Voided' }
const passStatusLabels: Record<string, string> = { issued: 'Issued', reissued: 'Reissued', boarded: 'Boarded', revoked: 'Revoked' }
const segmentStatusLabels: Record<string, string> = { confirmed: 'Confirmed', checked_in: 'Checked in', boarded: 'Boarded', flown: 'Flown', offloaded: 'Offloaded', disrupted: 'Disrupted', reaccommodated: 'Replaced by a new flight', cancelled: 'Cancelled', refunded: 'Refunded' }
const checkInStatusLabels: Record<string, string> = { checked_in: 'Checked in', boarded: 'Boarded', offloaded: 'Offloaded', cancelled: 'Check-in cancelled' }
const label = (labels: Record<string, string>, value: string) => labels[value] ?? value.replaceAll('_', ' ')
type Tone = 'ok' | 'warn' | 'bad' | undefined
// A notice says its tone outright: green done, orange needs the traveler, red failed, accent for information.
type NoticeTone = 'ok' | 'warn' | 'bad' | 'info'
const tripTone = (status: string): Tone => ['confirmed', 'ticketed', 'in_progress', 'completed'].includes(status) ? 'ok' : status === 'cancelled' ? 'bad' : 'warn'
const segmentTone = (status: string): Tone => ['confirmed', 'checked_in', 'boarded', 'flown'].includes(status) ? 'ok' : ['cancelled', 'offloaded', 'refunded'].includes(status) ? 'bad' : 'warn'
const checkInTone = (status: string): Tone => ['checked_in', 'boarded'].includes(status) ? 'ok' : 'bad'
const passengerFieldLabels = { givenName: 'First name', familyName: 'Last name', dateOfBirth: 'Date of birth', email: 'Email', phone: 'Phone (optional)' } as const
const fieldLabel = (field: keyof typeof passengerFieldLabels, index: number) => field === 'email' && index > 0 ? 'Email (optional)' : passengerFieldLabels[field]

// Mirrors the server gate in assignCustomerSeat: ticket issuance refuses bookings that already hold seat artifacts.
function seatSelectionOpen(booking: { status: string; paymentStatus: string; ticketingStatus: string }) {
  return ['ticketed', 'in_progress'].includes(booking.status) && ['paid', 'partially_refunded'].includes(booking.paymentStatus) && booking.ticketingStatus === 'ticketed'
}

// Mirrors assertDatedFlightEligibleForAction: check-in and seats close once the flight departs, is cancelled, or
// leaves its operating states. Returns why a segment is closed, or null while it is open.
const serviceFlightStatuses = new Set(['scheduled', 'open_for_sale', 'closed_for_sale', 'delayed', 'boarding'])
function segmentClosedReason(segment: { status: string; flightStatus?: string; scheduledDepartureAt?: string; estimatedDepartureAt?: string | null; actualDepartureAt?: string | null; actualArrivalAt?: string | null }, now: number) {
  if (segment.status === 'cancelled' || segment.flightStatus === 'cancelled') return 'This flight is cancelled.'
  const departure = Date.parse((segment.flightStatus === 'delayed' && segment.estimatedDepartureAt) || segment.scheduledDepartureAt || '')
  if (segment.actualDepartureAt || segment.actualArrivalAt || (Number.isFinite(departure) && departure <= now)) return 'This flight has departed. Check-in and seat selection are closed.'
  if (segment.flightStatus && !serviceFlightStatuses.has(segment.flightStatus)) return 'Check-in and seat selection are closed for this flight.'
  return null
}

// Airport-local time with an explicit zone, so travelers outside the carrier timezone read the right date.
function localTime(value: string | null | undefined, timeZone: string | null | undefined) {
  return formatAirportTime(value, timeZone)
}

type TripType = 'one-way' | 'round-trip'
type Party = { adults: number; children: number; infants: number }
type SearchInput = { originCode: string; destinationCode: string; serviceDate: string; passengerCount: number }
type TravelerValues = Record<'givenName' | 'familyName' | 'dateOfBirth' | 'email' | 'phone', string>
const travelerFields = ['givenName', 'familyName', 'dateOfBirth', 'email', 'phone'] as const

function travelerBand(index: number, party: Party) {
  return index < party.adults ? 'Adult' : index < party.adults + party.children ? 'Child 2–11' : 'Infant under 2'
}

// Groups a flight's seats into cabin rows with an aisle down the middle of the column letters.
function seatRows<T extends { designator: string; rowNumber?: number | null; columnCode?: string | null }>(seats: T[]) {
  const parsed = seats.map(seat => {
    const match = /^(\d+)([A-Z]+)$/i.exec(seat.designator.trim())
    return { seat, row: seat.rowNumber ?? (match ? Number(match[1]) : 0), column: (seat.columnCode || match?.[2] || seat.designator).toUpperCase() }
  })
  const columns = [...new Set(parsed.map(entry => entry.column))].sort()
  const aisleAfter = Math.ceil(columns.length / 2) - 1
  const rows = new Map<number, Map<string, T>>()
  for (const entry of parsed) {
    if (!rows.has(entry.row)) rows.set(entry.row, new Map())
    rows.get(entry.row)!.set(entry.column, entry.seat)
  }
  return { columns, aisleAfter, rows: [...rows.entries()].sort(([left], [right]) => left - right) }
}

// `hero` (home only) puts the search widget inside the home hero, under the given headline block.
export function FlightShop({ initialDate, carrier, mode = 'book', network, hero }: { initialDate: string; carrier: PublicCarrierIdentity; mode?: FlightShopMode; network?: StorefrontNetwork; hero?: { lead: ReactNode } }) {
  const storagePrefix = `airline:${carrier.code.toLowerCase()}`
  const shoppingEnabled = mode === 'book'
  const [flights, setFlights] = useState<Flight[]>([])
  const [selected, setSelected] = useState<Flight | null>(null)
  const [heldOffer, setHeldOffer] = useState<HeldOffer | null>(null)
  const [status, setStatusText] = useState('')
  const [statusTone, setStatusTone] = useState<NoticeTone>('info')
  function setStatus(next: string | ((current: string) => string), tone: NoticeTone = 'info') { setStatusText(next); setStatusTone(tone) }
  const [busy, setBusy] = useState(false)
  const [recordLocator, setRecordLocator] = useState('')
  const [accessToken, setAccessToken] = useState('')
  // The displayed access code belongs to exactly one booking; it is never shown under another booking's reference.
  const [confirmation, setConfirmation] = useState<{ recordLocator: string; carrierCode: string; token: string } | null>(null)
  // One key per deliberate seat choice; kept only while that choice's outcome is unknown, so a retry cannot apply twice.
  const seatIntent = useRef<{ passengerId: string; segmentId: string; seatId: string; key: string } | null>(null)
  const [managedBooking, setManagedBookingState] = useState<CustomerBooking | null>(null)
  // When the booking was read: check-in and seats close against this clock, as the server does at departure.
  const [bookingReadAt, setBookingReadAt] = useState(0)
  function setManagedBooking(next: CustomerBooking | null) { setManagedBookingState(next); setBookingReadAt(Date.now()) }
  const bookingAttempt = useRef<{ offerKey: string; bookingKey: string } | null>(null)
  const [pendingBooking, setPendingBooking] = useState<PendingBookingIntent | null>(null)
  const [intentUnavailable, setIntentUnavailable] = useState(false)
  // Search console: route pickers fed by the carrier's network, trip type and the party by fare type.
  const routes = useMemo(() => network?.routes ?? [], [network])
  const [tripType] = useState<TripType>('one-way')
  // Home widget: the search and the booking lookup share one panel.
  const [widgetTab, setWidgetTab] = useState<'book' | 'manage'>('book')
  // The search opens on the hub as the origin, with the destination and date left for the traveler to choose.
  const [origin, setOrigin] = useState(networkHub(network)?.code ?? routes[0]?.origin ?? '')
  const [destination, setDestination] = useState('')
  // Upcoming dates with a flight for a route (dates are carrier-local service dates).
  const datesFor = (from: string, to: string) => network?.serviceDates?.[`${from}-${to}`] ?? []
  const [departDate, setDepartDate] = useState('')
  const [nextServiceDate, setNextServiceDate] = useState<string | null>(null)
  // A new route starts on its first date with a flight, unless the chosen date already has one.
  const routeDates = datesFor(origin, destination).join(',')
  useEffect(() => {
    const dates = routeDates ? routeDates.split(',') : []
    setDepartDate(current => dates.length && current && !dates.includes(current) ? dates[0] : current)
  }, [routeDates])
  const [returnDate, setReturnDate] = useState(() => { const value = new Date(`${initialDate}T00:00:00.000Z`); value.setUTCDate(value.getUTCDate() + 7); return value.toISOString().slice(0, 10) })
  const [party, setParty] = useState<Party>({ adults: 1, children: 0, infants: 0 })
  const [searchParty, setSearchParty] = useState<Party>({ adults: 1, children: 0, infants: 0 })
  // Round trips are two reservations: the outbound, then the return for the same travelers.
  const [leg, setLeg] = useState<'outbound' | 'return'>('outbound')
  const [returnSearch, setReturnSearch] = useState<SearchInput | null>(null)
  const [editingSearch, setEditingSearch] = useState(false)
  const [earlierConfirmations, setEarlierConfirmations] = useState<Array<{ recordLocator: string; carrierCode: string; token: string }>>([])
  const [travelerValues, setTravelerValues] = useState<TravelerValues[]>([])
  // A signed-in traveler's saved details fill the lead traveler.
  useEffect(() => {
    if (mode !== 'book') return
    graphql<{ travelerAccount: { email: string; givenName: string; familyName: string; dateOfBirth: string; phone: string } | null }>('{travelerAccount{email givenName familyName dateOfBirth phone}}', {})
      .then(data => { const a = data.travelerAccount; if (a) setTravelerValues(values => values.length ? values : [{ givenName: a.givenName, familyName: a.familyName, dateOfBirth: a.dateOfBirth, email: a.email, phone: a.phone }]) })
      .catch(() => {})
  }, [mode])
  const [recovering, setRecovering] = useState(false)
  const partySize = party.adults + party.children + party.infants
  const destinations = useMemo(() => routes.filter(route => route.origin === origin).map(route => route.destination), [routes, origin])
  const airportCity = (code: string) => network?.airports.find(entry => entry.code === code)?.city || code
  const canSwap = routes.some(route => route.origin === destination && route.destination === origin)
  const partyLabel = `${partySize} traveler${partySize === 1 ? '' : 's'}`
  const airportLabel = (code: string) => { const airport = network?.airports.find(entry => entry.code === code); return airport?.city ? `${airport.city} (${code})` : code }
  const intentStorageKey = `${storagePrefix}:original-booking-intent`
  useEffect(() => {
    try { setPendingBooking(parsePendingBookingIntent(sessionStorage.getItem(intentStorageKey))) }
    catch (error) { setIntentUnavailable(true); setStatus(error instanceof Error ? error.message : 'Original booking intent is unavailable; do not create a replacement.', 'warn') }
  }, [intentStorageKey])
  const recordLocatorInput = useRef<HTMLInputElement>(null)
  // Destination links (/?from=JFK&to=BOS&date=…) open the search on that route and date.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const from = params.get('from')?.toUpperCase() ?? ''
    const to = params.get('to')?.toUpperCase() ?? ''
    const date = params.get('date') ?? ''
    if (/^[A-Z0-9]{3}$/.test(from) && /^[A-Z0-9]{3}$/.test(to) && (!routes.length || routes.some(route => route.origin === from && route.destination === to))) { setOrigin(from); setDestination(to) }
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) setTimeout(() => setDepartDate(date), 0)
  // Read once on load; routes come from the server render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Bookings saved in this browser (reference → access code), newest first, for one-tap retrieval.
  const [savedTrips, setSavedTrips] = useState<string[]>([])
  const manageForm = useRef<HTMLFormElement>(null)
  useEffect(() => {
    try {
      const prefix = `${storagePrefix}:booking:`
      const trips: string[] = []
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index)
        if (key?.startsWith(prefix)) trips.push(key.slice(prefix.length))
      }
      setSavedTrips(trips.sort())
    } catch { setSavedTrips([]) }
  }, [storagePrefix, confirmation])
  function openSavedTrip(locator: string) {
    try { setBookingCredentials(locator, localStorage.getItem(bookingKey(locator)) ?? '') } catch { return }
    requestAnimationFrame(() => manageForm.current?.requestSubmit())
  }
  // Links from the confirmation email open Manage booking with the reference filled in.
  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get('ref')?.trim().toUpperCase()
    if (reference && /^[A-Z0-9]{5,8}$/.test(reference) && recordLocatorInput.current && !recordLocatorInput.current.value) recordLocatorInput.current.value = reference
    // Back from Stripe, or in from the emailed link: retrieve the booking with the code in the link or saved in this browser.
    if (reference) {
      try {
        // The Stripe return link carries the access code, and the emailed link a signed booking pass, in the fragment
        // (never sent to a server in the URL); either opens the booking in a browser that has nothing saved.
        const fragment = new URLSearchParams(window.location.hash.slice(1))
        const returned = fragment.get('pass') || fragment.get('code')
        if (returned) { localStorage.setItem(`${storagePrefix}:booking:${reference}`, returned); history.replaceState(null, '', window.location.pathname + window.location.search) }
        const saved = localStorage.getItem(`${storagePrefix}:booking:${reference}`)
        if (saved && (returned || new URLSearchParams(window.location.search).get('checkout'))) { setBookingCredentials(reference, saved); requestAnimationFrame(() => manageForm.current?.requestSubmit()) }
      } catch { /* the customer enters the code */ }
    }
  }, [storagePrefix])
  const accessTokenInput = useRef<HTMLInputElement>(null)
  const money = useMemo(() => (amount: number) => formatMinorUnits(amount, selected?.currencyCode ?? carrier.defaultCurrencyCode), [selected?.currencyCode, carrier.defaultCurrencyCode])
  const airportZone = (code: string) => network?.airports.find(entry => entry.code === code)?.timezone || carrier.defaultTimezone
  const flightDuration = (departure: string, arrival: string) => {
    const minutes = Math.round((Date.parse(arrival) - Date.parse(departure)) / 60_000)
    return Number.isFinite(minutes) && minutes > 0 ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m` : null
  }
  // Any age from birth up to the departure date; the server checks the party has a traveler aged 18 or over.
  const birthDateMax = selected?.serviceDate && /^\d{4}-\d{2}-\d{2}$/.test(selected.serviceDate) ? selected.serviceDate : undefined

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
    if (party.adults < 1) { setStatus('Each booking needs at least one adult.', 'warn'); return }
    if (party.infants > party.adults) { setStatus('Each infant travels with an adult.', 'warn'); return }
    if (partySize > 9) { setStatus('Book up to 9 travelers at a time.', 'warn'); return }
    let input: SearchInput
    try { input = parseStorefrontSearchForm(new FormData(event.currentTarget)) }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Search failed.', 'warn'); return }
    if (tripType === 'round-trip' && (!/^\d{4}-\d{2}-\d{2}$/.test(returnDate) || returnDate < input.serviceDate)) { setStatus('Choose a return date on or after the departure date.', 'warn'); return }
    setSearchParty(party); setLeg('outbound'); setEarlierConfirmations([])
    setReturnSearch(tripType === 'round-trip' ? { originCode: input.destinationCode, destinationCode: input.originCode, serviceDate: returnDate, passengerCount: input.passengerCount } : null)
    await runSearch(input)
  }

  const lastSearch = useRef<SearchInput | null>(null)
  async function searchNextServiceDate() {
    if (!nextServiceDate || !lastSearch.current) return
    setDepartDate(nextServiceDate)
    await runSearch({ ...lastSearch.current, serviceDate: nextServiceDate })
  }

  // On the home page the results sit under the hero, so bring them into view once they change.
  function revealFlow() {
    if (hero) requestAnimationFrame(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  async function runSearch(input: SearchInput) {
    lastSearch.current = input; setEditingSearch(false)
    if (pendingBooking || intentUnavailable) { setStatus('Check your previous reservation request first. It may have gone through even if the page didn’t confirm it.', 'warn'); return }
    setBusy(true); setStatus(''); setFlights([]); setSelected(null); setHeldOffer(null); bookingAttempt.current = null
    try {
      const data = await graphql<{ publicAirlineFlightOptions: Flight[] }>(`query($carrier:String!,$origin:String!,$destination:String!,$date:String!,$passengers:Int!){publicAirlineFlightOptions(carrierCode:$carrier,originCode:$origin,destinationCode:$destination,serviceDate:$date,passengerCount:$passengers){id inventoryBucketId flightNumber serviceDate scheduledDepartureAt scheduledArrivalAt originCode destinationCode fareBrand{name description baggagePieces baggageWeightGrams} cabinName totalAmount perTravelerBaseAmount perTravelerTaxAmount perTravelerTotalAmount partyTotalAmount passengerCount currencyCode availability{available}}}`, { carrier: carrier.code, origin: input.originCode, destination: input.destinationCode, date: input.serviceDate, passengers: input.passengerCount })
      setFlights(data.publicAirlineFlightOptions)
      if (!data.publicAirlineFlightOptions.length) {
        const next = datesFor(input.originCode, input.destinationCode).find(date => date > input.serviceDate) ?? null
        setNextServiceDate(next)
        setStatus(`No ${carrier.name} flights are available for this route, date, and party size.`)
      } else setNextServiceDate(null)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Search failed.', 'bad') }
    setBusy(false); revealFlow()
  }

  // Books the return leg of a round trip for the same travelers.
  async function searchReturn() {
    if (!returnSearch || !confirmation) return
    setEarlierConfirmations(current => [...current, confirmation])
    setConfirmation(null); setManagedBooking(null); setLeg('return')
    await runSearch(returnSearch)
  }

  async function holdOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || pendingBooking || intentUnavailable) return
    setBusy(true); setStatus('')
    try {
      const token = shoppingToken()
      const passengers = parseStorefrontPassengers(new FormData(event.currentTarget), selected.passengerCount)
      setTravelerValues(passengers.map(passenger => ({ givenName: passenger.givenName, familyName: passenger.familyName, dateOfBirth: passenger.dateOfBirth, email: passenger.email, phone: passenger.phone ?? '' })))
      const attempt = bookingAttempt.current ?? { offerKey: `web-offer-${crypto.randomUUID()}`, bookingKey: `web-booking-${crypto.randomUUID()}` }
      bookingAttempt.current = attempt
      const data = await graphql<{ createCustomerOffer: HeldOffer }>(`mutation($carrier:String!,$flight:ID!,$bucket:ID!,$token:String!,$key:String!,$passengers:[CustomerPassengerInput!]!){createCustomerOffer(carrierCode:$carrier,flightInstanceId:$flight,inventoryBucketId:$bucket,shoppingSessionToken:$token,idempotencyKey:$key,passengers:$passengers){offerId offerNumber passengerIds totalAmount currencyCode expiresAt}}`, { carrier: carrier.code, flight: selected.id, bucket: selected.inventoryBucketId, token, key: attempt.offerKey, passengers })
      setHeldOffer(data.createCustomerOffer)
      setStatus(`Your fare is held until ${formatAirportClock(data.createCustomerOffer.expiresAt, carrier.defaultTimezone)}. Check the total, then confirm your reservation.`, 'ok')
    } catch (error) { setStatus(error instanceof Error ? error.message : 'The fare could not be held.', 'bad') }
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
      bookingAttempt.current = null; setHeldOffer(null); setSelected(null); setFlights([])
      setStatus(`Reservation ${created.recordLocator} is confirmed and awaiting payment.`, 'ok')
      try {
        const current = await graphql<{ customerBooking: CustomerBooking }>(CUSTOMER_BOOKING_READ, { record: created.recordLocator, token: created.bookingAccessToken })
        setManagedBooking(current.customerBooking)
      } catch { setStatus(`Reservation ${created.recordLocator} is confirmed, but we couldn’t load it yet. Use Manage booking with the reference and your last name; don’t book again.`, 'warn') }
    } catch (error) {
      setStatus(`${error instanceof Error ? error.message : 'We couldn’t confirm your reservation.'} We may still have received it, even if the fare hold has expired. Check its status below before booking again.`, 'warn')
    } finally { setBusy(false) }
  }

  // `refreshAfterChange` rereads the current booking after a successful command without erasing that command's
  // announced result; a failed refresh says so instead of suggesting the command failed.
  async function manage(event?: FormEvent<HTMLFormElement>, refreshAfterChange = false) {
    event?.preventDefault(); setBusy(true)
    if (!refreshAfterChange) setStatus('')
    try {
      const submitted = event ? parseBookingAccessForm(new FormData(event.currentTarget)) : { recordLocator, accessToken, lastName: '' }
      let saved = submitted.accessToken || (submitted.lastName ? '' : localStorage.getItem(bookingKey(submitted.recordLocator))) || ''
      if (!saved && submitted.lastName) {
        // Booking reference and last name, like every airline: the server answers with a pass that works like the access code.
        saved = (await graphql<{ openCustomerBooking: string }>(`query($carrier:String!,$record:String!,$name:String!){openCustomerBooking(carrierCode:$carrier,recordLocator:$record,lastName:$name)}`, { carrier: carrier.code, record: submitted.recordLocator, name: submitted.lastName })).openCustomerBooking
        try { localStorage.setItem(bookingKey(submitted.recordLocator), saved) } catch { /* private mode: the pass lives for this page */ }
      }
      if (!saved) throw new Error('Enter the last name of a traveler on the booking.')
      const data = await graphql<{ customerBooking: CustomerBooking }>(CUSTOMER_BOOKING_READ, { record: submitted.recordLocator, token: saved })
      if (confirmation && confirmation.recordLocator !== data.customerBooking.recordLocator) setConfirmation(null)
      setBookingCredentials(submitted.recordLocator, saved); setManagedBooking(data.customerBooking)
      // Coming back from Stripe (or after a lost redirect): record the paid booking and its tickets, then reread.
      if (carrier.onlinePaymentEnabled && ['unpaid', 'failed'].includes(data.customerBooking.paymentStatus)) {
        const checkoutSessionId = new URLSearchParams(window.location.search).get('checkout')
        try {
          const finished = await graphql<{ completeCustomerCheckout: { status: string; ticketingStatus: string } }>(`mutation($carrier:String!,$record:String!,$token:String!,$session:String){completeCustomerCheckout(carrierCode:$carrier,recordLocator:$record,accessToken:$token,checkoutSessionId:$session){status ticketingStatus}}`, { carrier: carrier.code, record: data.customerBooking.recordLocator, token: saved, session: checkoutSessionId && checkoutSessionId.startsWith('cs_') ? checkoutSessionId : null })
          if (finished.completeCustomerCheckout.status === 'paid') {
            const paid = await graphql<{ customerBooking: CustomerBooking }>(CUSTOMER_BOOKING_READ, { record: data.customerBooking.recordLocator, token: saved })
            setManagedBooking(paid.customerBooking)
            setStatus(finished.completeCustomerCheckout.ticketingStatus === 'ticketed' ? 'Payment received. Your tickets are issued: choose seats and check in below.' : 'Payment received. Your tickets will be issued shortly.', 'ok')
          } else if (checkoutSessionId === 'cancelled') setStatus('Payment cancelled. Your reservation is still held until its payment deadline.', 'warn')
        } catch (error) { setStatus(error instanceof Error ? error.message : 'We couldn’t confirm your payment yet.', 'warn') }
      }
    } catch (error) {
      if (refreshAfterChange) setStatus(current => `${current} We couldn’t refresh your booking just now; retrieve it again to see the latest details.`, 'warn')
      else { setManagedBooking(null); setConfirmation(null); setStatus(error instanceof Error ? error.message : 'Booking could not be retrieved.', 'bad') }
    }
    setBusy(false)
    if (!refreshAfterChange) revealFlow()
  }

  async function payOnline(locator: string, token: string) {
    setBusy(true); setStatus('')
    try {
      const data = await graphql<{ startCustomerCheckout: { url: string } }>(`mutation($carrier:String!,$record:String!,$token:String!){startCustomerCheckout(carrierCode:$carrier,recordLocator:$record,accessToken:$token){url}}`, { carrier: carrier.code, record: locator, token })
      window.location.assign(data.startCustomerCheckout.url)
      return
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Online payment couldn’t start.', 'bad') }
    setBusy(false)
  }

  // Cancel shows exactly what comes back (DOT 24-hour rule, refundable fare less fee) before anything changes.
  const [cancelQuote, setCancelQuote] = useState<{ allowed: boolean; summary: string; refundAmount: number } | null>(null)
  async function reviewCancellation() {
    setBusy(true); setStatus('')
    try {
      const data = await graphql<{ customerCancellationQuote: { allowed: boolean; summary: string; refundAmount: number } }>(`query($record:String!,$token:String!){customerCancellationQuote(recordLocator:$record,accessToken:$token){allowed summary refundAmount}}`, { record: recordLocator, token: accessToken })
      setCancelQuote(data.customerCancellationQuote)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'We couldn’t check this booking’s cancellation terms.', 'bad') }
    setBusy(false)
  }
  async function cancelBooking() {
    setBusy(true)
    try {
      const data = await graphql<{ cancelCustomerBookingWithRefund: { refundAmount: number; currencyCode: string } }>(`mutation($record:String!,$token:String!,$reason:String!,$key:String!){cancelCustomerBookingWithRefund(recordLocator:$record,accessToken:$token,reason:$reason,idempotencyKey:$key){refundAmount currencyCode}}`, { record: recordLocator, token: accessToken, reason: 'Traveler cancelled before departure through self-service.', key: `self-cancel:${recordLocator}:${crypto.randomUUID()}` })
      const refunded = data.cancelCustomerBookingWithRefund
      setCancelQuote(null)
      setStatus(refunded.refundAmount > 0 ? `Booking cancelled. ${formatMinorUnits(refunded.refundAmount, refunded.currencyCode)} is on its way back to your card.` : 'Booking cancelled. Your seats have been released.', 'ok')
      await manage(undefined, true)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Cancellation failed.', 'bad') }
    setBusy(false)
  }

  async function recoverAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true)
    const form = new FormData(event.currentTarget)
    try {
      await graphql(`mutation($carrier:String!,$record:String!,$email:String!){recoverCustomerBookingAccess(carrierCode:$carrier,recordLocator:$record,email:$email)}`, { carrier: carrier.code, record: String(form.get('recordLocator') ?? ''), email: String(form.get('email') ?? '') })
      setStatus('If those details match a booking, a link to it is on its way to that email.'); setRecovering(false)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'We couldn’t send an access code.', 'bad') }
    setBusy(false)
  }

  async function chooseSeat(passengerId: string, segmentId: string, seat: { id: string; surchargeAmount: number }) {
    if (seat.surchargeAmount > 0) { setStatus('Paid seats can’t be selected online.', 'warn'); return }
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
      setStatus(data.assignCustomerSeat.replayed ? 'This seat choice was already recorded. Your current seat is shown below.' : 'Seat selected.', 'ok')
      await manage(undefined, true)
    } catch (error) {
      if (!(error instanceof OutcomeUnknownError)) seatIntent.current = null
      setStatus(error instanceof Error ? error.message : 'Seat selection failed.', 'bad')
    }
    setBusy(false)
  }

  async function customerCheckIn(passengerId: string, segmentId: string, retryMarker = 'initial') {
    setBusy(true)
    try { await graphql(`mutation($record:String!,$token:String!,$passenger:ID!,$segment:ID!,$key:String!){checkInCustomerBooking(recordLocator:$record,accessToken:$token,bookingPassengerId:$passenger,bookingSegmentId:$segment,idempotencyKey:$key){status}}`, { record: recordLocator, token: accessToken, passenger: passengerId, segment: segmentId, key: `customer-checkin-${passengerId}-${segmentId}-${retryMarker}` }); setStatus(`Check-in completed with ${carrier.name}. Boarding-pass details are shown below.`, 'ok'); await manage(undefined, true) }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Check-in failed.', 'bad') }
    setBusy(false)
  }

  const passLabel = selected ? `${selected.passengerCount} traveler${selected.passengerCount === 1 ? '' : 's'}` : ''

  const partyRows = [['adults', 'Adults', '12 and over', 1, 9], ['children', 'Children', '2 to 11', 0, 8], ['infants', 'Infants', 'Under 2, own seat', 0, party.adults]] as const
  const setPartyCount = (key: keyof Party, value: number) => setParty(current => { const next = { ...current, [key]: value }; return { ...next, infants: Math.min(next.infants, next.adults) } })
  const searchForm = <form onSubmit={search}>
    <div className="af-widget-grid" data-return={tripType === 'round-trip' ? 'true' : undefined}>
      <div className="af-field af-icon-field af-field-wide"><span className="af-field-label">From</span><MapPin aria-hidden="true" />{routes.length ? <PlatformSelect aria-label="Origin airport" name="originCode" value={origin} onValueChange={next => { setOrigin(next); const reachable = routes.filter(route => route.origin === next).map(route => route.destination); if (!reachable.includes(destination)) setDestination('') }} required className="af-input af-trigger" options={[...new Set(routes.map(route => route.origin))].map(code => ({ value: code, label: airportLabel(code) }))} /> : <input aria-label="Origin airport" name="originCode" value={origin} onChange={event => setOrigin(event.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" inputMode="text" pattern="[A-Za-z0-9]{3}" maxLength={3} required placeholder="JFK" className="af-input af-input-code" />}</div>
      <button type="button" aria-label="Swap origin and destination" disabled={!canSwap} onClick={() => { setOrigin(destination); setDestination(origin) }} className="af-swap"><ArrowLeftRight aria-hidden="true" /></button>
      <div className="af-field af-icon-field af-field-wide"><span className="af-field-label">To</span><MapPin aria-hidden="true" />{routes.length ? <PlatformSelect aria-label="Destination airport" name="destinationCode" value={destination} onValueChange={setDestination} required placeholder="Select a destination" className="af-input af-trigger" options={destinations.map(code => ({ value: code, label: airportLabel(code) }))} /> : <input aria-label="Destination airport" name="destinationCode" value={destination} onChange={event => setDestination(event.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" inputMode="text" pattern="[A-Za-z0-9]{3}" maxLength={3} required placeholder="BOS" className="af-input af-input-code" />}</div>
      <div className="af-field"><span className="af-field-label">Depart</span><PlatformDateInput aria-label="Departure date" name="serviceDate" value={departDate} onChange={setDepartDate} required placeholder="Select date" className="af-input af-trigger" /></div>
      {tripType === 'round-trip' && <div className="af-field"><span className="af-field-label">Return</span><PlatformDateInput aria-label="Return date" value={returnDate} min={departDate} onChange={setReturnDate} required placeholder="Select date" className="af-input af-trigger" /></div>}
      <div className="af-field af-icon-field"><span className="af-field-label">Travelers</span><UserRound aria-hidden="true" />
        <input type="hidden" name="passengerCount" value={partySize} />
        <Popover>
          <PopoverTrigger asChild><button type="button" aria-label={`Travelers: ${partyLabel}`} className="af-input af-trigger justify-between"><span className="min-w-0 truncate">{partyLabel}</span><ChevronDown aria-hidden="true" className="shrink-0" /></button></PopoverTrigger>
          <PopoverContent align="start" collisionPadding={12} className="af-party p-4">
            <div>{partyRows.map(([key, text, hint, min, max]) => <div key={key} className="af-party-row">
              <div><p className="af-party-type">{text}</p><p className="af-party-hint">{hint}</p></div>
              <div className="flex items-center gap-2"><button type="button" aria-label={`Fewer ${text.toLowerCase()}`} disabled={party[key] <= min} onClick={() => setPartyCount(key, party[key] - 1)} className="af-stepper"><Minus aria-hidden="true" /></button><span aria-live="polite" aria-label={`${text}: ${party[key]}`} className="af-party-count">{party[key]}</span><button type="button" aria-label={`More ${text.toLowerCase()}`} disabled={party[key] >= max || partySize >= 9} onClick={() => setPartyCount(key, party[key] + 1)} className="af-stepper"><Plus aria-hidden="true" /></button></div>
            </div>)}</div>
            <p className="af-party-note">Up to 9 travelers, with one aged 18 or over.</p>
          </PopoverContent>
        </Popover>
      </div>
      <button disabled={busy} className="af-pill af-pill-primary af-widget-submit">{busy ? 'Searching…' : <>Find flights<ArrowRight aria-hidden="true" /></>}</button>
    </div>
  </form>
  const inWidget = Boolean(hero)
  // On a phone the hero folds to one line once the traveler is past the search, so the results are the page.
  const inFlow = flights.length > 0 || Boolean(confirmation) || Boolean(managedBooking) || Boolean(pendingBooking)
  const tripSummary = confirmation || managedBooking ? `Booking ${(confirmation ?? managedBooking)!.recordLocator}` : flights[0] ? `${flights[0].originCode} to ${flights[0].destinationCode} · ${formatServiceDay(flights[0].serviceDate, false)} · ${flights[0].passengerCount} traveler${flights[0].passengerCount === 1 ? '' : 's'}` : 'Your trip'
  const recovery = carrier.accessRecoveryEnabled
    ? <div className="af-rule mt-4 pt-3">
      {recovering ? <form onSubmit={recoverAccess} className="grid gap-4 py-2 sm:grid-cols-[1fr_1.6fr_auto] sm:items-end">
        <label className="af-field"><span className="af-field-label">Booking reference</span><input name="recordLocator" autoCapitalize="characters" autoComplete="off" placeholder="ABC123" required className="af-input af-input-code" /></label>
        <label className="af-field"><span className="af-field-label">Lead traveler email</span><input name="email" type="email" autoComplete="email" required className="af-input" /></label>
        <div className="af-track"><button disabled={busy} className="af-pill af-pill-primary">Email new code</button><button type="button" onClick={() => setRecovering(false)} className="af-pill">Cancel</button></div>
      </form> : <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"><p className="text-sm text-[var(--af-ink-2)]">Can’t open your booking?</p><button type="button" onClick={() => setRecovering(true)} className="af-pill af-pill-sm">Email me a link</button></div>}
    </div>
    : <p className="af-rule mt-4 pt-3 text-sm text-[var(--af-ink-2)]">Can’t open your booking? <a href="/contact" className="af-link">Contact the airline</a></p>
  const manageBlock = <>
    <div className={inWidget ? '' : 'af-card p-4 sm:p-6'}>
      <form ref={manageForm} onSubmit={manage}>
        <h2 className={inWidget ? 'sr-only' : 'af-card-title'}>{mode === 'check-in' ? `Check in with ${carrier.name}` : `Manage ${carrier.name} booking`}</h2>
        <div className={`grid gap-4 sm:grid-cols-[1fr_1.6fr_auto] sm:items-end ${inWidget ? '' : 'mt-4'}`}>
          <label className="af-field"><span className="af-field-label">Booking reference</span><input ref={recordLocatorInput} aria-label="Booking reference" name="recordLocator" defaultValue="" autoCapitalize="characters" autoComplete="off" placeholder="ABC123" required className="af-input af-input-code" /></label>
          <label className="af-field"><span className="af-field-label">Last name</span><input aria-label="Last name" name="lastName" autoComplete="family-name" autoCapitalize="words" placeholder="As on the booking" className="af-input" /></label><input ref={accessTokenInput} type="hidden" name="accessToken" defaultValue="" />
          <div className="af-track" data-block="true"><button disabled={busy} className="af-pill af-pill-primary">{busy ? 'Retrieving…' : mode === 'check-in' ? 'Retrieve for check-in' : 'Retrieve'}</button></div>
        </div>
      </form>
      {recovery}
    </div>
    {!shoppingEnabled && savedTrips.length > 0 && <section aria-label="Your trips" className="af-card px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-3"><h2 className="af-field-label">Your trips</h2><div className="af-track flex-wrap">{savedTrips.map(locator => <button key={locator} type="button" disabled={busy} onClick={() => openSavedTrip(locator)} aria-pressed={managedBooking?.recordLocator === locator} className="af-pill af-pill-sm af-code">{locator}</button>)}</div></div>
    </section>}
  </>
  const flow = <>
    {shoppingEnabled && !hero && <div className="af-widget-panel" data-standalone="true">{searchForm}</div>}
    {status && <p role="status" className="af-notice" data-tone={statusTone}><span className="af-dot" data-tone={statusTone} />{status}</p>}
    {shoppingEnabled && nextServiceDate && flights.length === 0 && <div className="af-track w-fit"><button disabled={busy} onClick={() => void searchNextServiceDate()} className="af-pill af-pill-sm">Next flight: {formatServiceDay(nextServiceDate, false)}</button></div>}
    {pendingBooking && <section aria-label="Original reservation command recovery" className="af-notice flex-col items-stretch gap-3 p-5" data-tone="warn">
      <h2 className="af-title-line font-semibold"><span className="af-dot" data-tone="warn" />We’re checking your reservation</h2>
      <p>Your request is saved in this tab. Checking never creates a booking, and a retry sends the same request.</p>
      <div className="af-track w-fit"><button disabled={busy} onClick={() => void confirmBooking(true)} className="af-pill">Check status</button><button disabled={busy} onClick={() => void confirmBooking(false)} className="af-pill">Retry original request</button></div>
      <p>Don’t book again. If this doesn’t clear, contact the airline.</p>
    </section>}
    {earlierConfirmations.map(earlier => <section key={earlier.recordLocator} aria-label={`Outbound reservation ${earlier.recordLocator}`} className="af-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div><p className="af-field-label">Outbound · reservation</p><p className="af-code mt-1 text-2xl font-semibold">{earlier.recordLocator}</p></div>
      <p className="text-sm text-[var(--af-ink-2)]">Open it from Manage booking with this reference and your last name.</p>
    </section>)}
    {confirmation && <section className="af-pass" aria-label={`${carrier.name} reservation confirmation`}>
      <div className="min-w-0">
        <div className="af-pass-head flex items-center justify-between gap-3 px-5 py-3 sm:px-6"><span className="af-eyebrow min-w-0 truncate">{carrier.name} · {leg === 'return' ? 'Return reservation' : returnSearch ? 'Outbound reservation' : 'Reservation'}</span><span className="af-mono shrink-0 text-xs font-semibold">{confirmation.carrierCode}</span></div>
        <div className="p-5 sm:p-6">
          <p className="af-field-label">Booking reference</p>
          <h2 className="af-code mt-1 text-4xl font-semibold sm:text-5xl">{confirmation.recordLocator}</h2>
          <p className="af-title-line mt-4 text-sm font-medium"><span className="af-dot" data-tone="warn" />Awaiting payment · {carrier.onlinePaymentEnabled ? 'pay now to get your tickets' : 'held for 24 hours unless paid'}</p>
        </div>
      </div>
      <div className="af-pass-stub p-5 sm:p-6">
        <p className="text-sm text-[var(--af-ink-2)]">Find this booking any time with the reference and your last name.{carrier.accessRecoveryEnabled ? ' We also emailed it to the lead traveler.' : ''}</p>
        {carrier.onlinePaymentEnabled && <div className="af-track mt-4" data-block="true"><button disabled={busy} onClick={() => void payOnline(confirmation.recordLocator, confirmation.token)} className="af-pill af-pill-primary">Pay now</button></div>}
        {shoppingEnabled && leg === 'outbound' && returnSearch && <div className="af-track mt-2" data-block="true"><button disabled={busy} onClick={() => void searchReturn()} className={`af-pill ${carrier.onlinePaymentEnabled ? '' : 'af-pill-primary'}`}>Book return flight</button></div>}
      </div>
    </section>}
    {shoppingEnabled && flights.length > 0 && <section aria-label="Available flights" className="af-table space-y-4">
      <div className="af-results-head"><div className="af-meta"><p className="af-meta-row">{returnSearch && <span className="font-semibold">{leg === 'return' ? 'Return' : 'Outbound'}</span>}<span>{airportCity(flights[0].originCode)} {flights[0].originCode} to {airportCity(flights[0].destinationCode)} {flights[0].destinationCode}</span><span>{formatServiceDay(flights[0].serviceDate, false)}</span><span>{flights[0].passengerCount} traveler{flights[0].passengerCount === 1 ? '' : 's'}</span></p></div></div>
      <div className="af-meta text-sm text-[var(--af-ink-3)]"><ul aria-label="Booking terms" className="af-meta-row">{carrier.onlinePaymentEnabled ? <li>Pay by card online</li> : <li>Reserve now, pay the airline directly</li>}<li>Unpaid reservations held up to 24 hours</li><li>One traveler 18 or over per booking</li><li>Infants have their own seat</li></ul></div>
      {flights.map(flight => {
        const duration = flightDuration(flight.scheduledDepartureAt, flight.scheduledArrivalAt)
        const isSelected = selected?.id === flight.id && selected?.inventoryBucketId === flight.inventoryBucketId
        const soldOut = flight.availability.available < flight.passengerCount
        const bags = flight.fareBrand.baggagePieces ?? 0
        const bagText = bags ? `${bags} checked bag${bags === 1 ? '' : 's'}${flight.fareBrand.baggageWeightGrams ? `, ${Math.round(flight.fareBrand.baggageWeightGrams / 1000)} kg each` : ''}` : 'No checked bag'
        const price = formatMinorUnits(flight.perTravelerTotalAmount, flight.currencyCode)
        const fromZone = airportZone(flight.originCode)
        const toZone = airportZone(flight.destinationCode)
        const arrivesLater = dayShift(flight.scheduledDepartureAt, fromZone, flight.scheduledArrivalAt, toZone)
        const fewSeats = !soldOut && flight.availability.available <= 9
        return <article key={`${flight.id}:${flight.inventoryBucketId}`} data-selected={isSelected ? 'true' : undefined} className="af-flight">
          <div className="min-w-0 min-[900px]:self-center">
            <div className="af-meta text-lg text-[var(--af-ink-2)]"><p className="af-meta-row"><span>{carrier.code} {flight.flightNumber}</span><span>Nonstop</span>{duration ? <span>{duration}</span> : null}</p></div>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div><p className="af-time">{airportClock(flight.scheduledDepartureAt, fromZone)}</p><p className="mt-1 text-lg text-[var(--af-ink-2)]">{flight.originCode}</p></div>
              <span aria-hidden="true" className="af-path mb-9 hidden text-[var(--af-ink-3)] sm:block" />
              <div className="text-right"><p className="af-time">{airportClock(flight.scheduledArrivalAt, toZone)}{arrivesLater > 0 ? <sup className="af-day-shift"><span className="sr-only">, arrives </span>+{arrivesLater}<span className="sr-only"> {arrivesLater === 1 ? 'day' : 'days'}</span></sup> : null}</p><p className="mt-1 text-lg text-[var(--af-ink-2)]">{flight.destinationCode}</p></div>
            </div>
            <p className="mt-2 text-sm text-[var(--af-ink-3)]">{formatServiceDay(flight.serviceDate, false)} · Local time at each airport</p>
          </div>
          <div className="af-flight-fare flex min-w-0 flex-col">
            <p className="text-xl font-bold">{[flight.fareBrand.name, flight.cabinName].filter(Boolean).join(' · ')}</p>
            <p className="af-price mt-2">{price}</p>
            <p className="mt-2 text-base leading-snug text-[var(--af-ink-2)]">Per traveler. Includes {formatMinorUnits(flight.perTravelerTaxAmount, flight.currencyCode)} taxes{bags ? `, seat selection, ${bagText}` : ', seat selection'}.{flight.passengerCount > 1 ? ` ${formatMinorUnits(flight.partyTotalAmount, flight.currencyCode)} for ${flight.passengerCount} travelers.` : ''}</p>
            {flight.fareBrand.description && <p className="mt-1 text-sm text-[var(--af-ink-3)]">{flight.fareBrand.description}</p>}
            <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-base text-[var(--af-ink-2)]"><span className="inline-flex items-center gap-2"><Luggage aria-hidden="true" className="size-5" strokeWidth={1.5} />{bags ? 'Checked bag' : 'Carry-on only'}</span>{fewSeats ? <span className="font-semibold text-[var(--af-warn)]">{flight.availability.available === 1 ? 'Last seat at this fare' : `${flight.availability.available} seats left at this fare`}</span> : null}</p>
            <button onClick={() => { setSelected(flight); setHeldOffer(null); bookingAttempt.current = null }} disabled={busy || Boolean(pendingBooking) || intentUnavailable || soldOut} aria-pressed={isSelected} className={`af-pill af-pill-lg mt-4 w-full ${selected ? '' : 'af-pill-primary'}`}>{soldOut ? 'Sold out' : isSelected ? <><Check aria-hidden="true" />Selected · {price}</> : `Select · ${price}`}</button>
          </div>
        </article>
      })}
    </section>}
    {shoppingEnabled && selected && !pendingBooking && !intentUnavailable && <form key={`${selected.id}:${selected.inventoryBucketId}`} onSubmit={holdOffer} className="af-pass">
      <div className="min-w-0">
        <div className="af-pass-head flex items-center justify-between gap-3 px-5 py-3 sm:px-6"><span className="af-eyebrow">Travelers · {passLabel}</span><button type="button" onClick={() => { setSelected(null); setHeldOffer(null); bookingAttempt.current = null }} className="af-pill af-pill-sm af-pill-ghost">Close</button></div>
        <div className="space-y-6 p-5 sm:p-6">{Array.from({ length: selected.passengerCount }, (_, passengerIndex) => <fieldset disabled={Boolean(heldOffer)} key={passengerIndex} className="grid gap-4 disabled:opacity-70 sm:grid-cols-2">
          <legend className="af-title-line mb-3 items-center text-sm font-semibold"><span aria-hidden="true" className="af-num">{passengerIndex + 1}</span>Traveler {passengerIndex + 1}<span className="text-xs font-medium text-[var(--af-ink-3)]">{travelerBand(passengerIndex, searchParty)}</span></legend>
          {travelerFields.map(field => field === 'dateOfBirth'
            ? <div key={`${field}:${travelerValues[passengerIndex]?.[field] ?? ''}`} className="af-field"><span className="af-field-label">{fieldLabel(field, passengerIndex)}</span><PlatformDateInput yearPicker required aria-label={`Date of birth, traveler ${passengerIndex + 1}`} name={`passenger.${passengerIndex}.${field}`} defaultValue={travelerValues[passengerIndex]?.[field] ?? ''} max={birthDateMax} placeholder="Select date" className="af-input af-trigger" /></div>
            : <label key={field} className="af-field"><span className="af-field-label">{fieldLabel(field, passengerIndex)}</span><input required={field !== 'phone' && (field !== 'email' || passengerIndex === 0)} type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'} name={`passenger.${passengerIndex}.${field}`} autoComplete={field === 'email' ? 'email' : field === 'phone' ? 'tel' : passengerIndex === 0 && field === 'givenName' ? 'given-name' : passengerIndex === 0 && field === 'familyName' ? 'family-name' : 'off'} defaultValue={travelerValues[passengerIndex]?.[field] ?? ''} className="af-input" /></label>)}
        </fieldset>)}</div>
      </div>
      <div className="af-pass-stub flex flex-col gap-4 p-5 sm:p-6">
        <div><p className="af-field-label">Flight</p><p className="af-mono mt-1 text-lg font-semibold">{carrier.code} {selected.flightNumber}</p><p className="af-display mt-1 flex items-center gap-2 text-3xl uppercase">{selected.originCode}<span className="af-path text-[var(--af-ink-3)]" />{selected.destinationCode}</p><p className="mt-1 text-sm text-[var(--af-ink-2)]">{formatServiceDay(selected.serviceDate, false)} · {formatAirportClock(selected.scheduledDepartureAt, airportZone(selected.originCode))}</p><p className="text-sm text-[var(--af-ink-3)]">{[selected.fareBrand.name, selected.cabinName].filter(Boolean).join(' · ')}</p></div>
        <div className="af-rule pt-4"><p className="af-field-label">Total</p><p className="af-mono mt-1 text-2xl font-semibold">{heldOffer ? formatMinorUnits(heldOffer.totalAmount, heldOffer.currencyCode) : money(selected.partyTotalAmount)}</p>{selected.passengerCount > 1 && <p className="af-mono text-sm text-[var(--af-ink-3)]">{money(selected.perTravelerTotalAmount)} per traveler × {selected.passengerCount}</p>}</div>
        {heldOffer ? <div className="space-y-3">
          <p className="af-title-line text-sm font-semibold"><span className="af-dot" data-tone="ok" />Fare held until {formatAirportClock(heldOffer.expiresAt, carrier.defaultTimezone)}</p>
          <p className="text-sm text-[var(--af-ink-3)]">{carrier.onlinePaymentEnabled ? 'You pay by card once you confirm.' : 'You pay the airline directly once you confirm.'}</p>
          <div className="af-track" data-block="true"><button type="button" disabled={busy} onClick={() => void confirmBooking()} className="af-pill af-pill-primary">Confirm reservation</button></div>
        </div> : <div className="af-track mt-auto" data-block="true"><button disabled={busy} className="af-pill af-pill-primary">Hold fare for {passLabel}</button></div>}
      </div>
    </form>}
    {!hero && manageBlock}
    {managedBooking && <section aria-label={`Booking ${managedBooking.recordLocator}`} className="space-y-5">
      <div className="af-card overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="af-eyebrow">Booking reference</p>
            <h2 className="af-title-line mt-2"><span className="af-dot" data-tone={tripTone(managedBooking.status)} /><span className="af-code text-3xl font-semibold">{managedBooking.recordLocator}</span><span className="text-sm font-semibold text-[var(--af-ink-2)]">{label(bookingStatusLabels, managedBooking.status)}</span></h2>
            <dl className="af-mono mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--af-ink-3)]"><div className="flex gap-2"><dt>Payment</dt><dd className="text-[var(--af-ink)]">{label(paymentStatusLabels, managedBooking.paymentStatus)}</dd></div><div className="flex gap-2"><dt>Ticket</dt><dd className="text-[var(--af-ink)]">{label(ticketStatusLabels, managedBooking.ticketingStatus)}</dd></div></dl>
          </div>
          {mode !== 'check-in' && <div className="af-track w-fit flex-wrap">{carrier.onlinePaymentEnabled && confirmation?.recordLocator !== managedBooking.recordLocator && ['unpaid', 'failed'].includes(managedBooking.paymentStatus) && managedBooking.status !== 'cancelled' && <button disabled={busy} onClick={() => void payOnline(managedBooking.recordLocator, accessToken)} className="af-pill af-pill-primary af-pill-sm">Pay now</button>}{!['cancelled', 'completed'].includes(managedBooking.status) && <button disabled={busy} onClick={() => void reviewCancellation()} className="af-pill af-pill-danger af-pill-sm">Cancel booking</button>}</div>}
          {mode !== 'check-in' && cancelQuote && managedBooking.status !== 'cancelled' && <div role="region" aria-label="Cancel booking" className="af-notice mt-3 w-full max-w-xl flex-col !items-stretch" data-tone={cancelQuote.allowed ? 'warn' : 'bad'}>
            <p className="text-sm font-medium"><span className="af-dot" data-tone={cancelQuote.allowed ? 'warn' : 'bad'} />{cancelQuote.summary}</p>
            <div className="af-track mt-3 flex-wrap">{cancelQuote.allowed && <button disabled={busy} onClick={() => void cancelBooking()} className="af-pill af-pill-danger af-pill-sm">{cancelQuote.refundAmount > 0 ? 'Cancel and refund' : 'Cancel booking'}</button>}<button type="button" onClick={() => setCancelQuote(null)} className="af-pill af-pill-sm">{cancelQuote.allowed ? 'Keep booking' : 'Close'}</button>{!cancelQuote.allowed && <a href="/contact" className="af-pill af-pill-sm">Contact the airline</a>}</div>
          </div>}
        </div>
        <div className="af-rule bg-[var(--af-paper)] px-5 py-4 sm:px-6">
          {managedBooking.bookingReceipt.accepted ? <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1"><p className="af-field-label">Booked fare</p>{managedBooking.bookingReceipt.accepted.items.map((item, index) => <p key={index} className="text-sm">{item.description} · {item.quantity === 1 ? '1 traveler' : `${item.quantity} travelers`} · {item.fareName ?? 'Accepted fare'}{item.includedBaggage ? ` · ${item.includedBaggage.pieces} ${item.includedBaggage.pieces === 1 ? 'bag' : 'bags'}, ${item.includedBaggage.maxWeightGrams / 1000} kg` : ''}</p>)}</div>
            <p className="af-mono text-xl font-semibold">{formatMinorUnits(managedBooking.bookingReceipt.accepted.totalAmount, managedBooking.bookingReceipt.accepted.currencyCode)}</p>
          </div> : <p role="status" className="text-sm text-[var(--af-ink-2)]">Original fare details unavailable.</p>}
          <p className="mt-3 text-sm text-[var(--af-ink-3)]">{managedBooking.status === 'cancelled' ? 'This booking is cancelled' : ['paid', 'partially_refunded'].includes(managedBooking.paymentStatus) ? 'Paid by card online' : carrier.onlinePaymentEnabled ? 'Card payment online · tickets issue when paid' : 'No online payment · paid once the airline confirms'}</p>
        </div>
      </div>
      {managedBooking.segments.map(segment => {
        const departure = localTime(segment.actualDepartureAt ?? segment.estimatedDepartureAt ?? segment.scheduledDepartureAt, segment.originTimezone)
        const arrival = localTime(segment.actualArrivalAt ?? segment.estimatedArrivalAt ?? segment.scheduledArrivalAt, segment.destinationTimezone)
        const closedReason = segmentClosedReason(segment, bookingReadAt)
        const serviceOpen = seatSelectionOpen(managedBooking) && !closedReason
        return <article key={segment.id} className="af-card overflow-hidden">
          <header className="af-board px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3"><p className="af-board-cell af-signal text-sm font-semibold">{managedBooking.carrier.code} {segment.flightNumber}{segment.serviceDate ? ` · ${formatServiceDay(segment.serviceDate)}` : ''}</p><p className="af-title-line text-sm font-semibold"><span className="af-dot" data-tone={segmentTone(segment.status)} />{label(segmentStatusLabels, segment.status)}</p></div>
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
                  <p className="af-mono mt-1 pl-4 text-xs text-[var(--af-ink-3)]">{checkIn ? label(checkInStatusLabels, checkIn.status) : 'Not checked in'}{currentSeat ? ` · Seat ${currentSeat.designator}` : ''}</p>
                  {passenger.acceptedName && (passenger.acceptedName.givenName !== passenger.passenger.givenName || passenger.acceptedName.familyName !== passenger.passenger.familyName) && <p className="mt-2 pl-4 text-xs text-[var(--af-warn)]">Booked as {passenger.acceptedName.givenName} {passenger.acceptedName.familyName}. Contact the airline to update.</p>}
                </div>
                {serviceOpen && (!checkIn || checkIn.status === 'offloaded') && <div className="af-track"><button onClick={() => customerCheckIn(passenger.id, segment.id, checkIn?.offloadedAt ?? 'initial')} className="af-pill af-pill-primary af-pill-sm">{checkIn?.status === 'offloaded' ? 'Re-check in' : 'Check in'}</button></div>}
              </div>
              {serviceOpen ? <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="af-field-label">Choose a seat</p><ul aria-label="Seat key" className="af-seat-key">{([['selected', 'Yours'], ['taken', 'Taken'], ['paid', 'Paid, not online']] as const).map(([state, name]) => <li key={state}><span aria-hidden="true" className="af-seat-swatch" data-state={state} />{name}</li>)}</ul></div>
                {(() => { const map = seatRows(segment.seats); const lockedByCheckIn = Boolean(checkIn && checkIn.status !== 'offloaded'); return <div aria-label={`Seats for ${segment.originCode} to ${segment.destinationCode}`} className="af-well -mx-2 max-h-96 overflow-auto px-2 py-3 sm:mx-0 sm:px-3">
                  <div className="mx-auto w-fit space-y-1.5">
                    <div aria-hidden="true" className="flex items-center gap-1.5"><span className="w-7" />{map.columns.map((column, index) => <span key={column} className={`af-seat-label w-10 max-[389px]:w-9 text-center sm:w-11 ${index === map.aisleAfter ? 'mr-5' : ''}`}>{column}</span>)}</div>
                    {map.rows.map(([row, seatsByColumn]) => <div key={row} className="flex items-center gap-1.5"><span className="af-seat-label w-7 text-right">{row || ''}</span>{map.columns.map((column, index) => { const seat = seatsByColumn.get(column); const spacing = index === map.aisleAfter ? 'mr-5' : ''; if (!seat) return <span key={column} aria-hidden="true" className={`w-10 max-[389px]:w-9 sm:w-11 ${spacing}`} />; const mine = seat.selectedForPassengerId === passenger.id; return <button key={seat.id} disabled={seat.surchargeAmount > 0 || !seat.isAvailable || lockedByCheckIn} onClick={() => chooseSeat(passenger.id, segment.id, seat)} data-state={mine ? 'selected' : !seat.isAvailable ? 'taken' : seat.surchargeAmount > 0 ? 'paid' : undefined} aria-label={`Seat ${seat.designator}${mine ? ', selected' : !seat.isAvailable ? ', occupied' : ''}${seat.surchargeAmount ? `, ${formatMinorUnits(seat.surchargeAmount, seat.currencyCode)}, not available online` : ''}`} className={`af-seat w-10 max-[389px]:w-9 text-xs sm:w-11 ${spacing}`}>{column}</button> })}</div>)}
                  </div>
                </div> })()}
              </div> : managedBooking.status === 'cancelled' || segment.status === 'cancelled' ? null : <p className="text-sm text-[var(--af-ink-3)]">{closedReason ?? 'Seat selection opens once your ticket is issued.'}</p>}
              {pass && <div className="af-pass" aria-label={`Boarding pass ${pass.passNumber}`}>
                <div className="min-w-0">
                  <div className="af-pass-head flex items-center justify-between gap-3 px-5 py-2.5"><span className="af-eyebrow">Boarding pass</span><span className="text-xs font-semibold">{label(passStatusLabels, pass.status)}</span></div>
                  <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
                    {[['Seat', pass.seatDesignatorSnapshot], ['Group', pass.boardingGroup], ['Terminal', pass.terminalSnapshot], ['Gate', pass.gateSnapshot]].filter(([, value]) => value?.trim()).map(([name, value]) => <div key={name}><p className="af-field-label">{name}</p><p className="af-mono mt-1 text-2xl font-semibold">{value}</p></div>)}
                  </div>
                </div>
                <div className="af-pass-stub p-5"><p className="af-field-label">Pass</p><p className="af-mono mt-1 font-semibold">{pass.passNumber}</p><p className="af-field-label mt-3">Boarding code</p><code className="af-code af-well mt-1 block break-all px-3 py-2 text-xs">{pass.barcodeToken}</code></div>
              </div>}
            </div>
          })}</div>
        </article>
      })}
    </section>}
  </>

  if (!hero) return <div className="space-y-6">{flow}</div>
  return <>
    <HomeHero lead={hero.lead} compact={inFlow && !editingSearch} summary={inFlow && !editingSearch ? <button type="button" onClick={() => setEditingSearch(true)} className="af-trip-summary"><span className="min-w-0 truncate">{tripSummary}</span><span className="shrink-0 font-semibold underline underline-offset-4">Change</span></button> : null}>
      <div role="tablist" aria-label="Book or manage" className="af-widget-tabs">
        <button type="button" role="tab" id="af-tab-book" aria-selected={widgetTab === 'book'} aria-controls="af-panel-book" onClick={() => setWidgetTab('book')} className="af-widget-tab"><Plane aria-hidden="true" />Book a flight</button>
        <button type="button" role="tab" id="af-tab-manage" aria-selected={widgetTab === 'manage'} aria-controls="af-panel-manage" onClick={() => setWidgetTab('manage')} className="af-widget-tab"><Ticket aria-hidden="true" />Manage booking</button>
      </div>
      <div className="af-widget-panel">
        <div role="tabpanel" id="af-panel-book" aria-labelledby="af-tab-book" hidden={widgetTab !== 'book'}>{searchForm}</div>
        <div role="tabpanel" id="af-panel-manage" aria-labelledby="af-tab-manage" hidden={widgetTab !== 'manage'}>{manageBlock}</div>
      </div>
    </HomeHero>
    <div id="results" className="af-container scroll-mt-4 space-y-6 pt-8 empty:hidden">{flow}</div>
  </>
}
