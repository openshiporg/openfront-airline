import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'
import type { Context } from '.keystone/types'

import { hasCurrentStorefrontBookingAccess, hashStorefrontToken, withStorefrontSession } from '../lib/storefront-session'
import { consumeDurableRateLimit, isDurableRateLimitExhausted } from '../lib/rate-limit'
import { durableRequestFingerprint } from '../lib/request-identity'
import { runSerializableTransaction, throwIfKeystonePrismaError } from '../lib/transactions'
import { publicBookingReceipt } from '../lib/booking-acceptance'
import { beginOperation, cancelBooking, createBookingFromOffer, finishOperation, inspectOperation, normalizeIdempotencyKey, writeAudit } from './airlineOperations'
import { checkInBookingPassenger, createOfferInTransaction, normalizeSearchDate, searchAirlineFlights, validatePassengerCount, type CreateOfferResult } from './airlineWorkflows'
import { assertDatedFlightEligibleForAction } from '../lib/service-eligibility'
import { hasConfiguredStorefrontBrand, normalizeStorefrontBrandColor } from '../../airline/lib/branding'
import { DomainError } from '../lib/domain-error'

// Creation budgets are charged only for admitted new work (and failed proofs), after the exact accepted command has
// been looked up: replays and read-only recovery of an ambiguous outcome never consume them.
async function consumeRateLimit(context: Context, scope: string, limit: number, windowMs: number, sessionSignal?: string) {
  const request = (context as any).req ?? {}
  // The client bucket cannot be evaded by rotating storefront/session tokens.
  await consumeDurableRateLimit(context.prisma, `${scope}.client`, durableRequestFingerprint(request), limit, windowMs)
  if (sessionSignal) await consumeDurableRateLimit(context.prisma, `${scope}.session`, durableRequestFingerprint(request, sessionSignal), limit, windowMs)
}

function bookingAccessToken(shoppingSessionToken: string, offerId: string) {
  return crypto.createHmac('sha256', shoppingSessionToken).update(`booking-access:${offerId}`).digest('base64url')
}

function requiredText(value: string, label: string, max = 120) {
  const normalized = value?.trim()
  if (!normalized || normalized.length > max) throw new DomainError(`${label} is required and must be at most ${max} characters.`)
  return normalized
}

