import { currentSegmentServiceStatus } from '../lib/segment-service-status'
import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'
import type { Context } from '.keystone/types'

import { requireFreshCarrierPermission, requireFreshPermission, requireStationCapability } from '../access'
import {
  beginOperation,
  finishOperation,
  normalizeIdempotencyKey,
  randomReference,
  inspectOperation,
  writeAudit,
} from './airlineOperations'
import { runSerializableTransaction, throwIfKeystonePrismaError } from '../lib/transactions'
import { getPaymentAdapter } from '../../integrations/payment'
import { isEvidenceOnlyManualProvider } from '../lib/bounded-payment-policy'
import { anonymousHoldQuota } from '../lib/storefront-capacity'
import { supportedPassengerServiceAllocation } from '../lib/passenger-service-allocation'
import { acceptedBookingSnapshot, BOOKING_ACCEPTANCE_OFFER_QUERY, BOOKING_ACCEPTANCE_PASSENGER_QUERY } from '../lib/booking-acceptance'
import { hasCurrentStorefrontBookingAccess, isStorefrontContext } from '../lib/storefront-session'
import { normalizeIncludedBaggageSnapshot } from '../lib/snapshots'
import { createServiceObligationKey } from '../lib/coupon-lineage'
import { checkedMinorTotal } from '../lib/money'
import { assertDatedFlightEligibleForAction, selectCurrentTicketableSegments, ticketIssuanceArtifactBlockers, type DatedFlightEligibilityState, type TicketableSegmentState } from '../lib/service-eligibility'
import { DomainError } from '../lib/domain-error'
import { travelDocumentTokenizationKey } from '../lib/travel-document-key'

export function calculateAvailability(input: {
  authorized: number
  sold: number
  held: number
  blocked: number
}) {
  return {
    available: Math.max(0, input.authorized - input.sold - input.held - input.blocked),
    authorized: input.authorized,
    sold: input.sold,
    held: input.held,
    blocked: input.blocked,
  }
}

export function normalizeSearchDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new DomainError('Search date must use YYYY-MM-DD.')
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new DomainError('Search date must use YYYY-MM-DD.')
  }
  return value
}

export function validatePassengerCount(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 9) {
    throw new DomainError('Passenger count must be between 1 and 9.')
  }
  return value
}

function sessionCarrierId(context: Context) {
  const session = context.session as any
  const carrierId = session?.data?.carrier?.id
  if (!carrierId) throw new DomainError('A carrier-scoped session is required.')
  return carrierId as string
}

async function assertCanShop(context: Context, carrierId: string) {
  if (isStorefrontContext(context) && (context.session as any)?.data?.carrier?.id === carrierId) return
  await requireFreshCarrierPermission(context, 'canReadOffers', carrierId)
}

export type FlightOption = {
  id: string
  inventoryBucketId: string
  flightNumber: string
  serviceDate: string
  scheduledDepartureAt: string
  scheduledArrivalAt: string
  origin: { iataCode: string; city: string }
  destination: { iataCode: string; city: string }
  fareBrand: { code: string; name: string }
  currencyCode: string
  baseAmount: number
  taxAmount: number
  totalAmount: number
  perTravelerBaseAmount: number
  perTravelerTaxAmount: number
  perTravelerTotalAmount: number
  partyTotalAmount: number
  passengerCount: number
  availability: ReturnType<typeof calculateAvailability>
  unavailableReason?: string
}

// Fare comparison for shoppers: the included checked-bag allowance, or none when the policy is unset or invalid.
function publicBaggageAllowance(value: unknown) {
  try {
    const policy = normalizeIncludedBaggageSnapshot(value)
    return { baggagePieces: policy.pieces, baggageWeightGrams: policy.maxWeightGrams }
  } catch {
    return { baggagePieces: 0, baggageWeightGrams: 0 }
  }
}

export async function searchAirlineFlights(
  _root: unknown,
  args: { originCode: string; destinationCode: string; serviceDate: string; passengerCount?: number | null },
  context: Context,
): Promise<FlightOption[]> {
  const carrierId = sessionCarrierId(context)
  await assertCanShop(context, carrierId)
  const serviceDate = normalizeSearchDate(args.serviceDate)
  const passengerCount = validatePassengerCount(args.passengerCount ?? 1)
  const originCode = args.originCode.trim().toUpperCase()
  const destinationCode = args.destinationCode.trim().toUpperCase()
  if (!/^[A-Z0-9]{3}$/.test(originCode) || !/^[A-Z0-9]{3}$/.test(destinationCode)) {
    throw new DomainError('Origin and destination must be three-character airport codes.')
  }

  const flights = await (context.prisma as any).flightInstance.findMany({
    where: {
      carrierId,
      serviceDate: { gte: new Date(`${serviceDate}T00:00:00.000Z`), lt: new Date(new Date(`${serviceDate}T00:00:00.000Z`).getTime() + 86_400_000) },
      origin: { iataCode: originCode },
      destination: { iataCode: destinationCode },
      status: { in: ['scheduled', 'open_for_sale', 'delayed'] },
      scheduledDepartureAt: { gt: new Date() },
    },
    orderBy: { scheduledDepartureAt: 'asc' },
    include: {
      origin: { select: { iataCode: true, city: true } },
      destination: { select: { iataCode: true, city: true } },
      inventoryBuckets: {
        where: { status: 'open', fareBrand: { status: 'active' } },
        include: { holds: { where: { status: 'active', expiresAt: { gt: new Date() } }, select: { quantity: true } }, fareBrand: { select: { code: true, name: true, status: true, description: true, includedBaggage: true } }, cabin: { select: { name: true, cabinClass: true } } },
        /* Active, unexpired holds are authoritative for shopping availability. */
        orderBy: { bookingClassCode: 'asc' },
        take: 3,
      },
    },
  })

  return flights.flatMap((flight: any) => flight.inventoryBuckets.map((bucket: any) => {
    const availability = calculateAvailability({ ...bucket, held: (bucket.holds ?? []).reduce((sum: number, hold: any) => sum + hold.quantity, 0) })
    return {
      id: flight.id,
      flightNumber: flight.flightNumber,
      serviceDate: serviceDate,
      scheduledDepartureAt: flight.scheduledDepartureAt.toISOString(),
      scheduledArrivalAt: flight.scheduledArrivalAt.toISOString(),
      origin: flight.origin,
      destination: flight.destination,
      fareBrand: {
        code: bucket.fareBrand?.code ?? bucket.bookingClassCode,
        name: bucket.fareBrand?.name ?? bucket.bookingClassCode,
        description: bucket.fareBrand?.description || null,
        ...publicBaggageAllowance(bucket.fareBrand?.includedBaggage),
      },
      cabinName: bucket.cabin?.name || null,
      currencyCode: bucket.currencyCode,
      baseAmount: bucket.baseAmount,
      taxAmount: bucket.taxAmount,
      totalAmount: checkedMinorTotal([bucket.baseAmount, bucket.taxAmount]),
      perTravelerBaseAmount: bucket.baseAmount,
      perTravelerTaxAmount: bucket.taxAmount,
      perTravelerTotalAmount: checkedMinorTotal([bucket.baseAmount, bucket.taxAmount]),
      partyTotalAmount: checkedMinorTotal([bucket.baseAmount, bucket.taxAmount], passengerCount),
      passengerCount,
      availability,
      ...(availability.available < passengerCount ? { unavailableReason: 'Not enough seats' } : {}),
      inventoryBucketId: bucket.id,
    }
  }))
}

export type CreateOfferArgs = {
  flightInstanceId: string
  inventoryBucketId: string
  passengerIds: string[]
  idempotencyKey: string
  shoppingSessionHash?: string
}

const MAX_ACTIVE_STOREFRONT_OFFERS = 2
const MAX_ACTIVE_STOREFRONT_HELD_SEATS = 9

async function enforceStorefrontHoldCap(context: Context, carrierId: string, shoppingSessionHash: string, requestedSeats: number) {
  await context.prisma.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${carrierId}:`} || ${shoppingSessionHash}, 0))::text AS "lock"`)
  const reconciled = await context.prisma.$executeRaw(Prisma.sql`
    WITH expired AS (
      UPDATE "InventoryHold" hold SET "status" = 'expired', "updatedAt" = NOW()
      FROM "Offer" offer
      WHERE hold."offer" = offer."id" AND offer."carrier" = ${carrierId}
        AND offer."shoppingSessionId" = ${shoppingSessionHash}
        AND hold."status" = 'active' AND hold."expiresAt" <= NOW()
      RETURNING hold."inventoryBucket", hold."quantity"
    ), totals AS (
      SELECT "inventoryBucket", SUM("quantity")::integer AS quantity FROM expired GROUP BY "inventoryBucket"
    )
    UPDATE "InventoryBucket" bucket SET "held" = GREATEST(0, bucket."held" - totals.quantity), "updatedAt" = NOW()
    FROM totals WHERE bucket."id" = totals."inventoryBucket"
  `)
  throwIfKeystonePrismaError(reconciled)
  const [usage] = await context.prisma.$queryRaw<Array<{ offerCount: bigint; heldSeats: bigint }>>(Prisma.sql`
    SELECT COUNT(DISTINCT offer."id") AS "offerCount", COALESCE(SUM(hold."quantity"), 0) AS "heldSeats"
    FROM "Offer" offer
    JOIN "InventoryHold" hold ON hold."offer" = offer."id"
    WHERE offer."carrier" = ${carrierId} AND offer."shoppingSessionId" = ${shoppingSessionHash}
      AND offer."status" IN ('held', 'available') AND hold."status" = 'active' AND hold."expiresAt" > NOW()
  `)
  if (Number(usage?.offerCount ?? 0) >= MAX_ACTIVE_STOREFRONT_OFFERS || Number(usage?.heldSeats ?? 0) + requestedSeats > MAX_ACTIVE_STOREFRONT_HELD_SEATS) {
    throw new DomainError('Complete or release an existing held offer before holding more inventory.')
  }
}

export type CreateOfferResult = {
  resourceType: 'Offer'
  resourceId: string
  offerId: string
  offerNumber: string
  status: string
  totalAmount: number
  currencyCode: string
  expiresAt: string
  passengerIds: string[]
  changed: boolean
  replayed: boolean
}

