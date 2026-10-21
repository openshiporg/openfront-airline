import { Prisma } from '@prisma/client'
import type { Context } from '.keystone/types'

import { requireFreshCarrierPermission, requireFreshPermission, requireStationCapability } from '../access'
import { assertLifecycleTransition } from '../lib/lifecycle'
import { runSerializableTransaction, sortUniqueIds, throwIfKeystonePrismaError } from '../lib/transactions'
import { createServiceObligationKey, validateCouponTransformation } from '../lib/coupon-lineage'
import { partitionRecoveryParty } from '../lib/recovery-party'
import { beginOperation, finishOperation, inspectOperation, normalizeIdempotencyKey, randomReference, writeAudit } from './airlineOperations'
import { calculateAvailability } from './airlineWorkflows'
import { DomainError } from '../lib/domain-error'

const disruptionTypes = new Set(['delay', 'cancellation', 'schedule_change', 'misconnection', 'diversion', 'equipment_change', 'other'])

type Result = { resourceType: string; resourceId: string; status: string; changed: boolean; replayed: boolean }

export async function publishFlightDisruption(
  _root: unknown,
  args: { flightInstanceId: string; type: string; publicSummary: string; idempotencyKey: string },
  context: Context,
): Promise<Result> {
  return runSerializableTransaction(context, async transactionContext => {
    await requireFreshPermission(transactionContext, 'canManageDisruptions')
    const sudo = transactionContext.sudo() as any
    let flight = await sudo.query.FlightInstance.findOne({ where: { id: args.flightInstanceId }, query: 'id status flightNumber carrier { id } bookingSegments { id status booking { passengers { id } } checkIns { status bookingPassenger { id } } }' })
    if (!flight) throw new DomainError('Flight not found.')
    await requireFreshCarrierPermission(transactionContext, 'canManageDisruptions', flight.carrier.id)
    if (!disruptionTypes.has(args.type)) throw new DomainError('Unsupported disruption type.')
    const summary = args.publicSummary?.trim()
    if (!summary || summary.length > 500) throw new DomainError('A public summary of at most 500 characters is required.')
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const request = { flightInstanceId: flight.id, type: args.type, publicSummary: summary }
    const inspected = await inspectOperation(sudo, flight.carrier.id, key, 'disruption.publish', request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as Result
    const lock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" = ${flight.id} FOR UPDATE`)
    throwIfKeystonePrismaError(lock)
    flight = await sudo.query.FlightInstance.findOne({ where: { id: args.flightInstanceId }, query: 'id status flightNumber carrier { id } bookingSegments { id status booking { passengers { id } } checkIns { status bookingPassenger { id } } }' })
    if (!flight) throw new DomainError('Flight changed while publishing disruption.')
    const claim = await beginOperation(sudo, transactionContext, flight.carrier.id, key, 'disruption.publish', request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as Result
    const flightTransition = args.type === 'cancellation'
      ? assertLifecycleTransition('flightInstance', flight.status, 'cancelled')
      : args.type === 'delay'
        ? assertLifecycleTransition('flightInstance', flight.status, 'delayed')
        : null
    const affected = (flight.bookingSegments ?? []).filter((segment: any) =>
      ['confirmed', 'checked_in', 'offloaded'].includes(segment.status)
      && !(segment.booking?.passengers ?? []).every((passenger: any) =>
        (segment.checkIns ?? []).some((checkIn: any) => checkIn.bookingPassenger?.id === passenger.id && checkIn.status === 'boarded'),
      ),
    )
    const now = new Date().toISOString()
    const disruption = await sudo.query.Disruption.createOne({
      data: {
        carrier: { connect: { id: flight.carrier.id } }, disruptionKey: `DSP-${randomReference('', 12)}`,
        flightInstance: { connect: { id: flight.id } }, type: args.type, severity: args.type === 'cancellation' ? 'high' : 'medium',
        status: 'published', publicSummary: summary, detectedAt: now, publishedAt: now,
        affectedSegments: { connect: affected.map((segment: any) => ({ id: segment.id })) },
        impactSnapshot: { affectedSegmentCount: affected.length, flightNumber: flight.flightNumber },
      }, query: 'id',
    })
    for (const segment of affected) await sudo.query.BookingSegment.updateOne({ where: { id: segment.id }, data: { status: 'disrupted' } })
    if (flightTransition?.changed) await sudo.query.FlightInstance.updateOne({ where: { id: flight.id }, data: { status: args.type === 'cancellation' ? 'cancelled' : 'delayed' } })
    await writeAudit(sudo, transactionContext, { carrierId: flight.carrier.id, key: claim.storageKey, action: 'disruption.publish', aggregateType: 'Disruption', aggregateId: disruption.id, after: { status: 'published', type: args.type }, metadata: { flightInstanceId: flight.id, affectedSegmentCount: affected.length } })
    const result = { resourceType: 'Disruption', resourceId: disruption.id, status: 'published', changed: true, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}

export async function reaccommodateBooking(
  _root: unknown,
  args: { disruptionId: string; bookingId: string; replacementFlightInstanceId: string; replacementInventoryBucketId: string; idempotencyKey: string },
  context: Context,
): Promise<Result> {
  return runSerializableTransaction(context, async transactionContext => {
    await requireFreshPermission(transactionContext, 'canManageDisruptions')
    const sudo = transactionContext.sudo() as any
    let disruption = await sudo.query.Disruption.findOne({ where: { id: args.disruptionId }, query: 'id status carrier { id } flightInstance { id status origin { id } } affectedSegments { id booking { id } journey { id } inventoryBucket { id sold } sourceOfferItem { inventoryBucket { id sold } } status sequence includedBaggageSnapshot origin { id } destination { id } originCode destinationCode cabinCode bookingClassCode fareBrandCode fareBasisCode }' })
    if (!disruption) throw new DomainError('Disruption is not available for recovery.')
    const carrierId = disruption.carrier.id
    await requireFreshCarrierPermission(transactionContext, 'canManageDisruptions', carrierId)
    let original = disruption.affectedSegments.find((segment: any) => segment.booking.id === args.bookingId)
    let booking = await sudo.query.Booking.findOne({ where: { id: args.bookingId }, query: 'id status paymentStatus ticketingStatus currencyCode carrier { id code } passengers { id passenger { id } } tickets { id status bookingPassenger { id } coupons { id status bookingSegment { id } serviceObligation { id currentVersion status } serviceObligationVersion } }' })
    if (!booking || booking.carrier.id !== carrierId) throw new DomainError('Booking is not available for this carrier.')
    const key = normalizeIdempotencyKey(args.idempotencyKey)
    const request = { disruptionId: args.disruptionId, bookingId: args.bookingId, replacementFlightInstanceId: args.replacementFlightInstanceId, replacementInventoryBucketId: args.replacementInventoryBucketId }
    const inspected = await inspectOperation(sudo, carrierId, key, 'reaccommodation.confirm', request)
    if (inspected.replay) return { ...(inspected.replay.result ?? {}), replayed: true } as Result
    if (!['published', 'recovering'].includes(disruption.status)) throw new DomainError('Disruption is not open for recovery.')
    if (!original || original.status !== 'disrupted') throw new DomainError('Booking has no recoverable segment in this disruption.')
    let replacement = await sudo.query.FlightInstance.findOne({ where: { id: args.replacementFlightInstanceId }, query: 'id status flightNumber scheduledDepartureAt scheduledArrivalAt carrier { id code } operatingCarrier { code } origin { id iataCode } destination { id iataCode }' })
    let bucket = await sudo.query.InventoryBucket.findOne({ where: { id: args.replacementInventoryBucketId }, query: 'id status authorized sold held blocked bookingClassCode carrier { id } flightInstance { id } cabin { code } fareBrand { code }' })
    if (!replacement || !bucket || replacement.carrier.id !== carrierId || bucket.carrier.id !== carrierId || bucket.flightInstance.id !== replacement.id) throw new DomainError('Replacement service must belong to the booking carrier.')
    if (replacement.id === disruption.flightInstance?.id) throw new DomainError('Replacement service must differ from the disrupted flight.')
    if (!['scheduled', 'open_for_sale', 'delayed'].includes(replacement.status) || bucket.status !== 'open' || new Date(replacement.scheduledDepartureAt) <= new Date()) throw new DomainError('Replacement inventory is not available for a future service.')
    if (replacement.origin.iataCode !== original.originCode || replacement.destination.iataCode !== original.destinationCode) throw new DomainError('Replacement service must preserve the disrupted origin and destination.')
    let quantity = 0
    let originalBucket = original.inventoryBucket ?? original.sourceOfferItem?.inventoryBucket
    if (!originalBucket?.id) throw new DomainError('The disrupted segment has no accountable inventory bucket.')
    const bookingLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id} FOR UPDATE`)
    throwIfKeystonePrismaError(bookingLock)
    const serviceFlightIds = sortUniqueIds([disruption.flightInstance?.id ?? '', replacement.id])
    const flightLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" IN (${Prisma.join(serviceFlightIds)}) ORDER BY "id" FOR UPDATE`)
    throwIfKeystonePrismaError(flightLock)
    disruption = await sudo.query.Disruption.findOne({ where: { id: args.disruptionId }, query: 'id status carrier { id } flightInstance { id status origin { id } } affectedSegments { id booking { id } journey { id } inventoryBucket { id sold } sourceOfferItem { inventoryBucket { id sold } } status sequence includedBaggageSnapshot origin { id } destination { id } originCode destinationCode cabinCode bookingClassCode fareBrandCode fareBasisCode }' })
    booking = await sudo.query.Booking.findOne({ where: { id: args.bookingId }, query: 'id status paymentStatus ticketingStatus currencyCode carrier { id code } passengers { id passenger { id } } tickets { id status bookingPassenger { id } coupons { id status bookingSegment { id } serviceObligation { id currentVersion status } serviceObligationVersion } }' })
    replacement = await sudo.query.FlightInstance.findOne({ where: { id: args.replacementFlightInstanceId }, query: 'id status flightNumber scheduledDepartureAt scheduledArrivalAt carrier { id code } operatingCarrier { code } origin { id iataCode } destination { id iataCode }' })
    bucket = await sudo.query.InventoryBucket.findOne({ where: { id: args.replacementInventoryBucketId }, query: 'id status authorized sold held blocked bookingClassCode carrier { id } flightInstance { id } cabin { code } fareBrand { code }' })
    const lockedInspection = await inspectOperation(sudo, carrierId, key, 'reaccommodation.confirm', request)
    if (lockedInspection.replay) return { ...(lockedInspection.replay.result ?? {}), replayed: true } as Result
    if (!disruption || !['published', 'recovering'].includes(disruption.status) || disruption.carrier.id !== carrierId) throw new DomainError('Disruption changed while preparing recovery.')
    original = disruption.affectedSegments.find((segment: any) => segment.booking.id === args.bookingId)
    if (!original || original.status !== 'disrupted' || !booking || ['cancelled', 'completed'].includes(booking.status) || booking.paymentStatus === 'refunded' || booking.ticketingStatus === 'voided' || !replacement || !bucket || booking.carrier.id !== carrierId || replacement.carrier.id !== carrierId || bucket.carrier.id !== carrierId || bucket.flightInstance.id !== replacement.id) throw new DomainError('Recovery resources changed while acquiring locks.')
    if (replacement.id === disruption.flightInstance?.id || !['scheduled', 'open_for_sale', 'delayed'].includes(replacement.status) || bucket.status !== 'open' || new Date(replacement.scheduledDepartureAt) <= new Date()) throw new DomainError('Replacement service is no longer available.')
    if (replacement.origin.iataCode !== original.originCode || replacement.destination.iataCode !== original.destinationCode) throw new DomainError('Replacement service must preserve the disrupted origin and destination.')
    if (!disruption.flightInstance?.id || ['departed', 'arrived'].includes(disruption.flightInstance.status)) throw new DomainError('Recovery is unavailable after the original service has departed or arrived.')

    const tx = transactionContext.prisma as any
    const allBookingPassengerIds = sortUniqueIds((booking.passengers ?? []).map((passenger: any) => passenger.id))
    const originalCoupons = (booking.tickets ?? []).flatMap((ticket: any) => (ticket.coupons ?? [])
      .filter((coupon: any) => coupon.bookingSegment?.id === original.id)
      .map((coupon: any) => ({ ...coupon, ticketStatus: ticket.status, bookingPassengerId: ticket.bookingPassenger?.id })))
    const allCheckIns = await tx.checkIn.findMany({
      where: { bookingSegmentId: original.id, bookingPassengerId: { in: allBookingPassengerIds } },
      select: { id: true, status: true, bookingPassengerId: true, passengerId: true, seatAssignmentId: true, ticketCouponId: true, boardingPasses: { select: { id: true, status: true } } },
    })
    const ticketedBooking = booking.ticketingStatus === 'ticketed'
    const party = partitionRecoveryParty((booking.passengers ?? []).map((passenger: any) => {
      const passengerCoupons = originalCoupons.filter((coupon: any) => coupon.bookingPassengerId === passenger.id)
      const activeTickets = (booking.tickets ?? []).filter((ticket: any) => ticket.bookingPassenger?.id === passenger.id && ['issued', 'partially_used', 'suspended'].includes(ticket.status))
      const recoverableCouponCount = passengerCoupons.filter((coupon: any) =>
        ['issued', 'partially_used', 'suspended'].includes(coupon.ticketStatus) && ['open', 'checked_in', 'suspended'].includes(coupon.status),
      ).length
      const checkIns = allCheckIns.filter((checkIn: any) => checkIn.bookingPassengerId === passenger.id)
      return {
        bookingPassengerId: passenger.id,
        hasTicket: (booking.tickets ?? []).some((ticket: any) => ticket.bookingPassenger?.id === passenger.id),
        activeTicket: activeTickets.length > 0,
        couponStatuses: passengerCoupons.map((coupon: any) => coupon.status),
        recoverableCouponCount,
        checkInStatuses: checkIns.map((checkIn: any) => checkIn.status),
        boardingPassStatuses: checkIns.flatMap((checkIn: any) => (checkIn.boardingPasses ?? []).map((pass: any) => pass.status)),
      }
    }), ticketedBooking)
    const eligiblePassengerIds = sortUniqueIds(party.eligiblePassengerIds)
    quantity = eligiblePassengerIds.length
    const eligiblePassengerIdSet = new Set(eligiblePassengerIds)
    const eligiblePassengers = (booking.passengers ?? []).filter((passenger: any) => eligiblePassengerIdSet.has(passenger.id))
    const eligibleTravelerIds = sortUniqueIds(eligiblePassengers.map((passenger: any) => passenger.passenger?.id ?? ''))
    if (eligibleTravelerIds.length !== eligiblePassengers.length) throw new DomainError('Duplicate passenger identities in a mixed booking require explicit reconciliation before recovery.')
    const eligibleCheckIns = allCheckIns.filter((checkIn: any) => eligiblePassengerIdSet.has(checkIn.bookingPassengerId))
    const eligiblePasses = await tx.boardingPass.findMany({
      where: { bookingSegmentId: original.id, passengerId: { in: eligibleTravelerIds } },
      select: { id: true, status: true, checkInId: true, passengerId: true, checkIn: { select: { bookingPassengerId: true, passengerId: true } } },
    })
    const eligibleSeats = await tx.seatAssignment.findMany({
      where: { bookingSegmentId: original.id, bookingPassengerId: { in: eligiblePassengerIds } },
      select: { id: true, status: true, amount: true, occupancyKey: true, bookingPassengerId: true },
    })
    const eligibleBags = await tx.bag.findMany({
      where: {
        bookingPassengerId: { in: eligiblePassengerIds },
        OR: [{ bookingSegmentId: original.id }, { segments: { some: { id: original.id } } }],
      },
      select: { id: true, bagKey: true, status: true, bookingPassengerId: true },
    })
    const eligibleVerifications = await tx.documentVerification.findMany({
      where: { bookingSegmentId: original.id, passengerId: { in: eligibleTravelerIds }, status: 'verified' },
      select: { id: true, status: true, passengerId: true },
    })
    const eligibleAncillaryCoupons = await tx.electronicMiscCoupon.findMany({
      where: { bookingSegmentId: original.id, status: { in: ['open', 'used'] }, document: { bookingPassengerId: { in: eligiblePassengerIds } } },
      select: { id: true, amount: true, currencyCode: true },
    })

    const lockArtifactRows = async (table: string, ids: string[]) => {
      const uniqueIds = sortUniqueIds(ids)
      if (!uniqueIds.length) return
      const lock = await tx.$queryRaw(Prisma.sql`SELECT "id" FROM ${Prisma.raw(table)} WHERE "id" IN (${Prisma.join(uniqueIds)}) ORDER BY "id" FOR UPDATE`)
      throwIfKeystonePrismaError(lock)
    }
    await Promise.all([
      lockArtifactRows('"TicketCoupon"', originalCoupons.filter((entry: any) => eligiblePassengerIdSet.has(entry.bookingPassengerId)).map((entry: any) => entry.id)),
      lockArtifactRows('"CheckIn"', eligibleCheckIns.map((entry: any) => entry.id)),
      lockArtifactRows('"BoardingPass"', eligiblePasses.map((entry: any) => entry.id)),
      lockArtifactRows('"SeatAssignment"', eligibleSeats.map((entry: any) => entry.id)),
      lockArtifactRows('"Bag"', eligibleBags.map((entry: any) => entry.id)),
      lockArtifactRows('"DocumentVerification"', eligibleVerifications.map((entry: any) => entry.id)),
      lockArtifactRows('"ElectronicMiscCoupon"', eligibleAncillaryCoupons.map((entry: any) => entry.id)),
    ])

    const unsupportedCheckIns = eligibleCheckIns.filter((entry: any) => !['cancelled', 'checked_in', 'offloaded'].includes(entry.status))
    const activePasses = eligiblePasses.filter((entry: any) => ['issued', 'reissued'].includes(entry.status))
    const unsafePasses = eligiblePasses.filter((pass: any) => pass.status === 'boarded'
      || (['issued', 'reissued'].includes(pass.status)
        && !eligibleCheckIns.some((checkIn: any) => checkIn.id === pass.checkInId && checkIn.status === 'checked_in'
          && checkIn.bookingPassengerId === pass.checkIn?.bookingPassengerId && checkIn.passengerId === pass.passengerId)))
    const activePassesPerCheckIn: Record<string, number> = activePasses.reduce((counts: Record<string, number>, pass: any) => {
      counts[pass.checkInId] = (counts[pass.checkInId] ?? 0) + 1
      return counts
    }, {})
    const duplicateActivePasses = Object.values(activePassesPerCheckIn).filter(count => count > 1).length
    const activeSeats = eligibleSeats.filter((entry: any) => ['held', 'assigned', 'confirmed', 'boarded'].includes(entry.status))
    const invalidSeats = activeSeats.filter((seat: any) => seat.status !== 'confirmed' || seat.amount !== 0
      || !eligibleCheckIns.some((checkIn: any) => checkIn.seatAssignmentId === seat.id && ['checked_in', 'offloaded'].includes(checkIn.status)))
    const missingCheckInSeats = eligibleCheckIns.filter((checkIn: any) => ['checked_in', 'offloaded'].includes(checkIn.status)
      && !eligibleSeats.some((seat: any) => seat.id === checkIn.seatAssignmentId && seat.status === 'confirmed' && seat.amount === 0))
    const activeOperationalArtifacts = {
      unsupportedCheckIns: unsupportedCheckIns.length,
      unsafeBoardingPasses: unsafePasses.length + duplicateActivePasses,
      nonFreeOrUnlinkedSeats: invalidSeats.length + missingCheckInSeats.length,
      bagsRequiringPhysicalDisposition: eligibleBags.length,
      ancillaryCouponsRequiringReconciliation: eligibleAncillaryCoupons.length,
    }
    if (Object.values(activeOperationalArtifacts).some(count => count > 0)) {
      throw new DomainError(`Recovery is blocked until unboarded traveler artifacts have an authorized disposition; active artifacts: ${JSON.stringify(activeOperationalArtifacts)}.`)
    }
    if (eligibleVerifications.length) {
      await requireFreshCarrierPermission(transactionContext, 'canManageSecurePassengerData', carrierId)
      await requireStationCapability(transactionContext, 'canManageSecurePassengerData', carrierId, disruption.flightInstance.origin.id, 'canCheckIn')
    }
    if (eligibleCheckIns.some((entry: any) => ['checked_in', 'offloaded'].includes(entry.status)) || activePasses.length || activeSeats.length) {
      await requireStationCapability(transactionContext, 'canManageAirportService', carrierId, disruption.flightInstance.origin.id, 'canCheckIn')
    }

    originalBucket = original.inventoryBucket ?? original.sourceOfferItem?.inventoryBucket
    if (!originalBucket?.id) throw new DomainError('The disrupted segment no longer has accountable inventory.')
    const bucketIds = [...new Set([originalBucket.id, bucket.id])].sort()
    const bucketLocks = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "InventoryBucket" WHERE "id" IN (${Prisma.join(bucketIds)}) ORDER BY "id" FOR UPDATE`)
    throwIfKeystonePrismaError(bucketLocks)
    const releaseExpired = await transactionContext.prisma.$executeRaw(Prisma.sql`
      WITH expired AS (
        UPDATE "InventoryHold" SET "status" = 'expired', "updatedAt" = NOW()
        WHERE "inventoryBucket" IN (${Prisma.join(bucketIds)}) AND "status" = 'active' AND "expiresAt" <= NOW()
        RETURNING "inventoryBucket", "quantity"
      ), totals AS (
        SELECT "inventoryBucket", SUM("quantity")::integer AS quantity FROM expired GROUP BY "inventoryBucket"
      )
      UPDATE "InventoryBucket" target SET "held" = GREATEST(0, target."held" - totals.quantity), "updatedAt" = NOW()
      FROM totals WHERE target."id" = totals."inventoryBucket"
    `)
    throwIfKeystonePrismaError(releaseExpired)
    const lockedBuckets = await (transactionContext.prisma as any).inventoryBucket.findMany({ where: { id: { in: bucketIds } } })
    const lockedReplacement = lockedBuckets.find((entry: any) => entry.id === bucket.id)
    const lockedOriginal = lockedBuckets.find((entry: any) => entry.id === originalBucket.id)
    if (!lockedReplacement || !lockedOriginal || (originalBucket.id !== bucket.id && calculateAvailability(lockedReplacement).available < quantity)) throw new DomainError('Replacement inventory is insufficient.')
    const claim = await beginOperation(sudo, transactionContext, disruption.carrier.id, key, 'reaccommodation.confirm', request)
    if (claim.replay) return { ...(claim.replay.result ?? {}), replayed: true } as Result
    const nowDate = new Date()
    const now = nowDate.toISOString()
    const unwind = {
      checkInIds: [] as string[],
      boardingPassIds: [] as string[],
      seatAssignmentIds: [] as string[],
      documentVerificationIds: [] as string[],
    }
    for (const checkIn of eligibleCheckIns) {
      if (!['checked_in', 'offloaded'].includes(checkIn.status)) continue
      assertLifecycleTransition('checkIn', checkIn.status, 'cancelled')
      await tx.checkIn.update({ where: { id: checkIn.id }, data: { status: 'cancelled' } })
      unwind.checkInIds.push(checkIn.id)
    }
    for (const pass of activePasses) {
      assertLifecycleTransition('boardingPass', pass.status, 'revoked')
      await tx.boardingPass.update({ where: { id: pass.id }, data: { status: 'revoked', revokedAt: nowDate } })
      unwind.boardingPassIds.push(pass.id)
    }
    for (const seat of activeSeats) {
      assertLifecycleTransition('seatAssignment', seat.status, 'released')
      await tx.seatAssignment.update({ where: { id: seat.id }, data: { status: 'released', occupancyKey: null, releasedAt: nowDate } })
      unwind.seatAssignmentIds.push(seat.id)
    }
    for (const verification of eligibleVerifications) {
      await tx.documentVerification.update({ where: { id: verification.id }, data: { status: 'revoked', revokedAt: nowDate } })
      unwind.documentVerificationIds.push(verification.id)
    }
    const replacementSegment = await sudo.query.BookingSegment.createOne({
      data: {
        carrier: { connect: { id: disruption.carrier.id } }, booking: { connect: { id: booking.id } }, journey: { connect: { id: original.journey.id } }, flightInstance: { connect: { id: replacement.id } }, inventoryBucket: { connect: { id: bucket.id } },
        segmentKey: `${booking.id}:R:${randomReference('', 8)}`, sequence: original.sequence, status: 'confirmed',
        origin: { connect: { id: replacement.origin.id } }, destination: { connect: { id: replacement.destination.id } }, originCode: replacement.origin.iataCode, destinationCode: replacement.destination.iataCode,
        marketingCarrierCode: replacement.carrier.code, operatingCarrierCode: replacement.operatingCarrier?.code ?? replacement.carrier.code, marketingFlightNumber: replacement.flightNumber,
        scheduledDepartureAt: replacement.scheduledDepartureAt, scheduledArrivalAt: replacement.scheduledArrivalAt,
        cabinCode: bucket.cabin?.code ?? original.cabinCode, bookingClassCode: bucket.bookingClassCode, fareBrandCode: bucket.fareBrand?.code ?? original.fareBrandCode, fareBasisCode: bucket.fareBrand?.code ?? original.fareBasisCode,
        itinerarySnapshot: { reason: 'involuntary_reaccommodation', originalSegmentId: original.id, disruptionId: disruption.id }, includedBaggageSnapshot: original.includedBaggageSnapshot ?? {},
      }, query: 'id',
    })
    if (originalBucket.id !== bucket.id) {
      const debited = await (transactionContext.prisma as any).inventoryBucket.updateMany({
        where: { id: bucket.id, sold: { lte: lockedReplacement.authorized - lockedReplacement.held - lockedReplacement.blocked - quantity } },
        data: { sold: { increment: quantity } },
      })
      if (debited.count !== 1) throw new DomainError('Replacement inventory is insufficient.')
      if (lockedOriginal.sold < quantity) throw new DomainError('Original inventory accounting is inconsistent.')
      await (transactionContext.prisma as any).inventoryBucket.update({ where: { id: originalBucket.id }, data: { sold: { decrement: quantity } } })
    }
    const record = await sudo.query.Reaccommodation.createOne({
      data: {
        carrier: { connect: { id: disruption.carrier.id } }, reaccommodationKey: `REA-${randomReference('', 12)}`, idempotencyKey: claim.storageKey,
        booking: { connect: { id: booking.id } }, disruption: { connect: { id: disruption.id } }, status: 'confirmed',
        originalSegments: { connect: [{ id: original.id }] }, replacementSegments: { connect: [{ id: replacementSegment.id }] },
        priceDifferenceAmount: 0, additionalCollectionAmount: 0, refundAmount: 0, currencyCode: booking.currencyCode,
        optionExpiresAt: now, acceptedAt: now, confirmedAt: now, reason: 'involuntary',
        optionSnapshot: {
          replacementFlightInstanceId: replacement.id, replacementInventoryBucketId: bucket.id,
          eligibleBookingPassengerIds: eligiblePassengerIds, boardedOrFlownPassengerIds: party.boardedOrFlownPassengerIds,
          unwind,
        },
      }, query: 'id',
    })
    const recoveredPassengerIds = new Set<string>()
    for (const ticket of (booking.tickets ?? []).filter((entry: any) => eligiblePassengerIdSet.has(entry.bookingPassenger?.id))) {
      const oldCoupon = ticket.coupons?.find((coupon: any) => coupon.bookingSegment?.id === original.id && ['open', 'checked_in', 'suspended'].includes(coupon.status))
      if (!oldCoupon) continue
      const obligation = oldCoupon.serviceObligation
      if (!obligation || obligation.status !== 'active' || oldCoupon.serviceObligationVersion !== obligation.currentVersion) throw new DomainError('The original coupon has no current versioned service obligation; reconcile before reaccommodation.')
      const obligationLock = await transactionContext.prisma.$queryRaw(Prisma.sql`SELECT "id" FROM "ServiceObligation" WHERE "id" = ${obligation.id} FOR UPDATE`)
      throwIfKeystonePrismaError(obligationLock)
      const lockedObligation = await (transactionContext.prisma as any).serviceObligation.findUnique({ where: { id: obligation.id } })
      if (!lockedObligation || lockedObligation.status !== 'active' || lockedObligation.currentVersion !== oldCoupon.serviceObligationVersion) throw new DomainError('The original service obligation changed while preparing reaccommodation.')
      await sudo.query.TicketCoupon.updateOne({ where: { id: oldCoupon.id }, data: { status: 'exchanged' } })
      const nextVersion = lockedObligation.currentVersion + 1
      const versionedObligation = await sudo.query.ServiceObligation.updateOne({ where: { id: obligation.id }, data: { currentVersion: nextVersion }, query: 'id currentVersion' })
      throwIfKeystonePrismaError(versionedObligation)
      const remainingSpendableCoupon = (ticket.coupons ?? []).some((coupon: any) => coupon.id !== oldCoupon.id && ['open', 'checked_in'].includes(coupon.status))
      if (!remainingSpendableCoupon) await sudo.query.Ticket.updateOne({ where: { id: ticket.id }, data: { status: 'exchanged' } })
      const newTicket = await sudo.query.Ticket.createOne({ data: { carrier: { connect: { id: disruption.carrier.id } }, ticketNumber: `${booking.carrier.code}-${randomReference('', 12)}`, booking: { connect: { id: booking.id } }, bookingPassenger: { connect: { id: ticket.bookingPassenger.id } }, passenger: { connect: { id: booking.passengers.find((entry: any) => entry.id === ticket.bookingPassenger.id)?.passenger.id } }, issuingCarrierCode: booking.carrier.code, validatingCarrierCode: booking.carrier.code, status: 'issued', totalAmount: 0, currencyCode: booking.currencyCode, issuedAt: now, originalTicket: { connect: { id: ticket.id } }, providerReference: `internal:${record.id}`, metadata: { reason: 'involuntary_reaccommodation' } }, query: 'id' })
      const newCoupon = await sudo.query.TicketCoupon.createOne({ data: { carrier: { connect: { id: disruption.carrier.id } }, couponKey: `${newTicket.id}:${replacementSegment.id}`, ticket: { connect: { id: newTicket.id } }, bookingSegment: { connect: { id: replacementSegment.id } }, serviceObligation: { connect: { id: obligation.id } }, serviceObligationVersion: nextVersion, couponNumber: original.sequence, status: 'open', fareBasisCode: bucket.fareBrand?.code ?? original.fareBasisCode, bookingClassCode: bucket.bookingClassCode, amount: 0, currencyCode: booking.currencyCode, entitlementSnapshot: { replacedCouponId: oldCoupon.id } }, query: 'id' })
      validateCouponTransformation('alternative',
        [{ id: oldCoupon.id, serviceObligationId: obligation.id, serviceObligationVersion: oldCoupon.serviceObligationVersion, status: 'exchanged', bookingPassengerId: ticket.bookingPassenger.id }],
        [{ id: newCoupon.id, serviceObligationId: obligation.id, serviceObligationVersion: nextVersion, status: 'open', bookingPassengerId: ticket.bookingPassenger.id }],
      )
      await sudo.query.TicketCouponLineage.createOne({ data: { carrier: { connect: { id: disruption.carrier.id } }, bookingPassenger: { connect: { id: ticket.bookingPassenger.id } }, lineageKey: `${record.id}:alternative:${oldCoupon.id}:${newCoupon.id}`, changeSetKey: `${record.id}:${ticket.bookingPassenger.id}:${oldCoupon.id}`, transformation: 'alternative', operationType: 'reaccommodation', operationId: record.id, parentCoupon: { connect: { id: oldCoupon.id } }, childCoupon: { connect: { id: newCoupon.id } }, metadata: { originalSegmentId: original.id, replacementSegmentId: replacementSegment.id } }, query: 'id' })
      recoveredPassengerIds.add(ticket.bookingPassenger.id)
    }
    if (eligiblePassengerIds.some(id => !recoveredPassengerIds.has(id))) throw new DomainError('A selected passenger coupon changed before the atomic recovery could complete.')
    const originalRetainsBoardedOrFlownTravelers = party.boardedOrFlownPassengerIds.length > 0
    if (!originalRetainsBoardedOrFlownTravelers) {
      await sudo.query.BookingSegment.updateOne({ where: { id: original.id }, data: { status: 'reaccommodated' } })
    }
    await writeAudit(sudo, transactionContext, {
      carrierId: disruption.carrier.id, key: claim.storageKey, action: 'reaccommodation.confirm', aggregateType: 'Reaccommodation', aggregateId: record.id,
      before: { segmentId: original.id, status: 'disrupted' },
      after: { replacementSegmentId: replacementSegment.id, status: 'confirmed', originalSegmentStatus: originalRetainsBoardedOrFlownTravelers ? 'disrupted' : 'reaccommodated' },
      metadata: {
        bookingId: booking.id, disruptionId: disruption.id, eligiblePassengerCount: eligiblePassengerIds.length,
        boardedOrFlownPassengerCount: party.boardedOrFlownPassengerIds.length,
        unwoundCheckInCount: unwind.checkInIds.length, revokedBoardingPassCount: unwind.boardingPassIds.length,
        releasedSeatAssignmentCount: unwind.seatAssignmentIds.length, revokedDocumentVerificationCount: unwind.documentVerificationIds.length,
      },
    })
    const result = { resourceType: 'Reaccommodation', resourceId: record.id, status: 'confirmed', changed: true, replayed: false }
    await finishOperation(sudo, claim.record.id, result)
    return result
  })
}
