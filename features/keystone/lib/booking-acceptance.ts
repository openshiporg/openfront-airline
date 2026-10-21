import crypto from 'node:crypto'
import { allocationFromAcceptedSnapshot, frozenAcceptanceVersion, supportedPassengerServiceAllocation } from './passenger-service-allocation'

/** Canonical, versioned identities; never return identity digests to the client. */
export function bookingAcceptanceDigest(value: unknown): string {
  const canonical = (entry: any): any => entry instanceof Date ? entry.toISOString()
    : Array.isArray(entry) ? entry.map(canonical)
      : entry && typeof entry === 'object' ? Object.fromEntries(Object.entries(entry)
        .filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)])) : entry
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}

export function normalizedBookingPassengerIds(ids: string[]) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 9 || ids.some(id => typeof id !== 'string' || !id.trim())) throw new Error('One to nine unique passenger IDs are required.')
  const normalized = ids.map(id => id.trim()).sort()
  if (new Set(normalized).size !== normalized.length) throw new Error('One to nine unique passenger IDs are required.')
  return normalized
}

export const BOOKING_ACCEPTANCE_OFFER_QUERY = `
  id offerNumber idempotencyKey shoppingSessionId source status expiresAt baseAmount taxAmount feeAmount discountAmount totalAmount currencyCode
  carrier { id code } customer { id carrier { id } } approvedAgent { id carrier { id } }
  passengers { id }
  items {
    id itemKey itemType description quantity unitAmount baseAmount taxAmount feeAmount totalAmount currencyCode
    productSnapshot segmentSnapshot passengerReferences carrier { id }
    fareBrand { id } fareRule { id } ancillaryProduct { id carrier { id } }
    inventoryBucket { id carrier { id } flightInstance { id } cabin { id code } }
    flightInstance { id status flightNumber scheduledDepartureAt scheduledArrivalAt origin { id iataCode } destination { id iataCode } carrier { id code } operatingCarrier { id code } }
  }
  inventoryHolds {
    id holdKey status quantity expiresAt carrier { id }
    inventoryBucket { id held sold blocked authorized capacity carrier { id } }
  }
`
export const BOOKING_ACCEPTANCE_PASSENGER_QUERY = 'id passengerKey title givenName middleNames familyName suffix dateOfBirth nationalityCode email phone loyaltyPrograms updatedAt carrier { id }'

/** Snapshot only facts used by conversion, not mutable service/hold status. */
export function acceptedBookingSnapshot(offer: any, passengers: any[], version: 1 | 2 = 2) {
  const identityFields = ['id', 'passengerKey', 'title', 'givenName', 'middleNames', 'familyName', 'suffix', 'dateOfBirth', 'nationalityCode', 'email', 'phone', 'loyaltyPrograms', 'updatedAt']
  return {
    version,
    serviceAllocation: version === 2 ? supportedPassengerServiceAllocation(offer, passengers.map(passenger => passenger.id)) : undefined,
    offerId: offer.id,
    offerNumber: offer.offerNumber,
    carrierId: offer.carrier.id,
    source: offer.source,
    expiresAt: new Date(offer.expiresAt).toISOString(),
    economics: Object.fromEntries(['baseAmount', 'taxAmount', 'feeAmount', 'discountAmount', 'totalAmount', 'currencyCode'].map(key => [key, offer[key]])),
    configuration: { carrierCode: offer.carrier.code, currencyCode: offer.currencyCode, salesSource: offer.source, conversionContract: version === 2 ? 'airline-held-offer-v2' : 'airline-held-offer-v1', paymentContract: 'separate-settlement-v1', documentContract: 'internal-record-not-external-issuance-v1' },
    passengers: passengers.map(passenger => ({ id: passenger.id, identityDigest: bookingAcceptanceDigest(Object.fromEntries(identityFields.map(key => [key, passenger[key]]))) })).sort((a, b) => a.id.localeCompare(b.id)),
    items: offer.items.map((item: any) => ({
      id: item.id, itemKey: item.itemKey, itemType: item.itemType, description: item.description,
      quantity: item.quantity, unitAmount: item.unitAmount, baseAmount: item.baseAmount, taxAmount: item.taxAmount,
      feeAmount: item.feeAmount, totalAmount: item.totalAmount, currencyCode: item.currencyCode,
      inventoryBucketId: item.inventoryBucket?.id ?? null, fareBrandId: item.fareBrand?.id ?? null, fareRuleId: item.fareRule?.id ?? null,
      ancillaryProductId: item.ancillaryProduct?.id ?? null, passengerReferences: item.passengerReferences ?? null,
      productSnapshot: item.productSnapshot, segmentSnapshot: item.segmentSnapshot,
      flight: item.flightInstance ? {
        id: item.flightInstance.id, carrierId: item.flightInstance.carrier.id,
        operatingCarrierCode: item.flightInstance.operatingCarrier?.code ?? item.flightInstance.carrier.code,
        flightNumber: item.flightInstance.flightNumber, originId: item.flightInstance.origin.id, destinationId: item.flightInstance.destination.id,
        originCode: item.flightInstance.origin.iataCode, destinationCode: item.flightInstance.destination.iataCode,
        scheduledDepartureAt: item.flightInstance.scheduledDepartureAt, scheduledArrivalAt: item.flightInstance.scheduledArrivalAt,
      } : null,
    })).sort((a: any, b: any) => a.id.localeCompare(b.id)),
    holds: offer.inventoryHolds.map((hold: any) => ({ id: hold.id, bucketId: hold.inventoryBucket.id, quantity: hold.quantity, expiresAt: hold.expiresAt })).sort((a: any, b: any) => a.id.localeCompare(b.id)),
  }
}