export async function createOfferInTransaction(
  args: CreateOfferArgs,
  context: Context,
): Promise<CreateOfferResult> {
  const sudo = context.sudo() as any
  const carrierId = sessionCarrierId(context)
  if (!isStorefrontContext(context)) await requireFreshCarrierPermission(context, 'canManageOffers', carrierId)
  const key = normalizeIdempotencyKey(args.idempotencyKey)
  const passengerIds = [...new Set(args.passengerIds ?? [])].sort()
  if (!passengerIds.length) throw new DomainError('At least one passenger is required.')
  validatePassengerCount(passengerIds.length)
  const request = { flightInstanceId: args.flightInstanceId, inventoryBucketId: args.inventoryBucketId, passengerIds, storefront: Boolean(args.shoppingSessionHash) }
  const inspected = await inspectOperation(sudo, carrierId, key, 'offer.create', request)
  if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as CreateOfferResult
  if (args.shoppingSessionHash) await enforceStorefrontHoldCap(context, carrierId, args.shoppingSessionHash, passengerIds.length)

  const bucketReference = await (context.prisma as any).inventoryBucket.findUnique({ where: { id: args.inventoryBucketId }, select: { carrierId: true, flightInstanceId: true, fareBrandId: true } })
  if (!bucketReference || bucketReference.carrierId !== carrierId || bucketReference.flightInstanceId !== args.flightInstanceId || !bucketReference.fareBrandId) throw new DomainError('The requested inventory is outside this carrier, flight, or active fare catalog.')
  const flightLock = await context.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" = ${bucketReference.flightInstanceId} FOR UPDATE`)
  throwIfKeystonePrismaError(flightLock)
  const lock = await context.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "InventoryBucket" WHERE "id" = ${args.inventoryBucketId} FOR UPDATE`)
  throwIfKeystonePrismaError(lock)
  const fareLock = await context.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "FareBrand" WHERE "id" = ${bucketReference.fareBrandId} FOR UPDATE`)
  throwIfKeystonePrismaError(fareLock)
  const released = await context.prisma.$executeRaw(Prisma.sql`
    WITH expired AS (
      UPDATE "InventoryHold"
      SET "status" = 'expired', "updatedAt" = NOW()
      WHERE "inventoryBucket" = ${args.inventoryBucketId}
        AND "status" = 'active' AND "expiresAt" <= NOW()
      RETURNING "quantity"
    )
    UPDATE "InventoryBucket"
    SET "held" = GREATEST(0, "held" - COALESCE((SELECT SUM("quantity") FROM expired), 0)), "updatedAt" = NOW()
    WHERE "id" = ${args.inventoryBucketId}
  `)
  throwIfKeystonePrismaError(released)
  const bucket = await sudo.query.InventoryBucket.findOne({
    where: { id: args.inventoryBucketId },
    query: `id carrier { id code } cabin { id code } status authorized sold held blocked baseAmount taxAmount currencyCode bookingClassCode flightInstance { id status carrier { id } flightNumber serviceDate scheduledDepartureAt scheduledArrivalAt origin { id iataCode } destination { id iataCode } } fareBrand { id code name status includedBaggage }`,
  })
  if (!bucket || bucket.carrier.id !== carrierId || bucket.flightInstance?.id !== args.flightInstanceId) {
    throw new DomainError('The requested inventory is outside this carrier or flight.')
  }
  if (bucket.status !== 'open') throw new DomainError('This inventory bucket is closed.')
  // The held fare's cabin is the bucket's cabin; seat selection and check-in compare seats against it.
  if (!bucket.cabin?.code) throw new DomainError('This inventory bucket has no cabin.')
  if (!bucket.fareBrand || bucket.fareBrand.status !== 'active') throw new DomainError('This fare is no longer active for shopping or holding.')
  if (!bucket.flightInstance || !['scheduled', 'open_for_sale', 'delayed'].includes(bucket.flightInstance.status) || new Date(bucket.flightInstance.scheduledDepartureAt) <= new Date()) throw new DomainError('This dated flight is not open for future sale.')
  const availability = calculateAvailability(bucket)
  if (availability.available < passengerIds.length) throw new DomainError('Not enough inventory for this request.')
  if (args.shoppingSessionHash) {
    const anonymous = await (context.prisma as any).inventoryHold.aggregate({
      where: { inventoryBucketId: bucket.id, status: 'active', expiresAt: { gt: new Date() }, offer: { shoppingSessionId: { not: '' } } },
      _sum: { quantity: true },
    })
    const anonymousQuota = anonymousHoldQuota(bucket.authorized, passengerIds.length)
    if (Number(anonymous._sum.quantity ?? 0) + passengerIds.length > anonymousQuota) throw new DomainError('Online hold capacity is temporarily full; choose another service or try again after existing holds expire.')
  }
  const passengers = await sudo.query.Passenger.findMany({
    where: { id: { in: passengerIds }, carrier: { id: { equals: carrierId } } },
    query: BOOKING_ACCEPTANCE_PASSENGER_QUERY,
  })
  if (passengers.length !== passengerIds.length) throw new DomainError('One or more passengers are outside this carrier.')

  // Validate the supported whole-party service BEFORE claiming/writing a new
  // hold; final readback is independently validated by the v2 frozen snapshot.
  supportedPassengerServiceAllocation({ carrier: { id: carrierId }, currencyCode: bucket.currencyCode,
    passengers: passengerIds.map(id => ({ id })), items: [{ id: key, itemKey: `${key}:flight`, itemType: 'flight', carrier: { id: carrierId },
      quantity: passengerIds.length, passengerReferences: passengerIds, currencyCode: bucket.currencyCode,
      flightInstance: bucket.flightInstance, inventoryBucket: { id: bucket.id, carrier: bucket.carrier, flightInstance: { id: bucket.flightInstance.id } } }] }, passengerIds)
  const claim = await beginOperation(sudo, context, carrierId, key, 'offer.create', request)
  if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as CreateOfferResult
  try {
    const now = Date.now()
    const expiresAt = new Date(now + 15 * 60_000).toISOString()
    const offerNumber = randomReference(`${bucket.carrier.code}-O-`, 9)
    const totalAmount = checkedMinorTotal([bucket.baseAmount, bucket.taxAmount], passengerIds.length)
    checkedMinorTotal([bucket.baseAmount], passengerIds.length)
    checkedMinorTotal([bucket.taxAmount], passengerIds.length)
    const offer = await sudo.query.Offer.createOne({
      data: {
        carrier: { connect: { id: carrierId } },
        offerNumber,
        idempotencyKey: claim.storageKey,
        shoppingSessionId: args.shoppingSessionHash,
        status: 'held', source: args.shoppingSessionHash ? 'website' : 'direct', expiresAt,
        baseAmount: bucket.baseAmount * passengerIds.length,
        taxAmount: bucket.taxAmount * passengerIds.length,
        totalAmount, currencyCode: bucket.currencyCode,
        customer: context.session?.itemId ? { connect: { id: context.session.itemId } } : undefined,
        passengers: { connect: passengerIds.map(id => ({ id })) },
      },
      query: 'id offerNumber status',
    })
    const item = await sudo.query.OfferItem.createOne({
      data: {
        carrier: { connect: { id: carrierId } }, offer: { connect: { id: offer.id } },
        itemKey: `${offer.id}:flight`, itemType: 'flight',
        description: `${bucket.flightInstance.origin.iataCode} to ${bucket.flightInstance.destination.iataCode}`,
        quantity: passengerIds.length, unitAmount: bucket.baseAmount,
        baseAmount: bucket.baseAmount * passengerIds.length,
        taxAmount: bucket.taxAmount * passengerIds.length,
        totalAmount, currencyCode: bucket.currencyCode,
        flightInstance: { connect: { id: bucket.flightInstance.id } },
        inventoryBucket: { connect: { id: bucket.id } },
        fareBrand: bucket.fareBrand ? { connect: { id: bucket.fareBrand.id } } : undefined,
        passengerReferences: passengerIds,
        segmentSnapshot: { cabinCode: bucket.cabin.code, bookingClassCode: bucket.bookingClassCode, fareBrandCode: bucket.fareBrand?.code ?? bucket.bookingClassCode, fareBasisCode: bucket.fareBrand?.code ?? bucket.bookingClassCode, includedBaggage: normalizeIncludedBaggageSnapshot(bucket.fareBrand?.includedBaggage) },
        productSnapshot: { code: bucket.fareBrand?.code ?? bucket.bookingClassCode, name: bucket.fareBrand?.name ?? bucket.bookingClassCode },
      },
      query: 'id',
    })
    await sudo.query.InventoryHold.createOne({
      data: {
        carrier: { connect: { id: carrierId } }, holdKey: `${offer.id}:${bucket.id}`,
        inventoryBucket: { connect: { id: bucket.id } }, offer: { connect: { id: offer.id } },
        quantity: passengerIds.length, status: 'active', expiresAt,
      },
      query: 'id',
    })
    await sudo.query.InventoryBucket.updateOne({ where: { id: bucket.id }, data: { held: bucket.held + passengerIds.length } })
    await writeAudit(sudo, context, {
      carrierId, key: claim.storageKey, action: 'offer.create', aggregateType: 'Offer', aggregateId: offer.id,
      after: { status: 'held', offerNumber, totalAmount, currencyCode: bucket.currencyCode },
      metadata: { flightInstanceId: bucket.flightInstance.id, offerItemId: item.id, passengerCount: passengerIds.length },
    })
    const frozenOffer = await sudo.query.Offer.findOne({ where: { id: offer.id }, query: BOOKING_ACCEPTANCE_OFFER_QUERY })
    if (!frozenOffer) throw new DomainError('Held offer could not be read back before acknowledgement.')
    const result = { resourceType: 'Offer' as const, resourceId: offer.id, offerId: offer.id, offerNumber, status: 'held', totalAmount, currencyCode: bucket.currencyCode, expiresAt, passengerIds, changed: true, replayed: false, heldSnapshot: acceptedBookingSnapshot(frozenOffer, passengers) }
    await finishOperation(sudo, claim.record.id, result)
    return result
  } catch (error) {
    throw error
  }
}

export async function createOfferFromShopping(
  _root: unknown,
  args: CreateOfferArgs,
  context: Context,
) {
  return runSerializableTransaction(context, transactionContext => createOfferInTransaction(args, transactionContext))
}


type WorkflowResult = {
  resourceType: string
  resourceId: string
  status: string
  changed: boolean
  replayed: boolean
}