function email(value: string) {
  const normalized = requiredText(value, 'Email', 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new DomainError('Enter a valid email address.')
  return normalized
}

export async function lookupDirectCarrier(prisma: any, carrierCode: string) {
  const carrier = await prisma.carrier.findFirst({
    where: { code: carrierCode.trim().toUpperCase(), status: 'active', directSalesEnabled: true },
    select: {
      id: true,
      code: true,
      name: true,
      legalName: true,
      defaultCurrencyCode: true,
      defaultTimezone: true,
      storefrontBrandColor: true,
      storefrontHomepageTitle: true,
      storefrontHomepageDescription: true,
    },
  })
  if (!carrier) throw new DomainError('Direct sales are not available for this carrier.')
  const storefrontBrandColor = normalizeStorefrontBrandColor(carrier.storefrontBrandColor)
  const storefrontConfigured = hasConfiguredStorefrontBrand({ ...carrier, storefrontBrandColor })
  if (!storefrontConfigured) throw new DomainError('Online booking isn’t available right now. Please try again later.')
  return { ...carrier, storefrontBrandColor, storefrontConfigured, salesEnabled: true }
}

export async function lookupCarrierIdentity(prisma: any, carrierCode: string) {
  const carrier = await prisma.carrier.findUnique({
    where: { code: carrierCode.trim().toUpperCase() },
    select: { id: true, code: true, name: true, legalName: true, defaultCurrencyCode: true, defaultTimezone: true, status: true, directSalesEnabled: true, storefrontBrandColor: true, storefrontHomepageTitle: true, storefrontHomepageDescription: true },
  })
  if (!carrier) throw new DomainError('Carrier identity is not configured.')
  const storefrontBrandColor = normalizeStorefrontBrandColor(carrier.storefrontBrandColor)
  const storefrontConfigured = hasConfiguredStorefrontBrand({ ...carrier, storefrontBrandColor })
  return { ...carrier, storefrontBrandColor, storefrontConfigured, salesEnabled: storefrontConfigured && carrier.status === 'active' && carrier.directSalesEnabled === true }
}

export function operatorOnlyLaunchSetup(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === 'production' && env.ALLOW_INCOMPLETE_LAUNCH_SETUP === 'true'
}

// The storefront sells for STOREFRONT_CARRIER_CODE when it is set, otherwise for the first carrier created.
export async function configuredPublicCarrierCode(prisma: any, env: NodeJS.ProcessEnv = process.env) {
  const configured = env.STOREFRONT_CARRIER_CODE?.trim().toUpperCase()
    || (await prisma.carrier.findFirst({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { code: true } }))?.code
    || ''
  if (!/^[A-Z0-9]{2,3}$/.test(configured)) throw new DomainError('Public carrier configuration is unavailable.')
  return configured
}

export async function isConfiguredPublicCarrier(prisma: any, carrierCode: string, env: NodeJS.ProcessEnv = process.env) {
  return carrierCode.trim().toUpperCase() === await configuredPublicCarrierCode(prisma, env)
}

async function assertConfiguredPublicCarrier(prisma: any, carrierCode: string) {
  if (!await isConfiguredPublicCarrier(prisma, carrierCode)) throw new DomainError('Carrier is unavailable on this storefront.')
}

export async function directCarrier(context: Context, carrierCode: string) {
  await assertConfiguredPublicCarrier((context as any).prisma, carrierCode)
  if (operatorOnlyLaunchSetup()) throw new DomainError('Online booking isn’t available yet. Please check back soon.')
  return lookupDirectCarrier((context as any).prisma, carrierCode)
}

export async function getPublicCarrierIdentity(
  _root: unknown,
  args: { carrierCode: string },
  context: Context,
) {
  await assertConfiguredPublicCarrier((context as any).prisma, args.carrierCode)
  try {
    const identity = await lookupCarrierIdentity((context as any).prisma, args.carrierCode)
    return operatorOnlyLaunchSetup() ? { ...identity, salesEnabled: false } : identity
  } catch (error) {
    if (error instanceof Error && error.message === 'Carrier identity is not configured.') return null
    throw error
  }
}

export function adultDateOfBirth(value: string, serviceDate: Date) {
  const dateOfBirth = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date('invalid')
  const departureDate = new Date(`${serviceDate.toISOString().slice(0, 10)}T23:59:59.999Z`)
  const adultAtDeparture = new Date(dateOfBirth); adultAtDeparture.setUTCFullYear(adultAtDeparture.getUTCFullYear() + 18)
  const oldestAccepted = new Date(departureDate); oldestAccepted.setUTCFullYear(oldestAccepted.getUTCFullYear() - 120)
  if (Number.isNaN(dateOfBirth.getTime()) || dateOfBirth.toISOString().slice(0, 10) !== value || adultAtDeparture > departureDate || dateOfBirth < oldestAccepted) throw new DomainError('Online booking is for adults 18 and over; enter a valid adult date of birth.')
  return dateOfBirth
}

export async function publicAirlineFlightOptions(
  root: unknown,
  args: { carrierCode: string; originCode: string; destinationCode: string; serviceDate: string; passengerCount?: number | null },
  context: Context,
) {
  // Public reads are bounded queries and are not throttled per request (drift class 4: a per-IP database
  // counter on reads locks out shared airport and hotel networks); writes keep their limits.
  const carrier = await directCarrier(context, args.carrierCode)
  return searchAirlineFlights(root, args, withStorefrontSession(context, carrier))
}

export function normalizePublicFlightStatusInput(input: { flightNumber: string; serviceDate: string }) {
  const flightNumber = input.flightNumber.trim().toUpperCase()
  if (!/^[A-Z0-9]{1,6}$/.test(flightNumber)) throw new DomainError('Flight number must contain one to six letters or digits.')
  return { flightNumber, serviceDate: normalizeSearchDate(input.serviceDate) }
}

export async function publicFlightStatuses(
  _root: unknown,
  args: { carrierCode: string; flightNumber: string; serviceDate: string },
  context: Context,
) {
  await assertConfiguredPublicCarrier((context as any).prisma, args.carrierCode)
  const carrier = await lookupCarrierIdentity((context as any).prisma, args.carrierCode)
  const input = normalizePublicFlightStatusInput(args)
  const start = new Date(`${input.serviceDate}T00:00:00.000Z`)
  const end = new Date(start.getTime() + 86_400_000)
  const flights = await (context.prisma as any).flightInstance.findMany({
    where: { carrierId: carrier.id, flightNumber: input.flightNumber, serviceDate: { gte: start, lt: end } },
    orderBy: { scheduledDepartureAt: 'asc' },
    take: 10,
    select: {
      id: true, flightNumber: true, status: true, serviceDate: true,
      scheduledDepartureAt: true, scheduledArrivalAt: true,
      estimatedDepartureAt: true, estimatedArrivalAt: true,
      actualDepartureAt: true, actualArrivalAt: true,
      departureTerminal: true, departureGate: true, arrivalTerminal: true, arrivalGate: true,
      origin: { select: { iataCode: true, city: true, timezone: true } },
      destination: { select: { iataCode: true, city: true, timezone: true } },
      disruptions: {
        where: { status: { in: ['published', 'recovering'] } },
        orderBy: { publishedAt: 'desc' },
        take: 1,
        select: { type: true, status: true, publicSummary: true, publishedAt: true },
      },
    },
  })
  return flights.map((flight: any) => ({
    ...flight,
    serviceDate: flight.serviceDate.toISOString().slice(0, 10),
    scheduledDepartureAt: flight.scheduledDepartureAt.toISOString(),
    scheduledArrivalAt: flight.scheduledArrivalAt.toISOString(),
    estimatedDepartureAt: flight.estimatedDepartureAt?.toISOString() ?? null,
    estimatedArrivalAt: flight.estimatedArrivalAt?.toISOString() ?? null,
    actualDepartureAt: flight.actualDepartureAt?.toISOString() ?? null,
    actualArrivalAt: flight.actualArrivalAt?.toISOString() ?? null,
    originCode: flight.origin.iataCode,
    originCity: flight.origin.city,
    originTimezone: flight.origin.timezone,
    destinationTimezone: flight.destination.timezone,
    destinationCode: flight.destination.iataCode,
    destinationCity: flight.destination.city,
    disruption: flight.disruptions[0] ? {
      ...flight.disruptions[0],
      publishedAt: flight.disruptions[0].publishedAt?.toISOString() ?? null,
    } : null,
  }))
}

export async function createCustomerOffer(
  _root: unknown,
  args: {
    carrierCode: string
    flightInstanceId: string
    inventoryBucketId: string
    shoppingSessionToken: string
    idempotencyKey: string
    passengers: Array<{ givenName: string; familyName: string; dateOfBirth: string; email: string; phone?: string | null }>
  },
  context: Context,
): Promise<CreateOfferResult> {
  const shoppingSessionHash = hashStorefrontToken(args.shoppingSessionToken)
  const carrier = await directCarrier(context, args.carrierCode)
  const storefrontContext = withStorefrontSession(context, carrier)
  const prepare = async (prisma: any) => {
    const flight = await prisma.flightInstance.findFirst({
      where: { id: args.flightInstanceId, carrierId: carrier.id, status: { in: ['scheduled', 'open_for_sale', 'delayed'] }, scheduledDepartureAt: { gt: new Date() } },
      select: { id: true, serviceDate: true },
    })
    if (!flight) throw new DomainError('The selected flight is not available for direct sale.')
    validatePassengerCount(args.passengers.length)
    const normalizedPassengers = args.passengers.map((input, index) => {
      let dateOfBirth: Date
      try { dateOfBirth = adultDateOfBirth(input.dateOfBirth, flight.serviceDate) }
      catch { throw new DomainError(`Passenger ${index + 1} must be 18 or older with a valid date of birth; online booking is for adults only.`) }
      return {
        passengerKey: `${carrier.code}:WEB:${crypto.createHash('sha256').update(`${shoppingSessionHash}\u0000${args.idempotencyKey}\u0000${index}`).digest('hex').slice(0, 32)}`,
        carrierId: carrier.id,
        givenName: requiredText(input.givenName, `Passenger ${index + 1} given name`, 80),
        familyName: requiredText(input.familyName, `Passenger ${index + 1} family name`, 80),
        dateOfBirth,
        email: email(input.email),
        phone: input.phone?.trim().slice(0, 40) || '',
      }
    })
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const request = { carrierId: carrier.id, flightInstanceId: args.flightInstanceId, inventoryBucketId: args.inventoryBucketId, shoppingSessionHash, passengers: normalizedPassengers.map(passenger => ({ ...passenger, dateOfBirth: passenger.dateOfBirth.toISOString() })) }
    return { key, request, normalizedPassengers }
  }
  // An exact replay of an accepted offer returns its receipt without charging the creation budget.
  const prepared = await prepare(storefrontContext.prisma)
  const inspected = await inspectOperation(storefrontContext.sudo() as any, carrier.id, prepared.key, 'customer-offer.create', prepared.request)
  if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as CreateOfferResult
  await consumeRateLimit(context, 'storefront.offer', 10, 15 * 60_000, shoppingSessionHash)
  return runSerializableTransaction(storefrontContext, async transactionContext => {
    const { key, request, normalizedPassengers } = await prepare(transactionContext.prisma)
    const sudo = transactionContext.sudo() as any
    const claim = await beginOperation(sudo, transactionContext, carrier.id, key, 'customer-offer.create', request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as CreateOfferResult
    const passengerIds: string[] = []
    for (const passengerData of normalizedPassengers) {
      const existing = await sudo.query.Passenger.findOne({ where: { passengerKey: passengerData.passengerKey }, query: 'id carrier { id }' })
      if (existing && existing.carrier?.id !== carrier.id) throw new DomainError('Passenger identity belongs to another carrier.')
      const profile = { givenName: passengerData.givenName, familyName: passengerData.familyName, dateOfBirth: passengerData.dateOfBirth.toISOString(), email: passengerData.email, phone: passengerData.phone }
      const passenger = existing
        ? await sudo.query.Passenger.updateOne({ where: { id: existing.id }, data: profile, query: 'id' })
        : await sudo.query.Passenger.createOne({ data: { passengerKey: passengerData.passengerKey, carrier: { connect: { id: carrier.id } }, ...profile }, query: 'id' })
      passengerIds.push(passenger.id)
    }
    const result = await createOfferInTransaction({ flightInstanceId: args.flightInstanceId, inventoryBucketId: args.inventoryBucketId, passengerIds, idempotencyKey: args.idempotencyKey, shoppingSessionHash }, transactionContext)
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}

export async function createCustomerBooking(
  root: unknown,
  args: { offerId: string; passengerIds: string[]; shoppingSessionToken: string; idempotencyKey: string; recoverOnly?: boolean },
  context: Context,
) {
  const shoppingSessionHash = hashStorefrontToken(args.shoppingSessionToken)
  const offer = await (context.prisma as any).offer.findUnique({
    where: { id: args.offerId },
    select: { carrier: { select: { id: true, code: true } }, shoppingSessionId: true },
  })
  if (!offer?.carrier?.code || offer.shoppingSessionId !== shoppingSessionHash) {
    // A failed possession proof is charged; exact recovery by the session holder is not.
    await consumeRateLimit(context, 'storefront.booking', 10, 15 * 60_000, shoppingSessionHash)
    throw new DomainError('This shopping session does not own the offer.')
  }
  // Shopping possession authorizes exact accepted-command recovery. New-sale
  // availability/configuration is checked only if conversion has not committed.
  const carrier = offer.carrier
  const accessToken = bookingAccessToken(args.shoppingSessionToken.trim(), args.offerId.trim())
  const result = await createBookingFromOffer(root, {
    offerId: args.offerId,
    passengerIds: args.passengerIds,
    idempotencyKey: args.idempotencyKey,
    shoppingSessionHash,
    bookingAccessTokenHash: hashStorefrontToken(accessToken), recoverOnly: args.recoverOnly,
  }, withStorefrontSession(context, carrier), async (tx, expected) => {
    // Admission runs only for new reservations, after the receipt replay and recoverOnly checks.
    await consumeRateLimit(context, 'storefront.booking', 10, 15 * 60_000, shoppingSessionHash)
    const lock = await tx.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "Carrier" WHERE "id" = ${expected.id} FOR UPDATE`)
    throwIfKeystonePrismaError(lock)
    const admitted = await directCarrier(tx, expected.code)
    if (admitted.id !== expected.id) throw new DomainError('Carrier is unavailable on this storefront.')
  })
  return { ...result, bookingAccessToken: result.bookingReceipt?.accessState === 'current' ? accessToken : null }
}

async function ownedBooking(context: Context, recordLocator: string, accessToken: string) {
  // Prove possession with a bounded indexed lookup first; the expanded itinerary is read only for a proven holder.
  const proof = await (context.prisma as any).booking.findFirst({
    where: {
      recordLocator: recordLocator.trim().toUpperCase(),
      accessTokenHash: hashStorefrontToken(accessToken),
      accessTokenExpiresAt: { gt: new Date() },
    },
    select: { id: true },
  })
  if (!proof) {
    // Only failed proofs count, per client network. Access tokens are high-entropy, so this bounds guessing, while
    // a holder's own repeated reads (a nine-passenger check-in makes about 37) never lock them out. Once the budget
    // is spent, further failures are refused without another write.
    const request = (context as any).req ?? {}
    if (await isDurableRateLimitExhausted(context.prisma as any, 'storefront.manage-booking.client', durableRequestFingerprint(request), 30)) {
      throw new DomainError('This request cannot be completed right now.')
    }
    await consumeRateLimit(context, 'storefront.manage-booking', 30, 15 * 60_000)
    throw new DomainError('Booking not found or inaccessible.')
  }
  const booking = await (context.prisma as any).booking.findUnique({
    where: { id: proof.id },
    include: {
      carrier: { select: { id: true, code: true, name: true } },
      passengers: { include: { passenger: { select: { id: true, givenName: true, familyName: true } } } },
      segments: {
        include: {
          flightInstance: {
            include: {
              origin: true,
              destination: true,
              seatMaps: {
                where: { status: 'published' },
                include: {
                  seats: {
                    where: { status: 'available' },
                    include: {
                      cabin: true,
                      assignments: {
                        where: { status: { in: ['held', 'assigned', 'confirmed', 'boarded'] } },
                        select: { bookingId: true, bookingPassengerId: true, bookingSegmentId: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      payments: { select: { status: true, amount: true, currencyCode: true } },
      tickets: { select: { status: true, ticketNumber: true } },
      checkIns: { select: { id: true, bookingPassengerId: true, bookingSegmentId: true, status: true, checkedInAt: true, offloadedAt: true, boardingPasses: { orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }], select: { id: true, passNumber: true, status: true, barcodeToken: true, seatDesignatorSnapshot: true, boardingGroup: true, boardingZone: true, gateSnapshot: true, terminalSnapshot: true } } } },
      reaccommodations: { select: { id: true, status: true, optionExpiresAt: true, acceptedAt: true, confirmedAt: true, optionSnapshot: true } },
    },
  })
  if (!booking) throw new DomainError('Booking not found or inaccessible.')
  return {
    ...booking,
    checkIns: booking.checkIns.map((checkIn: any) => ({
      ...checkIn,
      boardingPass: checkIn.boardingPasses.find((pass: any) => ['issued', 'reissued', 'boarded'].includes(pass.status)) ?? null,
    })),
  }
}

export async function rotateCustomerBookingAccessToken(
  _root: unknown,
  args: { recordLocator: string; accessToken: string },
  context: Context,
) {
  const booking = await ownedBooking(context, args.recordLocator, args.accessToken)
  const nextToken = crypto.randomBytes(32).toString('base64url')
  await runSerializableTransaction(context, async transactionContext => {
    const bookingLock = await transactionContext.prisma.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id} FOR UPDATE`
    throwIfKeystonePrismaError(bookingLock)
    const current = await (transactionContext.prisma as any).booking.findUnique({ where: { id: booking.id }, select: { accessTokenHash: true, accessTokenExpiresAt: true, accessTokenVersion: true } })
    if (!current || !hasCurrentStorefrontBookingAccess(current, hashStorefrontToken(args.accessToken))) throw new DomainError('Booking not found or inaccessible.')
    const now = new Date()
    await (transactionContext.prisma as any).booking.update({ where: { id: booking.id }, data: { accessTokenHash: hashStorefrontToken(nextToken), accessTokenExpiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60_000), accessTokenVersion: (current.accessTokenVersion ?? 1) + 1 } })
    const eventKey = `booking-access-rotated:${booking.id}:${crypto.randomUUID()}`
    await (transactionContext.prisma as any).auditEvent.create({ data: { carrierId: booking.carrier.id, eventKey, action: 'booking.access-token.rotate', aggregateType: 'Booking', aggregateId: booking.id, source: 'storefront', beforeSummary: {}, afterSummary: { accessRevoked: true }, metadata: {}, occurredAt: now } })
    await (transactionContext.prisma as any).outboxEvent.create({ data: { carrierId: booking.carrier.id, eventKey, topic: 'booking.access-token.rotated', aggregateType: 'Booking', aggregateId: booking.id, payload: {}, status: 'pending', availableAt: now } })
  })
  return { recordLocator: booking.recordLocator, accessToken: nextToken }
}

export async function checkInCustomerBooking(
  root: unknown,
  args: { recordLocator: string; accessToken: string; bookingPassengerId: string; bookingSegmentId: string; seatId?: string | null; idempotencyKey: string },
  context: Context,
) {
  const booking = await ownedBooking(context, args.recordLocator, args.accessToken)
  if (!booking.passengers.some((entry: any) => entry.id === args.bookingPassengerId) || !booking.segments.some((segment: any) => segment.id === args.bookingSegmentId)) throw new DomainError('Booking not found or inaccessible.')
  return checkInBookingPassenger(root, {
    bookingPassengerId: args.bookingPassengerId, bookingSegmentId: args.bookingSegmentId,
    seatId: args.seatId, idempotencyKey: args.idempotencyKey, customerBookingId: booking.id,
    customerAccessTokenHash: hashStorefrontToken(args.accessToken),
  }, withStorefrontSession(context, booking.carrier, booking.id))
}

export async function cancelCustomerBooking(
  root: unknown,
  args: { recordLocator: string; accessToken: string; reason: string; idempotencyKey: string },
  context: Context,
) {
  const booking = await ownedBooking(context, args.recordLocator, args.accessToken)
  return cancelBooking(root, {
    bookingId: booking.id,
    reason: args.reason,
    idempotencyKey: args.idempotencyKey,
    customerBookingId: booking.id,
    customerAccessTokenHash: hashStorefrontToken(args.accessToken),
  }, withStorefrontSession(context, booking.carrier, booking.id))
}

export async function assignCustomerSeat(
  _root: unknown,
  args: { recordLocator: string; accessToken: string; bookingPassengerId: string; bookingSegmentId: string; seatId: string; idempotencyKey: string },
  context: Context,
) {
  const booking = await ownedBooking(context, args.recordLocator, args.accessToken)
  const requestedSegment = booking.segments.find((entry: any) => entry.id === args.bookingSegmentId)
  if (!booking.passengers.some((entry: any) => entry.id === args.bookingPassengerId) || !requestedSegment?.flightInstanceId) throw new DomainError('Booking not found or inaccessible.')
  return runSerializableTransaction(context, async transactionContext => {
    // Lock order matches check-in: booking, then dated flight, then seat.
    const bookingLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id} FOR UPDATE`)
    throwIfKeystonePrismaError(bookingLock)
    const flightLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" = ${requestedSegment.flightInstanceId} FOR UPDATE`)
    throwIfKeystonePrismaError(flightLock)
    const currentBooking = await (transactionContext.prisma as any).booking.findUnique({
      where: { id: booking.id },
      select: {
        status: true, paymentStatus: true, ticketingStatus: true, currencyCode: true, carrierId: true, accessTokenHash: true, accessTokenExpiresAt: true,
        passengers: { where: { id: args.bookingPassengerId }, select: { id: true, passengerId: true } },
      },
    })
    const expectedTokenHash = hashStorefrontToken(args.accessToken)
    if (!currentBooking || currentBooking.carrierId !== booking.carrier.id || !hasCurrentStorefrontBookingAccess(currentBooking, expectedTokenHash) || !currentBooking.passengers[0]) throw new DomainError('Booking changed or access was revoked while preparing seat assignment.')
    const operationContext = withStorefrontSession(transactionContext, booking.carrier, booking.id)
    const sudo = operationContext.sudo() as any
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const request = { bookingId: booking.id, bookingPassengerId: args.bookingPassengerId, bookingSegmentId: args.bookingSegmentId, seatId: args.seatId }
    // An exact replay acknowledges the original command; it never performs a new change from current state.
    const inspected = await inspectOperation(sudo, booking.carrier.id, key, 'customer-seat.assign', request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true }
    // Ticket issuance refuses bookings with seat artifacts, so customers choose seats only once the booking is paid
    // and ticketed, the same state check-in requires.
    if (!['ticketed', 'in_progress'].includes(currentBooking.status) || currentBooking.paymentStatus !== 'paid' || currentBooking.ticketingStatus !== 'ticketed') {
      throw new DomainError('Seat selection is available after your ticket is issued.')
    }
    const segment = await (transactionContext.prisma as any).bookingSegment.findFirst({ where: { id: args.bookingSegmentId, bookingId: booking.id }, include: { flightInstance: true } })
    if (!segment || segment.flightInstanceId !== requestedSegment.flightInstanceId) throw new DomainError('Booking changed while preparing seat assignment.')
    // The shared segment status changes when another traveler in the party checks in; eligibility is this
    // traveler's own open coupon and check-in state.
    if (!['confirmed', 'checked_in', 'offloaded', 'boarded'].includes(segment.status)) throw new DomainError('The booking segment is not eligible for seat assignment.')
    assertDatedFlightEligibleForAction(segment.flightInstance, 'Seat selection', new Date())
    const openCoupon = await (transactionContext.prisma as any).ticketCoupon.findFirst({
      where: { bookingSegmentId: segment.id, status: 'open', ticket: { bookingId: booking.id, bookingPassengerId: args.bookingPassengerId, status: { in: ['issued', 'partially_used'] } } },
      select: { id: true },
    })
    if (!openCoupon) throw new DomainError('This traveler has no open ticket coupon for the segment.')
    const activeCheckIn = await (transactionContext.prisma as any).checkIn.findFirst({ where: { bookingPassengerId: args.bookingPassengerId, bookingSegmentId: segment.id, status: { in: ['checked_in', 'boarded'] } }, select: { id: true } })
    if (activeCheckIn) throw new DomainError('Seats can’t be changed after check-in. Please see an agent at the airport.')
    const seat = await (transactionContext.prisma as any).seat.findFirst({ where: { id: args.seatId, carrierId: booking.carrier.id, seatMap: { flightInstanceId: segment.flightInstanceId, status: 'published' }, status: 'available' }, include: { cabin: true } })
    if (!seat) throw new DomainError('The selected seat is not available for this segment.')
    if (seat.cabin?.code !== segment.cabinCode) throw new DomainError('The selected seat is outside the cabin of this fare.')
    // Check-in only admits a seat in the booking currency; reject a mismatched seat before touching the current one.
    if (seat.currencyCode !== currentBooking.currencyCode) throw new DomainError('The selected seat is not available for this booking.')
    const seatLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "Seat" WHERE "id" = ${seat.id} FOR UPDATE`)
    throwIfKeystonePrismaError(seatLock)
    const occupancyKey = `${segment.flightInstanceId}:${seat.id}`
    const priorAssignments = await (transactionContext.prisma as any).seatAssignment.findMany({ where: { bookingPassengerId: args.bookingPassengerId, bookingSegmentId: segment.id, status: { in: ['held', 'assigned', 'confirmed'] } }, orderBy: { createdAt: 'asc' } })
    const existing = priorAssignments.find((assignment: any) => assignment.seatId === seat.id)
    const occupied = await (transactionContext.prisma as any).seatAssignment.findUnique({ where: { occupancyKey } })
    if (occupied && occupied.id !== existing?.id) throw new DomainError('The selected seat is no longer available.')
    const claim = await beginOperation(sudo, operationContext, booking.carrier.id, key, 'customer-seat.assign', request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true }
    if (existing) {
      const result = { resourceType: 'SeatAssignment', resourceId: existing.id, status: existing.status, changed: false, replayed: false }
      await finishOperation(sudo, claim.record.id, result)
      return result
    }
    let entitlement: any = null
    if (seat.surchargeAmount > 0) {
      entitlement = await (transactionContext.prisma as any).electronicMiscCoupon.findFirst({ where: { bookingSegmentId: segment.id, status: 'open', amount: seat.surchargeAmount, currencyCode: seat.currencyCode, ancillaryProduct: { type: 'seat' }, entitlementSnapshot: { path: ['seatId'], equals: seat.id }, document: { bookingId: booking.id, bookingPassengerId: args.bookingPassengerId, status: 'issued' } } })
      if (!entitlement) throw new DomainError('A paid seat entitlement is required for this seat.')
      const entitlementLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "ElectronicMiscCoupon" WHERE "id" = ${entitlement.id} FOR UPDATE`)
      throwIfKeystonePrismaError(entitlementLock)
      const currentEntitlement = await (transactionContext.prisma as any).electronicMiscCoupon.findUnique({ where: { id: entitlement.id }, select: { status: true } })
      if (currentEntitlement?.status !== 'open') throw new DomainError('The paid seat entitlement was already consumed.')
    }
    // Every check above passed, so the previous current seat can now be released (kept as history).
    const now = new Date()
    for (const prior of priorAssignments) await (transactionContext.prisma as any).seatAssignment.update({ where: { id: prior.id }, data: { status: 'released', occupancyKey: null, releasedAt: now } })
    const assignment = await sudo.query.SeatAssignment.createOne({ data: { carrier: { connect: { id: booking.carrier.id } }, assignmentKey: claim.storageKey, occupancyKey, booking: { connect: { id: booking.id } }, bookingPassenger: { connect: { id: args.bookingPassengerId } }, passenger: { connect: { id: currentBooking.passengers[0].passengerId } }, bookingSegment: { connect: { id: segment.id } }, seat: { connect: { id: seat.id } }, status: 'assigned', seatDesignatorSnapshot: seat.designator, cabinCodeSnapshot: seat.cabin?.code ?? 'Y', characteristicsSnapshot: seat.characteristics ?? [], amount: seat.surchargeAmount, currencyCode: seat.currencyCode, assignedAt: now.toISOString() }, query: 'id status' })
    if (entitlement) await (transactionContext.prisma as any).electronicMiscCoupon.update({ where: { id: entitlement.id }, data: { status: 'used', usedAt: now, entitlementSnapshot: { seatId: seat.id, assignmentId: assignment.id } } })
    await writeAudit(sudo, operationContext, { carrierId: booking.carrier.id, key: claim.storageKey, action: 'customer-seat.assign', aggregateType: 'SeatAssignment', aggregateId: assignment.id, after: { status: 'assigned', seat: seat.designator }, metadata: { bookingId: booking.id, bookingSegmentId: segment.id } })
    const result = { resourceType: 'SeatAssignment', resourceId: assignment.id, status: 'assigned', changed: true, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}

export async function getCustomerBooking(
  _root: unknown,
  args: { recordLocator: string; accessToken: string },
  context: Context,
) {
  const booking = await ownedBooking(context, args.recordLocator, args.accessToken)
  const retained = await (context.prisma as any).idempotencyKey.findUnique({ where: { key: booking.idempotencyKey }, select: { scope: true, carrierId: true, status: true, result: true } })
  let bookingReceipt: Record<string, unknown> = { version: 0, state: 'legacy_or_incomplete', message: 'Original acceptance receipt needs operator reconciliation; current booking state remains separately shown.' }
  if (retained?.carrierId === booking.carrierId && retained.scope === 'booking.create-from-offer' && retained.status === 'completed' && retained.result?.resourceId === booking.id) {
    try { bookingReceipt = publicBookingReceipt(retained.result, booking, 'current') }
    catch { /* Do not invent historical terms from current catalog. */ }
  }
  return {
    bookingReceipt,
    id: booking.id, recordLocator: booking.recordLocator, orderNumber: booking.orderNumber,
    status: booking.status, paymentStatus: booking.paymentStatus, ticketingStatus: booking.ticketingStatus,
    totalAmount: booking.totalAmount, currencyCode: booking.currencyCode, carrier: booking.carrier,
    passengers: booking.passengers.map((entry: any) => ({ id: entry.id, passenger: entry.passenger,
      acceptedName: typeof entry.passengerSnapshot?.givenName === 'string' && typeof entry.passengerSnapshot?.familyName === 'string'
        ? { givenName: entry.passengerSnapshot.givenName, familyName: entry.passengerSnapshot.familyName } : null,
    })),
    // Current operational itinerary, shown separately from the immutable accepted receipt. Times are instants;
    // the airport timezones let the page show local departure and arrival with explicit zones.
    segments: booking.segments.map((segment: any) => ({
      id: segment.id, status: segment.status, flightNumber: segment.flightInstance.flightNumber, flightStatus: segment.flightInstance.status,
      serviceDate: segment.flightInstance.serviceDate?.toISOString().slice(0, 10) ?? null,
      scheduledDepartureAt: segment.flightInstance.scheduledDepartureAt.toISOString(),
      scheduledArrivalAt: segment.flightInstance.scheduledArrivalAt.toISOString(),
      estimatedDepartureAt: segment.flightInstance.estimatedDepartureAt?.toISOString() ?? null,
      estimatedArrivalAt: segment.flightInstance.estimatedArrivalAt?.toISOString() ?? null,
      actualDepartureAt: segment.flightInstance.actualDepartureAt?.toISOString() ?? null,
      actualArrivalAt: segment.flightInstance.actualArrivalAt?.toISOString() ?? null,
      originCode: segment.flightInstance.origin.iataCode, destinationCode: segment.flightInstance.destination.iataCode,
      originTimezone: segment.flightInstance.origin.timezone, destinationTimezone: segment.flightInstance.destination.timezone,
      seats: (segment.flightInstance.seatMaps ?? []).flatMap((map: any) => map.seats ?? []).map((seat: any) => {
        const assignment = seat.assignments?.[0]
        const selectedForPassengerId = assignment?.bookingId === booking.id && assignment?.bookingSegmentId === segment.id ? assignment.bookingPassengerId : null
        // A seat priced in another currency cannot be assigned to this booking (check-in refuses it).
        return { id: seat.id, designator: seat.designator, seatType: seat.seatType, surchargeAmount: seat.surchargeAmount, currencyCode: seat.currencyCode, cabinCode: seat.cabin?.code, isAvailable: !assignment && seat.currencyCode === booking.currencyCode && seat.cabin?.code === segment.cabinCode, selectedForPassengerId }
      }),
    })),
    payments: booking.payments, tickets: booking.tickets, checkIns: booking.checkIns, reaccommodations: booking.reaccommodations,
  }
}