/** Exact allocation, one aggregate update per bucket; no GREATEST/clamping. */
export function bookingInventoryConversionPlan(offer: any, passengerCount: number, acceptanceVersion: 1 | 2 = 2) {
  const allocation = supportedPassengerServiceAllocation(offer, (offer.passengers ?? []).map((passenger: { id: string }) => passenger.id), acceptanceVersion)
  if (allocation.passengerIds.length !== passengerCount) throw new Error('Conversion passenger count differs from the original party.')
  const totals = new Map<string, { id: string; quantity: number; held: number; sold: number; blocked: number; authorized: number; capacity: number }>()
  const priced = new Map<string, number>()
  for (const item of offer.items.filter((entry: any) => entry.itemType === 'flight')) {
    if (!item.flightInstance || !item.inventoryBucket || item.quantity !== passengerCount
      || item.inventoryBucket.flightInstance?.id !== item.flightInstance.id) throw new Error('Flight quantity or bucket binding does not match the accepted passenger itinerary.')
    priced.set(item.inventoryBucket.id, (priced.get(item.inventoryBucket.id) ?? 0) + item.quantity)
  }
  if (!priced.size) throw new Error('Booking requires an explicit held flight itinerary.')
  for (const hold of offer.inventoryHolds ?? []) {
    const bucket = hold.inventoryBucket
    if (!bucket || !Number.isSafeInteger(hold.quantity) || hold.quantity <= 0) throw new Error('Invalid held inventory quantity.')
    const current = totals.get(bucket.id)
    if (current && ['held', 'sold', 'blocked', 'authorized', 'capacity'].some(key => (current as any)[key] !== bucket[key])) throw new Error('Inventory reads disagree within this conversion.')
    totals.set(bucket.id, { id: bucket.id, quantity: (current?.quantity ?? 0) + hold.quantity, held: bucket.held, sold: bucket.sold, blocked: bucket.blocked, authorized: bucket.authorized, capacity: bucket.capacity })
  }
  if (totals.size !== priced.size) throw new Error('Inventory holds do not exactly cover the priced flight itinerary.')
  for (const bucket of totals.values()) {
    if (priced.get(bucket.id) !== bucket.quantity) throw new Error('Inventory holds do not exactly cover the priced flight itinerary.')
    if (['quantity', 'held', 'sold', 'blocked', 'authorized', 'capacity'].some(key => !Number.isSafeInteger((bucket as any)[key]) || (bucket as any)[key] < 0)
      || bucket.authorized > bucket.capacity || bucket.held < bucket.quantity
      || bucket.sold + bucket.held + bucket.blocked > bucket.authorized) throw new Error('Held inventory no longer conserves authorized capacity.')
  }
  return [...totals.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export function assertHeldBookingSnapshot(held: any, current: any) {
  frozenAcceptanceVersion(held)
  if (bookingAcceptanceDigest(held) !== bookingAcceptanceDigest(current)) throw new Error('Passenger, service, fare, quantity, expiry, or accepted economics changed after the hold; reconcile the original offer.')
}

export function publicBookingReceipt(result: any, booking: any, accessState: string) {
  const accepted = result.acceptedSnapshot
  // Old records are not reinterpreted using today's catalog or invented evidence.
  const verified = result.receiptVersion === 1 && (accepted?.version === 1 || accepted?.version === 2)
    && result.acceptedDigest === bookingAcceptanceDigest(accepted)
    && accepted.carrierId === booking.carrierId && accepted.offerId === booking.sourceOfferId
  if (!verified) throw new Error('Legacy or incomplete booking receipt requires operator reconciliation; retain the original command and do not create a replacement booking.')
  if (accepted.version === 2 && bookingAcceptanceDigest(accepted.serviceAllocation) !== bookingAcceptanceDigest(allocationFromAcceptedSnapshot(accepted))) {
    throw new Error('Frozen booking service allocation is incomplete; reconcile the original receipt, not a replacement booking.')
  }
  return {
    version: 1, accessState, acceptedStatus: result.status,
    accepted: { allocationState: accepted.version === 2 ? 'supported_v1' : 'legacy_unversioned',
      serviceAllocation: accepted.version === 2 ? { version: 1, type: accepted.serviceAllocation.type, passengerCount: accepted.serviceAllocation.passengerIds.length, legCount: accepted.serviceAllocation.legs.length } : null,
      offerNumber: accepted.offerNumber, expiresAt: accepted.expiresAt, ...accepted.economics, configuration: accepted.configuration,
      items: accepted.items.map((item: any) => ({ description: item.description, quantity: item.quantity, totalAmount: item.totalAmount, currencyCode: item.currencyCode, fareName: item.productSnapshot?.name ?? null, fareCode: item.productSnapshot?.code ?? null, cabinCode: item.segmentSnapshot?.cabinCode ?? null, bookingClassCode: item.segmentSnapshot?.bookingClassCode ?? null, includedBaggage: item.segmentSnapshot?.includedBaggage ?? null, flight: item.flight })) },
    current: { status: booking.status, paymentStatus: booking.paymentStatus, ticketingStatus: booking.ticketingStatus },
  }
}