async function lockBooking(context: Context, bookingId: string) {
  const result = await context.prisma.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`,
  )
  throwIfKeystonePrismaError(result)
}

export async function submitManualPaymentEvidence(
  _root: unknown,
  args: { bookingId: string; purpose: string; externalReference: string; ledgerSource: string; evidenceDigest: string; amount: number; currencyCode: string; idempotencyKey: string },
  context: Context,
): Promise<WorkflowResult> {
  return runSerializableTransaction(context, async transactionContext => {
    await requireFreshPermission(transactionContext, 'canManagePayments')
    const sudo = transactionContext.sudo() as any
    let booking = await (transactionContext.prisma as any).booking.findUnique({ where: { id: args.bookingId }, include: { payments: true } })
    if (!booking) throw new DomainError('Resource not found or inaccessible.')
    const actor = await requireFreshCarrierPermission(transactionContext, 'canManagePayments', booking.carrierId)
    await lockBooking(transactionContext, booking.id)
    booking = await (transactionContext.prisma as any).booking.findUnique({ where: { id: booking.id }, include: { payments: true } })
    if (!booking || booking.carrierId !== actor.carrierId) throw new DomainError('Booking changed while preparing settlement evidence.')
    if (!['capture', 'refund'].includes(args.purpose) || !Number.isSafeInteger(args.amount) || args.amount <= 0 || !/^[A-Z]{3}$/.test(args.currencyCode) || !/^[a-f0-9]{64}$/i.test(args.evidenceDigest)) throw new DomainError('Manual evidence is invalid.')
    if (args.currencyCode !== booking.currencyCode || (args.purpose === 'capture' && args.amount !== booking.totalAmount)) throw new DomainError('Settlement evidence must match the booking amount and currency.')
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const request = { ...args, idempotencyKey: undefined }
    const inspected = await inspectOperation(sudo, booking.carrierId, key, 'manual-payment-evidence.submit', request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as WorkflowResult
    if (args.purpose === 'capture' && (!['pending', 'confirmed'].includes(booking.status) || !['unpaid', 'failed'].includes(booking.paymentStatus))) throw new DomainError('This booking is not eligible for capture evidence.')
    if (args.purpose === 'refund' && !['paid', 'partially_refunded'].includes(booking.paymentStatus)) throw new DomainError('This booking is not eligible for refund evidence.')
    if (args.purpose === 'refund') {
      const captured = booking.payments.reduce((sum: number, payment: any) => sum + Number(payment.capturedAmount ?? 0) - Number(payment.refundedAmount ?? 0), 0)
      if (args.amount > captured) throw new DomainError('Refund evidence exceeds the remaining captured amount.')
    }
    const ledgerEntry = await (transactionContext.prisma as any).settlementLedgerEntry.findFirst({ where: { carrierId: booking.carrierId, externalReference: args.externalReference.trim(), ledgerSource: args.ledgerSource.trim(), evidenceDigest: args.evidenceDigest.toLowerCase(), amount: args.amount, currencyCode: args.currencyCode } })
    if (!ledgerEntry) throw new DomainError('An externally imported settlement ledger entry is required.')
    const ledgerLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "SettlementLedgerEntry" WHERE "id" = ${ledgerEntry.id} FOR UPDATE`)
    throwIfKeystonePrismaError(ledgerLock)
    const lockedReplay = await inspectOperation(sudo, booking.carrierId, key, 'manual-payment-evidence.submit', request)
    if (lockedReplay.replay) return { ...(lockedReplay.replay.result ?? {}), replayed: true } as WorkflowResult
    const retainedEvidence = await (transactionContext.prisma as any).manualPaymentEvidence.findFirst({ where: { ledgerEntryId: ledgerEntry.id }, select: { id: true } })
    if (retainedEvidence) throw new DomainError('Settlement ledger evidence has already been assigned and cannot fund another operation.')
    const claim = await beginOperation(sudo, transactionContext, booking.carrierId, key, 'manual-payment-evidence.submit', request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as WorkflowResult
    const evidence = await sudo.query.ManualPaymentEvidence.createOne({ data: {
      carrier: { connect: { id: booking.carrierId } }, evidenceKey: claim.storageKey, purpose: args.purpose,
      booking: { connect: { id: booking.id } }, ledgerEntry: { connect: { id: ledgerEntry.id } }, externalReference: args.externalReference.trim(), ledgerSource: args.ledgerSource.trim(),
      evidenceDigest: args.evidenceDigest.toLowerCase(), amount: args.amount, currencyCode: args.currencyCode,
      status: 'submitted', submittedBy: { connect: { id: actor.itemId } },
    }, query: 'id status' })
    await writeAudit(sudo, transactionContext, { carrierId: booking.carrierId, key: claim.storageKey, action: 'manual-payment-evidence.submit', aggregateType: 'ManualPaymentEvidence', aggregateId: evidence.id, after: { status: evidence.status, purpose: args.purpose, amount: args.amount, currencyCode: args.currencyCode }, metadata: { bookingId: booking.id, ledgerEntryId: ledgerEntry.id } })
    const result = { resourceType: 'ManualPaymentEvidence', resourceId: evidence.id, status: evidence.status, changed: true, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}

export async function approveManualPaymentEvidence(
  _root: unknown,
  args: { evidenceId: string; idempotencyKey: string },
  context: Context,
): Promise<WorkflowResult> {
  return runSerializableTransaction(context, async transactionContext => {
    await requireFreshPermission(transactionContext, 'canManagePayments')
    const sudo = transactionContext.sudo() as any
    const evidence = await (transactionContext.prisma as any).manualPaymentEvidence.findUnique({ where: { id: args.evidenceId } })
    if (!evidence) throw new DomainError('Resource not found or inaccessible.')
    const actor = await requireFreshCarrierPermission(transactionContext, 'canManagePayments', evidence.carrierId)
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const request = { evidenceId: evidence.id }
    const inspected = await inspectOperation(sudo, evidence.carrierId, key, 'manual-payment-evidence.approve', request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as WorkflowResult
    const evidenceLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "ManualPaymentEvidence" WHERE "id" = ${evidence.id} FOR UPDATE`)
    throwIfKeystonePrismaError(evidenceLock)
    const lockedReplay = await inspectOperation(sudo, evidence.carrierId, key, 'manual-payment-evidence.approve', request)
    if (lockedReplay.replay) return { ...(lockedReplay.replay.result ?? {}), replayed: true } as WorkflowResult
    const currentEvidence = await (transactionContext.prisma as any).manualPaymentEvidence.findUnique({ where: { id: evidence.id }, select: { status: true, submittedById: true, purpose: true, booking: { select: { status: true, paymentStatus: true } } } })
    const bookingEligible = currentEvidence?.purpose === 'capture'
      ? ['pending', 'confirmed'].includes(currentEvidence.booking.status) && ['unpaid', 'failed'].includes(currentEvidence.booking.paymentStatus)
      : ['paid', 'partially_refunded'].includes(currentEvidence?.booking.paymentStatus)
    if (currentEvidence?.status !== 'submitted' || currentEvidence.submittedById === actor.itemId || !bookingEligible) throw new DomainError('Evidence must be current, booking-eligible, and approved once by a different authorized user.')
    const claim = await beginOperation(sudo, transactionContext, evidence.carrierId, key, 'manual-payment-evidence.approve', request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as WorkflowResult
    await sudo.query.ManualPaymentEvidence.updateOne({ where: { id: evidence.id }, data: { status: 'approved', approvedBy: { connect: { id: actor.itemId } }, approvedAt: new Date().toISOString() } })
    await writeAudit(sudo, transactionContext, { carrierId: evidence.carrierId, key: claim.storageKey, action: 'manual-payment-evidence.approve', aggregateType: 'ManualPaymentEvidence', aggregateId: evidence.id, before: { status: 'submitted' }, after: { status: 'approved' }, metadata: {} })
    const result = { resourceType: 'ManualPaymentEvidence', resourceId: evidence.id, status: 'approved', changed: true, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}

export async function rejectManualPaymentEvidence(
  _root: unknown,
  args: { evidenceId: string; reason: string; idempotencyKey: string },
  context: Context,
): Promise<WorkflowResult> {
  return runSerializableTransaction(context, async transactionContext => {
    const sudo = transactionContext.sudo() as any
    const evidence = await (transactionContext.prisma as any).manualPaymentEvidence.findUnique({ where: { id: args.evidenceId } })
    if (!evidence) throw new DomainError('Resource not found or inaccessible.')
    const actor = await requireFreshCarrierPermission(transactionContext, 'canManagePayments', evidence.carrierId)
    const reason = args.reason.trim()
    if (!reason || reason.length > 500) throw new DomainError('A bounded rejection reason is required.')
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const request = { evidenceId: evidence.id, reason }
    const inspected = await inspectOperation(sudo, evidence.carrierId, key, 'manual-payment-evidence.reject', request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as WorkflowResult
    const evidenceLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "ManualPaymentEvidence" WHERE "id" = ${evidence.id} FOR UPDATE`)
    throwIfKeystonePrismaError(evidenceLock)
    const lockedReplay = await inspectOperation(sudo, evidence.carrierId, key, 'manual-payment-evidence.reject', request)
    if (lockedReplay.replay) return { ...(lockedReplay.replay.result ?? {}), replayed: true } as WorkflowResult
    const currentEvidence = await (transactionContext.prisma as any).manualPaymentEvidence.findUnique({ where: { id: evidence.id }, select: { status: true, submittedById: true } })
    if (currentEvidence?.status !== 'submitted' || currentEvidence.submittedById === actor.itemId) throw new DomainError('Evidence must be submitted and rejected once by a different authorized user.')
    const claim = await beginOperation(sudo, transactionContext, evidence.carrierId, key, 'manual-payment-evidence.reject', request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as WorkflowResult
    await sudo.query.ManualPaymentEvidence.updateOne({ where: { id: evidence.id }, data: { status: 'rejected', rejectionReason: reason } })
    await writeAudit(sudo, transactionContext, { carrierId: evidence.carrierId, key: claim.storageKey, action: 'manual-payment-evidence.reject', aggregateType: 'ManualPaymentEvidence', aggregateId: evidence.id, before: { status: 'submitted' }, after: { status: 'rejected' }, metadata: { reason } })
    const result = { resourceType: 'ManualPaymentEvidence', resourceId: evidence.id, status: 'rejected', changed: true, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}

export async function captureBookingPayment(
  _root: unknown,
  args: { bookingId: string; idempotencyKey: string; providerReference: string; instrumentBrand?: string | null; instrumentLast4?: string | null },
  context: Context,
): Promise<WorkflowResult> {
  return runSerializableTransaction(context, async transactionContext => {
    await requireFreshPermission(transactionContext, 'canManagePayments')
    const sudo = transactionContext.sudo() as any
    const booking = await sudo.query.Booking.findOne({
      where: { id: args.bookingId },
      query: 'id status paymentStatus totalAmount currencyCode carrier { id } payments { id status }',
    })
    if (!booking) throw new DomainError('Booking not found.')
    await requireFreshCarrierPermission(transactionContext, 'canManagePayments', booking.carrier.id)
    await lockBooking(transactionContext, booking.id)
    const currentBooking = await (transactionContext.prisma as any).booking.findUnique({
      where: { id: booking.id },
      select: { status: true, paymentStatus: true, payments: { select: { status: true, metadata: true } } },
    })
    const providerReference = args.providerReference.trim()
    const instrumentBrand = args.instrumentBrand?.trim().slice(0, 40) || null
    const instrumentLast4 = args.instrumentLast4?.trim() || null
    if (providerReference.length < 6 || providerReference.length > 200 || (instrumentLast4 && !/^\d{4}$/.test(instrumentLast4))) throw new DomainError('Payment reference or instrument summary is invalid.')
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const request = { bookingId: booking.id, providerReference, instrumentBrand, instrumentLast4 }
    const inspected = await inspectOperation(sudo, booking.carrier.id, key, 'payment.capture', request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as WorkflowResult
    if (!currentBooking || !['unpaid', 'failed'].includes(currentBooking.paymentStatus)) throw new DomainError('Booking payment state is not eligible for capture.')
    if (currentBooking.status === 'cancelled') throw new DomainError('Cancelled bookings cannot be paid.')
    if (currentBooking.payments.some((payment: any) => {
      const purchaseKind = payment.metadata?.purchaseKind ?? 'booking'
      return purchaseKind !== 'seat' && ['authorized', 'captured', 'partially_refunded', 'refunded'].includes(payment.status)
    })) throw new DomainError('Booking already has an authoritative airfare payment record.')
    const provider = (await sudo.query.PaymentProvider.findMany({
      where: { carrier: { id: { equals: booking.carrier.id } }, status: { equals: 'active' }, adapterType: { equals: 'manual' } },
      orderBy: [{ providerKey: 'asc' }], take: 1, query: 'id providerKey adapterType configuration',
    }))[0]
    if (!provider) throw new DomainError('No active payment provider is configured for this carrier.')
    const providerLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentProvider" WHERE "id" = ${provider.id} FOR UPDATE`)
    throwIfKeystonePrismaError(providerLock)
    const currentProvider = await (transactionContext.prisma as any).paymentProvider.findUnique({ where: { id: provider.id } })
    if (!currentProvider || currentProvider.carrierId !== booking.carrier.id || currentProvider.status !== 'active' || !isEvidenceOnlyManualProvider(currentProvider)) throw new DomainError('The payment provider is not an active evidence-only manual settlement boundary.')
    const duplicateProviderReference = await (transactionContext.prisma as any).payment.findFirst({ where: { providerId: currentProvider.id, providerPaymentId: providerReference }, select: { id: true } })
    if (duplicateProviderReference) throw new DomainError('Settlement reference was already captured by this provider.')
    const claim = await beginOperation(sudo, transactionContext, booking.carrier.id, key, 'payment.capture', request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as WorkflowResult
    const manualEvidence = currentProvider.adapterType === 'manual' ? await (transactionContext.prisma as any).manualPaymentEvidence.findFirst({
      where: { bookingId: booking.id, purpose: 'capture', externalReference: providerReference, amount: booking.totalAmount, currencyCode: booking.currencyCode, status: 'approved' },
    }) : null
    if (currentProvider.adapterType === 'manual' && !manualEvidence) throw new DomainError('Approved manual settlement evidence is required.')
    if (manualEvidence) {
      const evidenceLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "ManualPaymentEvidence" WHERE "id" = ${manualEvidence.id} FOR UPDATE`)
      throwIfKeystonePrismaError(evidenceLock)
    }
    const adapter = getPaymentAdapter(currentProvider)
    const captured = await adapter.capture(currentProvider, {
      attemptKey: claim.storageKey,
      amount: booking.totalAmount,
      currencyCode: booking.currencyCode,
      providerReference,
      instrumentBrand,
      instrumentLast4,
    })
    const now = new Date().toISOString()
    const payment = await sudo.query.Payment.createOne({
      data: {
        carrier: { connect: { id: booking.carrier.id } }, paymentKey: `PAY-${randomReference('', 12)}`,
        idempotencyKey: claim.storageKey, booking: { connect: { id: booking.id } }, provider: { connect: { id: currentProvider.id } },
        status: 'captured', amount: booking.totalAmount, authorizedAmount: booking.totalAmount,
        capturedAmount: booking.totalAmount, currencyCode: booking.currencyCode,
        providerPaymentId: captured.providerPaymentId, providerCaptureId: captured.providerCaptureId,
        instrumentBrand: captured.instrumentBrand, instrumentLast4: captured.instrumentLast4, authorizedAt: now, capturedAt: now,
        rawProviderData: captured.providerData, metadata: { adapterType: currentProvider.adapterType, purchaseKind: 'booking' },
      }, query: 'id',
    })
    if (manualEvidence) await sudo.query.ManualPaymentEvidence.updateOne({ where: { id: manualEvidence.id }, data: { status: 'consumed', payment: { connect: { id: payment.id } }, consumedAt: now } })
    await sudo.query.Booking.updateOne({ where: { id: booking.id }, data: { paymentStatus: 'paid', ...(booking.status === 'pending' ? { status: 'confirmed', confirmedAt: now } : {}) } })
    await writeAudit(sudo, transactionContext, {
      carrierId: booking.carrier.id, key: claim.storageKey, action: 'payment.capture', aggregateType: 'Booking', aggregateId: booking.id,
      after: { paymentStatus: 'paid', amount: booking.totalAmount, currencyCode: booking.currencyCode },
      metadata: { paymentId: payment.id, providerId: currentProvider.id },
    })
    const result = { resourceType: 'Payment', resourceId: payment.id, status: 'captured', changed: true, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}

export async function processBookingRefund(
  _root: unknown,
  args: { bookingId: string; amount: number; reason: string; providerReference: string; idempotencyKey: string },
  context: Context,
): Promise<WorkflowResult> {
  return runSerializableTransaction(context, async transactionContext => {
    await requireFreshPermission(transactionContext, 'canManagePayments')
    const sudo = transactionContext.sudo() as any
    let booking = await sudo.query.Booking.findOne({
      where: { id: args.bookingId },
      query: 'id status paymentStatus ticketingStatus totalAmount currencyCode carrier { id } payments { id status capturedAmount refundedAmount providerPaymentId metadata session { id providerData } provider { id providerKey adapterType configuration } } tickets { id status coupons { id status } }',
    })
    if (!booking) throw new DomainError('Booking not found.')
    await requireFreshCarrierPermission(transactionContext, 'canManagePayments', booking.carrier.id)
    if (!Number.isSafeInteger(args.amount) || args.amount <= 0) throw new DomainError('Refund amount must be a positive minor-unit integer.')
    const reason = args.reason.trim()
    const providerReference = args.providerReference.trim()
    if (!['customer_request', 'disruption', 'schedule_change', 'duplicate', 'fraud', 'other'].includes(reason)) throw new DomainError('Refund reason must use a supported commercial reason code.')
    if (providerReference.length < 6 || providerReference.length > 200) throw new DomainError('A bounded settlement reference is required.')
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const request = { bookingId: booking.id, amount: args.amount, reason, providerReference }
    const inspected = await inspectOperation(sudo, booking.carrier.id, key, 'refund.process', request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as WorkflowResult
    await lockBooking(transactionContext, booking.id)
    booking = await sudo.query.Booking.findOne({
      where: { id: booking.id },
      query: 'id status paymentStatus ticketingStatus totalAmount currencyCode carrier { id } payments { id status capturedAmount refundedAmount providerPaymentId metadata session { id providerData } provider { id providerKey adapterType configuration } } tickets { id status coupons { id status } }',
    })
    if (!booking) throw new DomainError('Booking changed while preparing the refund.')
    const lockedInspection = await inspectOperation(sudo, booking.carrier.id, key, 'refund.process', request)
    if (lockedInspection.replay) return { ...(lockedInspection.replay.result ?? {}), replayed: true } as WorkflowResult
    if ((booking.tickets ?? []).some((ticket: any) => (ticket.coupons ?? []).some((coupon: any) => ['boarded', 'flown'].includes(coupon.status)))) throw new DomainError('Boarded or flown ticket coupons require an exceptional servicing workflow and cannot be refunded here.')
    const payment = booking.payments.find((candidate: any) => {
      const purchaseKind = candidate.metadata?.purchaseKind ?? candidate.session?.providerData?.kind ?? 'booking'
      return purchaseKind !== 'seat' && ['captured', 'partially_refunded'].includes(candidate.status)
    })
    if (!payment) throw new DomainError('No captured payment is available to refund.')
    const remaining = payment.capturedAmount - payment.refundedAmount
    if (args.amount > remaining) throw new DomainError('Refund amount exceeds the remaining captured amount.')
    const providerLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentProvider" WHERE "id" = ${payment.provider.id} FOR UPDATE`)
    throwIfKeystonePrismaError(providerLock)
    const duplicateRefundReference = await (transactionContext.prisma as any).refund.findFirst({ where: { providerRefundId: providerReference, payment: { providerId: payment.provider.id } }, select: { id: true } })
    if (duplicateRefundReference) throw new DomainError('Settlement refund reference was already consumed by this provider.')
    const claim = await beginOperation(sudo, transactionContext, booking.carrier.id, key, 'refund.process', request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as WorkflowResult
    const manualEvidence = payment.provider.adapterType === 'manual' ? await (transactionContext.prisma as any).manualPaymentEvidence.findFirst({
      where: { bookingId: booking.id, purpose: 'refund', externalReference: providerReference, amount: args.amount, currencyCode: booking.currencyCode, status: 'approved' },
    }) : null
    if (payment.provider.adapterType === 'manual' && !manualEvidence) throw new DomainError('Approved manual refund evidence is required.')
    if (manualEvidence) {
      const evidenceLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "ManualPaymentEvidence" WHERE "id" = ${manualEvidence.id} FOR UPDATE`)
      throwIfKeystonePrismaError(evidenceLock)
    }
    const adapter = getPaymentAdapter(payment.provider)
    const refunded = await adapter.refund(payment.provider, {
      attemptKey: claim.storageKey,
      amount: args.amount,
      currencyCode: booking.currencyCode,
      paymentReference: payment.providerPaymentId,
      refundReference: providerReference,
    })
    const nextRefunded = payment.refundedAmount + args.amount
    const fullyRefunded = nextRefunded === payment.capturedAmount
    const processedAt = new Date().toISOString()
    const refund = await sudo.query.Refund.createOne({
      data: {
        carrier: { connect: { id: booking.carrier.id } }, booking: { connect: { id: booking.id } }, payment: { connect: { id: payment.id } },
        refundKey: `REF-${randomReference('', 12)}`, idempotencyKey: claim.storageKey, status: 'succeeded',
        reason, amount: args.amount, currencyCode: booking.currencyCode,
        providerRefundId: refunded.providerRefundId, requestedAt: processedAt, approvedAt: processedAt, processedAt,
        metadata: { adapterType: payment.provider.adapterType },
      }, query: 'id',
    })
    if (manualEvidence) await sudo.query.ManualPaymentEvidence.updateOne({ where: { id: manualEvidence.id }, data: { status: 'consumed', payment: { connect: { id: payment.id } }, consumedAt: processedAt } })
    await sudo.query.Payment.updateOne({ where: { id: payment.id }, data: { refundedAmount: nextRefunded, status: fullyRefunded ? 'refunded' : 'partially_refunded' } })
    await sudo.query.Booking.updateOne({ where: { id: booking.id }, data: { paymentStatus: fullyRefunded ? 'refunded' : 'partially_refunded', ...(fullyRefunded && (booking.tickets ?? []).length ? { ticketingStatus: 'voided' } : {}) } })
    if (fullyRefunded) {
      for (const ticket of booking.tickets ?? []) {
        if (!['issued', 'partially_used', 'suspended'].includes(ticket.status)) continue
        for (const coupon of ticket.coupons ?? []) {
          if (['open', 'checked_in', 'suspended'].includes(coupon.status)) await sudo.query.TicketCoupon.updateOne({ where: { id: coupon.id }, data: { status: 'refunded' } })
        }
        await sudo.query.Ticket.updateOne({ where: { id: ticket.id }, data: { status: 'refunded', refundedAt: processedAt } })
      }
      const retiredObligations = await (transactionContext.prisma as any).serviceObligation.updateMany({ where: { bookingId: booking.id, status: 'active' }, data: { status: 'retired' } })
      throwIfKeystonePrismaError(retiredObligations)
    }
    await writeAudit(sudo, transactionContext, {
      carrierId: booking.carrier.id, key: claim.storageKey, action: 'refund.process', aggregateType: 'Refund', aggregateId: refund.id,
      after: { status: 'succeeded', amount: args.amount, currencyCode: booking.currencyCode }, metadata: { bookingId: booking.id, paymentId: payment.id },
    })
    const result = { resourceType: 'Refund', resourceId: refund.id, status: 'succeeded', changed: true, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}

// The BookingSegment columns issueBookingTickets selects; coupons copy their fare basis and booking class from these.
type TicketIssuanceSegment = TicketableSegmentState & {
  carrierId: string | null
  bookingId: string | null
  bookingClassCode: string
  fareBasisCode: string | null
  flightInstanceId: string | null
  flightInstance: (DatedFlightEligibilityState & { carrierId: string | null }) | null
}

export async function issueBookingTickets(
  _root: unknown,
  args: { bookingId: string; idempotencyKey: string },
  context: Context,
): Promise<WorkflowResult> {
  return runSerializableTransaction(context, async transactionContext => {
    await requireFreshPermission(transactionContext, 'canManageTicketing')
    return issueBookingTicketsInTransaction(transactionContext, args, { authorize: true })
  })
}

// Initial ticket issuance inside the caller's transaction. Operators come through issueBookingTickets with their
// ticketing permission; a verified online card payment issues tickets with authorize: false (the payment is the proof).
export async function issueBookingTicketsInTransaction(
  transactionContext: Context,
  args: { bookingId: string; idempotencyKey: string },
  options: { authorize: boolean },
): Promise<WorkflowResult> {
  const sudo = transactionContext.sudo() as any
  const prisma = transactionContext.prisma as any
  const bookingQuery = `id status paymentStatus ticketingStatus totalAmount currencyCode carrier { id code } passengers { id passenger { id } }`
  let booking = await sudo.query.Booking.findOne({ where: { id: args.bookingId }, query: bookingQuery })
  if (!booking) throw new DomainError('Booking not found.')
  if (options.authorize) await requireFreshCarrierPermission(transactionContext, 'canManageTicketing', booking.carrier.id)
  await lockBooking(transactionContext, booking.id)
  booking = await sudo.query.Booking.findOne({ where: { id: booking.id }, query: bookingQuery })
  if (!booking) throw new DomainError('Booking changed while preparing ticket issuance.')
  const key = normalizeIdempotencyKey(args.idempotencyKey)
  const request = { bookingId: booking.id }
  const inspected = await inspectOperation(sudo, booking.carrier.id, key, 'ticket.issue', request)
  if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as WorkflowResult

  const readSegments = (): Promise<TicketIssuanceSegment[]> => prisma.bookingSegment.findMany({
    where: { bookingId: booking.id },
    orderBy: [{ sequence: 'asc' }, { id: 'asc' }],
    take: 51,
    select: {
      id: true, carrierId: true, bookingId: true, sequence: true, status: true, bookingClassCode: true, fareBasisCode: true, flightInstanceId: true,
      flightInstance: { select: { id: true, carrierId: true, status: true, scheduledDepartureAt: true, estimatedDepartureAt: true, actualDepartureAt: true, actualArrivalAt: true } },
    },
  })
  const initialSegments = await readSegments()
  if (initialSegments.length > 50) throw new DomainError('Booking exceeds the bounded 50-segment ticket-issuance limit.')
  const flightIds = [...new Set(initialSegments.map((segment: any) => segment.flightInstanceId).filter((id: unknown): id is string => typeof id === 'string'))].sort()
  if (flightIds.length) {
    const flightLocks = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" IN (${Prisma.join(flightIds)}) ORDER BY "id" FOR UPDATE`)
    throwIfKeystonePrismaError(flightLocks)
  }
  const ticketableSegmentsRaw = await readSegments()
  if (ticketableSegmentsRaw.length > 50) throw new DomainError('Booking exceeds the bounded 50-segment ticket-issuance limit.')
  const inspectedAfterFlightLocks = await inspectOperation(sudo, booking.carrier.id, key, 'ticket.issue', request)
  if (inspectedAfterFlightLocks.replay) return { ...(inspectedAfterFlightLocks.replay.result ?? {}), replayed: true } as WorkflowResult

  if (booking.paymentStatus !== 'paid') throw new DomainError('Capture payment before issuing tickets.')
  if (booking.ticketingStatus !== 'not_ticketed') throw new DomainError('Only a never-ticketed booking can receive its initial ticket issuance.')
  if (booking.status !== 'confirmed') throw new DomainError('Only confirmed bookings can be ticketed.')
  if (!booking.passengers?.length || booking.passengers.length > 9 || new Set(booking.passengers.map((passenger: any) => passenger.id)).size !== booking.passengers.length || booking.passengers.some((passenger: any) => !passenger.id || !passenger.passenger?.id)) {
    throw new DomainError('Booking must have one to nine uniquely linked passengers before ticket issuance.')
  }
  if (ticketableSegmentsRaw.some((segment: any) => segment.bookingId !== booking.id || segment.carrierId !== booking.carrier.id || segment.flightInstance?.carrierId !== booking.carrier.id)) {
    throw new DomainError('Ticketable itinerary ownership is inconsistent across booking, carrier, or dated service.')
  }
  const now = new Date()
  const ticketableSegments = selectCurrentTicketableSegments(ticketableSegmentsRaw, now)
  const [ticketCount, obligationCount, checkInCount, boardingPassCount, seatAssignmentCount, bagCount, ancillaryCouponCount] = await Promise.all([
    prisma.ticket.count({ where: { bookingId: booking.id } }),
    prisma.serviceObligation.count({ where: { bookingId: booking.id } }),
    prisma.checkIn.count({ where: { bookingId: booking.id } }),
    prisma.boardingPass.count({ where: { checkIn: { bookingId: booking.id } } }),
    prisma.seatAssignment.count({ where: { bookingId: booking.id } }),
    prisma.bag.count({ where: { bookingId: booking.id } }),
    prisma.electronicMiscCoupon.count({ where: { document: { bookingId: booking.id } } }),
  ])
  const artifactBlockers = ticketIssuanceArtifactBlockers({ ticketCount, obligationCount, checkInCount, boardingPassCount, seatAssignmentCount, bagCount, ancillaryCouponCount })
  if (artifactBlockers.length) throw new DomainError(`Initial ticket issuance is blocked by existing passenger-service artifacts: ${artifactBlockers.join(', ')}.`)

  const claim = await beginOperation(sudo, transactionContext, booking.carrier.id, key, 'ticket.issue', request)
  if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as WorkflowResult
  const issuedAt = now.toISOString()
  let ticketCountCreated = 0
  for (const [passengerIndex, bookingPassenger] of booking.passengers.entries()) {
    const passengerAmount = Math.floor(booking.totalAmount / booking.passengers.length) + (passengerIndex < booking.totalAmount % booking.passengers.length ? 1 : 0)
    const ticket = await sudo.query.Ticket.createOne({
      data: {
        carrier: { connect: { id: booking.carrier.id } }, ticketNumber: `${booking.carrier.code}-${randomReference('', 12)}`,
        booking: { connect: { id: booking.id } }, bookingPassenger: { connect: { id: bookingPassenger.id } }, passenger: { connect: { id: bookingPassenger.passenger.id } },
        issuingCarrierCode: booking.carrier.code, validatingCarrierCode: booking.carrier.code, status: 'issued',
        totalAmount: passengerAmount, currencyCode: booking.currencyCode, issuedAt, providerReference: `internal:${booking.id}`, metadata: { issuanceChannel: 'openfront', allocation: 'party-total-minor-units' },
      }, query: 'id',
    })
    for (const [segmentIndex, segment] of ticketableSegments.entries()) {
      const couponAmount = Math.floor(passengerAmount / ticketableSegments.length) + (segmentIndex < passengerAmount % ticketableSegments.length ? 1 : 0)
      const obligation = await sudo.query.ServiceObligation.createOne({
        data: {
          carrier: { connect: { id: booking.carrier.id } }, booking: { connect: { id: booking.id } },
          bookingPassenger: { connect: { id: bookingPassenger.id } }, obligationKey: createServiceObligationKey(),
          currentVersion: 1, status: 'active',
        }, query: 'id',
      })
      await sudo.query.TicketCoupon.createOne({
        data: {
          carrier: { connect: { id: booking.carrier.id } }, couponKey: `${ticket.id}:${segment.id}`,
          ticket: { connect: { id: ticket.id } }, bookingSegment: { connect: { id: segment.id } }, serviceObligation: { connect: { id: obligation.id } }, serviceObligationVersion: 1, couponNumber: segment.sequence,
          status: 'open', fareBasisCode: segment.fareBasisCode ?? 'STANDARD', bookingClassCode: segment.bookingClassCode ?? 'Y',
          amount: couponAmount, currencyCode: booking.currencyCode, entitlementSnapshot: { bookingId: booking.id, segmentId: segment.id },
        }, query: 'id',
      })
    }
    ticketCountCreated += 1
  }
  await sudo.query.Booking.updateOne({ where: { id: booking.id }, data: { status: 'ticketed', ticketingStatus: 'ticketed', ticketedAt: issuedAt } })
  await writeAudit(sudo, transactionContext, {
    carrierId: booking.carrier.id, key: claim.storageKey, action: 'ticket.issue', aggregateType: 'Booking', aggregateId: booking.id,
    after: { status: 'ticketed', ticketingStatus: 'ticketed' }, metadata: { ticketCount: ticketCountCreated, currentSegmentCount: ticketableSegments.length },
  })
  const result = { resourceType: 'Booking', resourceId: booking.id, status: 'ticketed', changed: true, replayed: false }
  await finishOperation(sudo, claim.record.id, result)
  return result
}

export async function registerPassengerTravelDocument(
  _root: unknown,
  args: { bookingPassengerId: string; bookingSegmentId: string; documentType: string; documentNumber: string; issuingCountryCode: string; nationalityCode?: string | null; issuedAt?: string | null; expiresAt: string; providerReference: string; evidenceVersion: string; verificationExpiresAt: string; idempotencyKey: string },
  context: Context,
): Promise<WorkflowResult> {
  return runSerializableTransaction(context, async transactionContext => {
    await requireFreshPermission(transactionContext, 'canManageSecurePassengerData')
    const bookingPassenger = await (transactionContext.prisma as any).bookingPassenger.findUnique({ where: { id: args.bookingPassengerId }, include: { passenger: true, booking: true } })
    const segment = await (transactionContext.prisma as any).bookingSegment.findUnique({ where: { id: args.bookingSegmentId }, include: { flightInstance: true } })
    if (!bookingPassenger || !segment || bookingPassenger.bookingId !== segment.bookingId || bookingPassenger.carrierId !== segment.carrierId) throw new DomainError('Resource not found or inaccessible.')
    const actor = await requireStationCapability(transactionContext, 'canManageSecurePassengerData', segment.carrierId, segment.flightInstance.originId, 'canCheckIn')
    await lockBooking(transactionContext, bookingPassenger.bookingId)
    const currentBooking = await (transactionContext.prisma as any).booking.findUnique({ where: { id: bookingPassenger.bookingId }, select: { status: true } })
    const currentSegment = await (transactionContext.prisma as any).bookingSegment.findUnique({ where: { id: segment.id }, select: { status: true, bookingId: true } })
    if (!currentBooking || !currentSegment || currentSegment.bookingId !== bookingPassenger.bookingId) throw new DomainError('Booking changed while preparing document registration.')
    const passengerLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "Passenger" WHERE "id" = ${bookingPassenger.passengerId} FOR UPDATE`)
    throwIfKeystonePrismaError(passengerLock)
    const documentNumber = args.documentNumber.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const documentTypes = new Set(['passport', 'national_id', 'residence_permit', 'visa', 'known_traveler', 'redress', 'other'])
    const issuingCountryCode = args.issuingCountryCode.trim().toUpperCase()
    const nationalityCode = args.nationalityCode?.trim().toUpperCase() || null
    const providerReference = args.providerReference.trim()
    const evidenceVersion = args.evidenceVersion.trim()
    const expiresAt = new Date(args.expiresAt)
    const issuedAt = args.issuedAt ? new Date(args.issuedAt) : null
    const verificationExpiresAt = new Date(args.verificationExpiresAt)
    if (!documentTypes.has(args.documentType) || documentNumber.length < 4 || documentNumber.length > 64 || !/^[A-Z]{2}$/.test(issuingCountryCode) || (nationalityCode && !/^[A-Z]{2}$/.test(nationalityCode))) throw new DomainError('Travel-document identity fields are invalid.')
    if (Number.isNaN(expiresAt.getTime()) || (issuedAt && Number.isNaN(issuedAt.getTime())) || Number.isNaN(verificationExpiresAt.getTime())) throw new DomainError('Document validity dates are invalid.')

    if (!providerReference || providerReference.length > 200 || !evidenceVersion || evidenceVersion.length > 100) throw new DomainError('A bounded manual/provider reference and evidence version are required.')
    const tokenizationKey = travelDocumentTokenizationKey()
    if (tokenizationKey.length < 32) throw new DomainError('Travel-document tokenization is not configured.')
    const documentToken = `tdoc_${crypto.createHmac('sha256', tokenizationKey).update(`${segment.carrierId}\u0000${documentNumber}`).digest('hex')}`
    const documentNumberHash = crypto.createHash('sha256').update(documentToken).digest('hex')
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const request = { bookingPassengerId: bookingPassenger.id, bookingSegmentId: segment.id, documentType: args.documentType, documentNumberHash, issuingCountryCode, nationalityCode, issuedAt: issuedAt?.toISOString() ?? null, expiresAt: expiresAt.toISOString(), providerReference, evidenceVersion, verificationExpiresAt: verificationExpiresAt.toISOString() }
    const sudo = transactionContext.sudo() as any
    const inspected = await inspectOperation(sudo, segment.carrierId, key, 'document.register-verify', request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as WorkflowResult
    if (!currentBooking || !currentSegment || currentSegment.bookingId !== bookingPassenger.bookingId || ['cancelled', 'completed'].includes(currentBooking.status) || ['cancelled', 'refunded', 'reaccommodated', 'flown'].includes(currentSegment.status)) throw new DomainError('Booking changed while preparing document registration.')
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date() || (issuedAt && (Number.isNaN(issuedAt.getTime()) || issuedAt > new Date() || issuedAt >= expiresAt))) throw new DomainError('Travel-document validity is invalid.')
    if (Number.isNaN(verificationExpiresAt.getTime()) || verificationExpiresAt <= new Date() || verificationExpiresAt > expiresAt) throw new DomainError('Verification expiry must be current and no later than the document expiry.')
    const claim = await beginOperation(sudo, transactionContext, segment.carrierId, key, 'document.register-verify', request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as WorkflowResult
    const retained = await (transactionContext.prisma as any).travelDocument.findFirst({ where: { carrierId: segment.carrierId, passengerId: bookingPassenger.passengerId, documentNumberHash } })
    if (retained && ['rejected', 'expired', 'revoked'].includes(retained.status)) throw new DomainError('A rejected, expired, or revoked travel document cannot be reactivated.')
    if (retained && (retained.documentType !== args.documentType || retained.issuingCountryCode !== issuingCountryCode)) throw new DomainError('Retained travel-document identity does not match this attestation.')
    const now = new Date()
    const document = retained
      ? await (transactionContext.prisma as any).travelDocument.update({ where: { id: retained.id }, data: { nationalityCode, issuedAt, expiresAt, status: 'verified', verificationProviderReference: providerReference, verifiedAt: now, verifiedById: actor.itemId } })
      : await (transactionContext.prisma as any).travelDocument.create({ data: { carrierId: segment.carrierId, passengerId: bookingPassenger.passengerId, documentType: args.documentType, documentNumberToken: documentToken, documentNumberHash, documentNumberLast4: documentNumber.slice(-4), issuingCountryCode, nationalityCode, issuedAt, expiresAt, status: 'verified', verificationProviderReference: providerReference, verifiedAt: now, verifiedById: actor.itemId } })
    const verification = await (transactionContext.prisma as any).documentVerification.create({ data: { carrierId: segment.carrierId, verificationKey: claim.storageKey, passengerId: bookingPassenger.passengerId, travelDocumentId: document.id, bookingSegmentId: segment.id, status: 'verified', evidenceVersion, providerReference, verifiedById: actor.itemId, verifiedAt: now, expiresAt: verificationExpiresAt } })
    await writeAudit(sudo, transactionContext, { carrierId: segment.carrierId, key: claim.storageKey, action: 'document.register-verify', aggregateType: 'TravelDocument', aggregateId: document.id, after: { status: 'verified', documentType: args.documentType, issuingCountryCode, expiresAt: expiresAt.toISOString() }, metadata: { bookingSegmentId: segment.id, documentVerificationId: verification.id, evidenceVersion } })
    const result = { resourceType: 'TravelDocument', resourceId: document.id, status: 'verified', changed: true, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}

export async function verifyPassengerTravelDocument(
  _root: unknown,
  args: { travelDocumentId: string; bookingSegmentId: string; providerReference: string; evidenceVersion: string; expiresAt: string; idempotencyKey: string },
  context: Context,
): Promise<WorkflowResult> {
  return runSerializableTransaction(context, async transactionContext => {
    await requireFreshPermission(transactionContext, 'canManageSecurePassengerData')
    const sudo = transactionContext.sudo() as any
    const document = await (transactionContext.prisma as any).travelDocument.findUnique({ where: { id: args.travelDocumentId }, include: { passenger: true } })
    const segment = await (transactionContext.prisma as any).bookingSegment.findUnique({ where: { id: args.bookingSegmentId }, include: { flightInstance: true, booking: { include: { passengers: true } } } })
    if (!document || !segment || document.carrierId !== segment.carrierId || !segment.booking.passengers.some((entry: any) => entry.passengerId === document.passengerId)) {
      throw new DomainError('Resource not found or inaccessible.')
    }
    await requireStationCapability(transactionContext, 'canManageSecurePassengerData', segment.carrierId, segment.flightInstance.originId, 'canCheckIn')
    await lockBooking(transactionContext, segment.bookingId)
    const currentBooking = await (transactionContext.prisma as any).booking.findUnique({ where: { id: segment.bookingId }, select: { status: true } })
    const currentSegment = await (transactionContext.prisma as any).bookingSegment.findUnique({ where: { id: segment.id }, select: { status: true } })
    if (!currentBooking || !currentSegment) throw new DomainError('Booking changed while preparing document verification.')

    const expiresAt = new Date(args.expiresAt)
    if (Number.isNaN(expiresAt.getTime())) throw new DomainError('Verification expiry is invalid.')
    const providerReference = args.providerReference.trim()
    const evidenceVersion = args.evidenceVersion.trim()
    if (!providerReference || providerReference.length > 200 || !evidenceVersion || evidenceVersion.length > 100) throw new DomainError('A bounded provider/manual reference and evidence version are required.')
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const request = { travelDocumentId: document.id, bookingSegmentId: segment.id, providerReference, evidenceVersion, expiresAt: expiresAt.toISOString() }
    const inspected = await inspectOperation(sudo, segment.carrierId, key, 'document.verify', request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as WorkflowResult
    if (!currentBooking || !currentSegment || ['cancelled', 'completed'].includes(currentBooking.status) || ['cancelled', 'refunded', 'reaccommodated', 'flown'].includes(currentSegment.status)) throw new DomainError('Booking changed while preparing document verification.')
    if (document.status !== 'verified' || !document.expiresAt || document.expiresAt <= new Date()) throw new DomainError('The travel document is not current.')
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date() || expiresAt > document.expiresAt) throw new DomainError('Verification expiry must be current and no later than the document expiry.')
    const claim = await beginOperation(sudo, transactionContext, segment.carrierId, key, 'document.verify', request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as WorkflowResult
    const verification = await sudo.query.DocumentVerification.createOne({
      data: {
        carrier: { connect: { id: segment.carrierId } }, verificationKey: claim.storageKey,
        passenger: { connect: { id: document.passengerId } }, travelDocument: { connect: { id: document.id } },
        bookingSegment: { connect: { id: segment.id } }, status: 'verified',
        evidenceVersion, providerReference,
        verifiedBy: { connect: { id: (transactionContext.session as any).itemId } }, expiresAt: expiresAt.toISOString(),
      }, query: 'id status',
    })
    await writeAudit(sudo, transactionContext, { carrierId: segment.carrierId, key: claim.storageKey, action: 'document.verify', aggregateType: 'DocumentVerification', aggregateId: verification.id, after: { status: 'verified', expiresAt: expiresAt.toISOString() }, metadata: { bookingSegmentId: segment.id } })
    const result = { resourceType: 'DocumentVerification', resourceId: verification.id, status: 'verified', changed: true, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}

export async function checkInBookingPassenger(
  _root: unknown,
  args: { bookingPassengerId: string; bookingSegmentId: string; idempotencyKey: string; seatId?: string | null; customerBookingId?: string; customerAccessTokenHash?: string },
  context: Context,
): Promise<WorkflowResult> {
  return runSerializableTransaction(context, async transactionContext => {
    const customerBookingId = isStorefrontContext(transactionContext) ? (transactionContext.session as any)?.data?.storefrontBookingId : undefined
    if (!customerBookingId || customerBookingId !== args.customerBookingId) await requireFreshPermission(transactionContext, 'canManageAirportService')
    const sudo = transactionContext.sudo() as any
    const bookingPassenger = await sudo.query.BookingPassenger.findOne({
      where: { id: args.bookingPassengerId },
      query: 'id booking { id status carrier { id code } } passenger { id givenName familyName }',
    })
    const segment = await sudo.query.BookingSegment.findOne({
      where: { id: args.bookingSegmentId },
      query: 'id status booking { id carrier { id code } } flightInstance { id flightNumber status scheduledDepartureAt estimatedDepartureAt actualDepartureAt actualArrivalAt origin { id iataCode } destination { id iataCode } departureGate departureTerminal }',
    })
    if (!bookingPassenger || !segment || bookingPassenger.booking.id !== segment.booking.id) throw new DomainError('Passenger and segment must belong to the same booking.')
    const booking = bookingPassenger.booking
    if (!customerBookingId) await requireStationCapability(transactionContext, 'canManageAirportService', booking.carrier.id, segment.flightInstance.origin.id, 'canCheckIn')
    else if (booking.id !== customerBookingId) throw new DomainError('Resource not found or inaccessible.')
    await lockBooking(transactionContext, booking.id)
    const flightLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" = ${segment.flightInstance.id} FOR UPDATE`)
    throwIfKeystonePrismaError(flightLock)
    const currentBooking = await (transactionContext.prisma as any).booking.findUnique({ where: { id: booking.id }, select: { status: true, paymentStatus: true, ticketingStatus: true, accessTokenHash: true, accessTokenExpiresAt: true } })
    const currentSegment = await (transactionContext.prisma as any).bookingSegment.findUnique({ where: { id: segment.id }, select: { bookingId: true, carrierId: true, flightInstanceId: true, status: true, cabinCode: true, flightInstance: { select: { id: true, carrierId: true, status: true, scheduledDepartureAt: true, estimatedDepartureAt: true, actualDepartureAt: true, actualArrivalAt: true, departureGate: true, departureTerminal: true } } } })
    if (!currentBooking || !currentSegment || currentSegment.bookingId !== booking.id || currentSegment.carrierId !== booking.carrier.id || currentSegment.flightInstanceId !== segment.flightInstance.id || currentSegment.flightInstance?.carrierId !== booking.carrier.id || (customerBookingId && !hasCurrentStorefrontBookingAccess(currentBooking, args.customerAccessTokenHash))) throw new DomainError('Booking changed or access was revoked while preparing check-in.')
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const request = { bookingPassengerId: args.bookingPassengerId, bookingSegmentId: args.bookingSegmentId, seatId: args.seatId ?? null }
    const inspected = await inspectOperation(sudo, booking.carrier.id, key, 'check-in.create', request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as WorkflowResult
    if (!['ticketed', 'in_progress'].includes(currentBooking.status) || currentBooking.paymentStatus !== 'paid' || currentBooking.ticketingStatus !== 'ticketed') throw new DomainError('Booking must have a current paid ticket before check-in.')
    if (!['confirmed', 'checked_in', 'offloaded', 'boarded'].includes(currentSegment.status)) throw new DomainError('Segment is not eligible for check-in.')
    assertDatedFlightEligibleForAction(currentSegment.flightInstance, 'Check-in', new Date())
    const previousCheckIn = await (transactionContext.prisma as any).checkIn.findFirst({
      where: { bookingPassengerId: bookingPassenger.id, bookingSegmentId: segment.id },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: { id: true, status: true },
    })
    if (previousCheckIn && previousCheckIn.status !== 'offloaded') throw new DomainError('This passenger already has an active or terminal check-in for the itinerary segment.')
    if (previousCheckIn?.status === 'offloaded') {
      const priorBags = await (transactionContext.prisma as any).bag.count({
        where: {
          bookingPassengerId: bookingPassenger.id,
          OR: [{ bookingSegmentId: segment.id }, { segments: { some: { id: segment.id } } }],
        },
      })
      if (priorBags > 0) throw new DomainError('Checked baggage must have an authorized, audited physical disposition before re-check-in.')
    }
    const verification = await (transactionContext.prisma as any).documentVerification.findFirst({
      where: {
        carrierId: booking.carrier.id, passengerId: bookingPassenger.passenger.id,
        bookingSegmentId: segment.id, status: 'verified', expiresAt: { gt: new Date() },
        travelDocument: { passengerId: bookingPassenger.passenger.id, status: 'verified', expiresAt: { gt: new Date() } },
      },
      select: { id: true, evidenceVersion: true, providerReference: true },
      orderBy: { verifiedAt: 'desc' },
    })
    if (!verification) throw new DomainError('A current authoritative travel-document verification is required.')
    const couponCandidates = await (transactionContext.prisma as any).ticketCoupon.findMany({
      where: {
        bookingSegmentId: segment.id, status: 'open',
        ticket: { bookingId: booking.id, bookingPassengerId: bookingPassenger.id, passengerId: bookingPassenger.passenger.id, status: { in: ['issued', 'partially_used'] } },
        serviceObligation: { is: { bookingPassengerId: bookingPassenger.id, bookingId: booking.id, status: 'active' } },
      },
      include: { serviceObligation: true, ticket: true },
    })
    const coupon = couponCandidates.find((candidate: any) => candidate.serviceObligation && candidate.serviceObligationVersion === candidate.serviceObligation.currentVersion)
    if (!coupon) throw new DomainError('No current-version open ticket coupon entitles this passenger to this segment.')
    const obligationLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "ServiceObligation" WHERE "id" = ${coupon.serviceObligationId} FOR UPDATE`)
    throwIfKeystonePrismaError(obligationLock)
    const couponLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "TicketCoupon" WHERE "id" = ${coupon.id} FOR UPDATE`)
    throwIfKeystonePrismaError(couponLock)
    const currentCoupon = await (transactionContext.prisma as any).ticketCoupon.findUnique({ where: { id: coupon.id }, include: { serviceObligation: true, ticket: true } })
    if (currentCoupon?.status !== 'open' || !['issued', 'partially_used'].includes(currentCoupon.ticket?.status) || currentCoupon.ticket?.bookingId !== booking.id || currentCoupon.ticket?.bookingPassengerId !== bookingPassenger.id || currentCoupon.ticket?.passengerId !== bookingPassenger.passenger.id || currentCoupon.serviceObligation?.status !== 'active' || currentCoupon.serviceObligation.bookingId !== booking.id || currentCoupon.serviceObligation.bookingPassengerId !== bookingPassenger.id || currentCoupon.serviceObligationVersion !== currentCoupon.serviceObligation.currentVersion) throw new DomainError('Ticket coupon service obligation changed while preparing check-in.')
    const claim = await beginOperation(sudo, transactionContext, booking.carrier.id, key, 'check-in.create', request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as WorkflowResult
    const now = new Date().toISOString()
    const currentFlight = currentSegment.flightInstance
    const seatMaps = await (transactionContext.prisma as any).seatMap.findMany({
      where: { flightInstanceId: currentFlight.id, status: 'published' },
      orderBy: [{ version: 'desc' }, { id: 'asc' }],
      take: 2,
      include: { seats: { orderBy: [{ designator: 'asc' }, { id: 'asc' }], take: 1000, include: { cabin: true } } },
    })
    if (seatMaps.length !== 1) throw new DomainError('Check-in requires exactly one published seat map for the dated flight.')
    const seats = seatMaps.flatMap((seatMap: any) => (seatMap.seats ?? [])
      .filter((seat: any) => seat.status === 'available' && seat.cabin?.code === currentSegment.cabinCode && (!args.seatId ? Number(seat.surchargeAmount ?? 0) === 0 : seat.id === args.seatId))
      .map((seat: any) => ({ ...seat, seatMap })))
      .sort((left: any, right: any) => left.designator.localeCompare(right.designator))
    const assignmentHistory = await (transactionContext.prisma as any).seatAssignment.findMany({
      where: { bookingId: booking.id, bookingPassengerId: bookingPassenger.id, bookingSegmentId: segment.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 51,
      include: { seat: { include: { cabin: true, seatMap: true } } },
    })
    if (assignmentHistory.length > 50) throw new DomainError('Seat-assignment history exceeds the bounded check-in review; reconcile it before check-in.')
    // Released or cancelled free rows are preserved history from earlier seat changes (A → B), not simultaneous
    // assignments. Only one current assignment may exist, and paid or unsupported history still needs resolution.
    const activeAssignments = assignmentHistory.filter((assignment: any) => ['held', 'assigned', 'confirmed'].includes(assignment.status))
    if (activeAssignments.length > 1) throw new DomainError('Multiple active seat-assignment records require an audited seat reconciliation before check-in.')
    if (assignmentHistory.some((assignment: any) => assignment.amount !== 0)) throw new DomainError('Paid or inconsistent seat assignments require an authorized audited resolution before check-in.')
    if (assignmentHistory.some((assignment: any) => !activeAssignments.includes(assignment) && !['released', 'cancelled'].includes(assignment.status))) throw new DomainError('The prior seat-assignment state is unsupported for check-in.')
    const existingAssignment = activeAssignments[0] ?? null
    if (existingAssignment && (existingAssignment.bookingId !== booking.id || existingAssignment.bookingPassengerId !== bookingPassenger.id || existingAssignment.passengerId !== bookingPassenger.passenger.id || existingAssignment.bookingSegmentId !== segment.id || existingAssignment.occupancyKey !== `${currentFlight.id}:${existingAssignment.seatId}` || existingAssignment.currencyCode !== booking.currencyCode || existingAssignment.seat?.seatMap?.flightInstanceId !== currentFlight.id || existingAssignment.seat?.seatMap?.status !== 'published' || existingAssignment.seat?.status !== 'available' || existingAssignment.seatDesignatorSnapshot !== existingAssignment.seat?.designator || existingAssignment.seat?.cabin?.code !== currentSegment.cabinCode || Number(existingAssignment.seat?.surchargeAmount ?? 0) !== 0)) {
      throw new DomainError('The existing seat assignment is inconsistent, paid, unavailable, or not on a published seat map for this dated flight.')
    }
    let selectedSeat: any = existingAssignment
      ? seats.find((seat: any) => seat.id === existingAssignment.seatId && seat.seatMap.id === existingAssignment.seat.seatMapId)
      : null
    for (const candidate of existingAssignment ? [] : seats) {
      const lock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "Seat" WHERE "id" = ${candidate.id} FOR UPDATE`)
      throwIfKeystonePrismaError(lock)
      const occupied = await (transactionContext.prisma as any).seatAssignment.findFirst({
        where: { seatId: candidate.id, status: { in: ['held', 'assigned', 'confirmed', 'boarded'] }, bookingSegment: { flightInstanceId: currentFlight.id } },
        select: { id: true },
      })
      if (!occupied) { selectedSeat = candidate; break }
    }
    if (!selectedSeat) throw new DomainError('No seat is available on a published seat map for this segment.')
    if (args.seatId && existingAssignment && selectedSeat.id !== args.seatId) throw new DomainError('The requested seat differs from the passenger’s existing assignment.')
    if (Number(selectedSeat.surchargeAmount ?? 0) !== 0 || selectedSeat.currencyCode !== booking.currencyCode) throw new DomainError('A paid or currency-inconsistent seat requires an authorized audited entitlement before check-in.')
    const seatAssignment = existingAssignment
      ? await sudo.query.SeatAssignment.updateOne({ where: { id: existingAssignment.id }, data: { status: 'confirmed', confirmedAt: now }, query: 'id' })
      : await sudo.query.SeatAssignment.createOne({
      data: {
        carrier: { connect: { id: booking.carrier.id } }, assignmentKey: `${bookingPassenger.id}:${segment.id}:${selectedSeat.id}:${randomReference('', 8)}`, occupancyKey: `${currentFlight.id}:${selectedSeat.id}`,
        booking: { connect: { id: booking.id } }, bookingPassenger: { connect: { id: bookingPassenger.id } }, passenger: { connect: { id: bookingPassenger.passenger.id } }, bookingSegment: { connect: { id: segment.id } }, seat: { connect: { id: selectedSeat.id } },
        status: 'confirmed', seatDesignatorSnapshot: selectedSeat.designator, cabinCodeSnapshot: selectedSeat.cabin?.code ?? 'Y', characteristicsSnapshot: selectedSeat.characteristics ?? [], amount: selectedSeat.surchargeAmount ?? 0, currencyCode: selectedSeat.currencyCode, assignedAt: now, confirmedAt: now,
      }, query: 'id',
    })
    const checkInData = {
      status: 'checked_in', channel: customerBookingId ? 'web' : 'agent', travelDocumentsVerified: true, checkedInAt: now,
      offloadedAt: null, boardedAt: null,
      booking: { connect: { id: booking.id } }, bookingPassenger: { connect: { id: bookingPassenger.id } }, passenger: { connect: { id: bookingPassenger.passenger.id } },
      bookingSegment: { connect: { id: segment.id } }, flightInstance: { connect: { id: currentFlight.id } }, seatAssignment: { connect: { id: seatAssignment.id } },
      ticketCoupon: { connect: { id: coupon.id } }, eligibilityData: { documentVerificationId: verification.id, evidenceVersion: verification.evidenceVersion, confirmedAt: now },
    }
    const checkIn = previousCheckIn
      ? await sudo.query.CheckIn.updateOne({ where: { id: previousCheckIn.id }, data: checkInData, query: 'id' })
      : await sudo.query.CheckIn.createOne({
        data: { carrier: { connect: { id: booking.carrier.id } }, checkInKey: `${bookingPassenger.id}:${segment.id}`, ...checkInData },
        query: 'id',
      })
    const boardingPass = await sudo.query.BoardingPass.createOne({
      data: {
        carrier: { connect: { id: booking.carrier.id } }, passNumber: `BP-${randomReference('', 10)}`,
        checkIn: { connect: { id: checkIn.id } }, passenger: { connect: { id: bookingPassenger.passenger.id } }, bookingSegment: { connect: { id: segment.id } }, seatAssignment: { connect: { id: seatAssignment.id } },
        status: 'issued', barcodeToken: randomReference('BP-', 32), seatDesignatorSnapshot: selectedSeat.designator,
        boardingGroup: 'A', boardingZone: '1', gateSnapshot: currentFlight.departureGate ?? 'TBD', terminalSnapshot: currentFlight.departureTerminal ?? 'TBD',
      }, query: 'id',
    })
    await sudo.query.TicketCoupon.updateOne({ where: { id: coupon.id }, data: { status: 'checked_in', checkedInAt: now } })
    const segmentStatus = await currentSegmentServiceStatus(transactionContext.prisma, booking.id, segment.id)
    await sudo.query.BookingSegment.updateOne({ where: { id: segment.id }, data: { status: segmentStatus } })
    await writeAudit(sudo, transactionContext, {
      carrierId: booking.carrier.id, key: claim.storageKey, action: 'check-in.create', aggregateType: 'CheckIn', aggregateId: checkIn.id,
      after: { status: 'checked_in' }, metadata: { boardingPassId: boardingPass.id, seatAssignmentId: seatAssignment.id, seat: selectedSeat.designator },
    })
    const result = { resourceType: 'CheckIn', resourceId: checkIn.id, status: 'checked_in', changed: true, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}

export async function acceptCheckedBag(
  _root: unknown,
  args: { bookingPassengerId: string; flightInstanceId: string; idempotencyKey: string; weightGrams: number },
  context: Context,
): Promise<WorkflowResult> {
  return runSerializableTransaction(context, async transactionContext => {
    await requireFreshPermission(transactionContext, 'canManageAirportService')
    const sudo = transactionContext.sudo() as any
    let bookingPassenger = await (transactionContext.prisma as any).bookingPassenger.findUnique({
      where: { id: args.bookingPassengerId },
      include: { booking: true, passenger: true },
    })
    let flight = await (transactionContext.prisma as any).flightInstance.findUnique({ where: { id: args.flightInstanceId }, include: { carrier: { select: { code: true } }, origin: true, destination: true } })
    if (!bookingPassenger || !flight || bookingPassenger.booking.carrierId !== flight.carrierId) throw new DomainError('Resource not found or inaccessible.')
    await requireStationCapability(transactionContext, 'canManageAirportService', flight.carrierId, flight.originId, 'canAcceptBags')
    await lockBooking(transactionContext, bookingPassenger.bookingId)
    const flightLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" = ${args.flightInstanceId} FOR UPDATE`)
    throwIfKeystonePrismaError(flightLock)
    bookingPassenger = await (transactionContext.prisma as any).bookingPassenger.findUnique({ where: { id: args.bookingPassengerId }, include: { booking: true, passenger: true } })
    flight = await (transactionContext.prisma as any).flightInstance.findUnique({ where: { id: args.flightInstanceId }, include: { carrier: { select: { code: true } }, origin: true, destination: true } })
    if (!bookingPassenger || !flight || bookingPassenger.booking.carrierId !== flight.carrierId) throw new DomainError('Booking or flight changed while preparing bag acceptance.')
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    if (!Number.isInteger(args.weightGrams) || args.weightGrams < 0 || args.weightGrams > 100_000) throw new DomainError('Bag weight must be an integer between 0 and 100000 grams.')
    const request = { bookingPassengerId: args.bookingPassengerId, flightInstanceId: args.flightInstanceId, weightGrams: args.weightGrams }
    const inspected = await inspectOperation(sudo, flight.carrierId, key, 'bag.accept', request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as WorkflowResult
    if (bookingPassenger.booking.paymentStatus !== 'paid' || bookingPassenger.booking.ticketingStatus !== 'ticketed' || !['ticketed', 'in_progress'].includes(bookingPassenger.booking.status)) throw new DomainError('Booking is not eligible for new bag acceptance.')
    assertDatedFlightEligibleForAction(flight, 'Checked-bag acceptance', new Date())
    const segment = await (transactionContext.prisma as any).bookingSegment.findFirst({
      where: { bookingId: bookingPassenger.bookingId, flightInstanceId: flight.id, status: { in: ['confirmed', 'checked_in', 'boarded', 'offloaded'] } },
      include: {
        checkIns: { where: { bookingPassengerId: bookingPassenger.id, passengerId: bookingPassenger.passengerId, status: 'checked_in' }, include: { ticketCoupon: { include: { ticket: true, serviceObligation: true } } } },
      },
    })
    const checkIn = segment?.checkIns?.[0]
    const currentCoupon = checkIn?.ticketCoupon
    if (!segment || segment.carrierId !== flight.carrierId || segment.bookingId !== bookingPassenger.bookingId || segment.flightInstanceId !== flight.id
      || !checkIn || checkIn.carrierId !== flight.carrierId || checkIn.bookingId !== bookingPassenger.bookingId || checkIn.bookingPassengerId !== bookingPassenger.id || checkIn.bookingSegmentId !== segment.id || checkIn.flightInstanceId !== flight.id
      || !currentCoupon || currentCoupon.carrierId !== flight.carrierId || currentCoupon.bookingSegmentId !== segment.id || currentCoupon.status !== 'checked_in' || !['issued', 'partially_used'].includes(currentCoupon.ticket?.status)
      || currentCoupon.ticket?.carrierId !== flight.carrierId || currentCoupon.ticket?.bookingId !== bookingPassenger.bookingId || currentCoupon.ticket?.bookingPassengerId !== bookingPassenger.id || currentCoupon.ticket?.passengerId !== bookingPassenger.passengerId
      || currentCoupon.serviceObligation?.carrierId !== flight.carrierId || currentCoupon.serviceObligation?.status !== 'active' || currentCoupon.serviceObligation.bookingId !== bookingPassenger.bookingId || currentCoupon.serviceObligation.bookingPassengerId !== bookingPassenger.id
      || currentCoupon.serviceObligationVersion == null || currentCoupon.serviceObligationVersion !== currentCoupon.serviceObligation.currentVersion) {
      throw new DomainError('A checked-in passenger with a current-version ticket coupon and service obligation is required for bag acceptance.')
    }
    const existingBagCount = await (transactionContext.prisma as any).bag.count({ where: { bookingPassengerId: bookingPassenger.id, bookingSegmentId: segment.id } })
    const allowance = normalizeIncludedBaggageSnapshot(segment.includedBaggageSnapshot)
    const withinIncludedAllowance = existingBagCount < allowance.pieces && args.weightGrams <= allowance.maxWeightGrams
    const paidCandidates = withinIncludedAllowance ? [] : await (transactionContext.prisma as any).electronicMiscCoupon.findMany({
      where: {
        bookingSegmentId: segment.id, status: 'open', ancillaryProduct: { type: 'checked_bag', status: 'active' },
        document: { bookingId: bookingPassenger.bookingId, bookingPassengerId: bookingPassenger.id, passengerId: bookingPassenger.passengerId, status: 'issued' },
      },
      include: { document: true, ancillaryProduct: true },
    })
    const paidCoupon = paidCandidates.find((candidate: any) => {
      const product = candidate.ancillaryProduct
      const attributes = (product?.attributes ?? {}) as { maxWeightGrams?: number }
      const expectedAmount = Number(product?.defaultPriceAmount ?? 0) + Number(product?.taxAmount ?? 0)
      const expectedCurrency = String(product?.currencyCode ?? '')
      const maxWeight = Number(attributes.maxWeightGrams ?? 100_000)
      return candidate.amount === expectedAmount && candidate.currencyCode === expectedCurrency
        && candidate.document.totalAmount >= candidate.amount && candidate.document.currencyCode === expectedCurrency
        && expectedCurrency === bookingPassenger.booking.currencyCode && args.weightGrams <= maxWeight
    })
    if (!withinIncludedAllowance && !paidCoupon) throw new DomainError('No unused checked-bag entitlement with matching amount, currency, passenger, segment, and weight covers this bag.')
    if (paidCoupon) {
      const entitlementLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "ElectronicMiscCoupon" WHERE "id" = ${paidCoupon.id} FOR UPDATE`)
      throwIfKeystonePrismaError(entitlementLock)
      const currentEntitlement = await (transactionContext.prisma as any).electronicMiscCoupon.findUnique({ where: { id: paidCoupon.id }, select: { status: true } })
      if (currentEntitlement?.status !== 'open') throw new DomainError('The checked-bag entitlement was already consumed.')
    }
    const claim = await beginOperation(sudo, transactionContext, flight.carrierId, key, 'bag.accept', request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as WorkflowResult
    const bag = await sudo.query.Bag.createOne({
      data: {
        carrier: { connect: { id: flight.carrierId } }, bagKey: `BAG-${randomReference('', 10)}`, tagNumber: `${flight.carrier.code}${randomReference('', 8)}`,
        booking: { connect: { id: bookingPassenger.bookingId } }, bookingPassenger: { connect: { id: bookingPassenger.id } }, passenger: { connect: { id: bookingPassenger.passengerId } },
        flightInstance: { connect: { id: flight.id } }, bookingSegment: { connect: { id: segment.id } }, checkIn: { connect: { id: checkIn.id } }, ticketCoupon: { connect: { id: checkIn.ticketCoupon.id } },
        entitlementDocument: paidCoupon ? { connect: { id: paidCoupon.document.id } } : undefined,
        origin: { connect: { id: flight.originId } }, destination: { connect: { id: flight.destinationId } },
        status: 'accepted', bagType: 'checked', weightGrams: args.weightGrams, acceptedAt: new Date().toISOString(), routeSnapshot: [{ flightInstanceId: flight.id }],
      }, query: 'id',
    })
    if (paidCoupon) await sudo.query.ElectronicMiscCoupon.updateOne({ where: { id: paidCoupon.id }, data: { status: 'used', usedAt: new Date().toISOString() } })
    await sudo.query.BagEvent.createOne({ data: { carrier: { connect: { id: flight.carrierId } }, eventKey: `${bag.id}:accepted`, bag: { connect: { id: bag.id } }, eventType: 'accepted', statusSnapshot: 'accepted', occurredAt: new Date().toISOString(), source: 'system', payloadSummary: { weightGrams: args.weightGrams } }, query: 'id' })
    await writeAudit(sudo, transactionContext, { carrierId: flight.carrierId, key: claim.storageKey, action: 'bag.accept', aggregateType: 'Bag', aggregateId: bag.id, after: { status: 'accepted' }, metadata: { weightGrams: args.weightGrams, bookingSegmentId: segment.id, entitlement: paidCoupon ? 'emd' : 'included' } })
    const result = { resourceType: 'Bag', resourceId: bag.id, status: 'accepted', changed: true, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}
