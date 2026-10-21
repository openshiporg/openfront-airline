/** Supported conversion shape, not an extra-seat/interline/commercial policy.
 * The current converter writes one Journey and carries the entire party on
 * every leg. A broader partition needs its own reviewed, versioned writer.
 */
export const PASSENGER_SERVICE_ALLOCATION_TYPE = 'whole-party-contiguous-journey' as const

export type PassengerServiceAllocation = {
  version: 1
  type: typeof PASSENGER_SERVICE_ALLOCATION_TYPE
  passengerIds: string[]
  legs: Array<{ sequence: number; offerItemId: string; flightInstanceId: string; inventoryBucketId: string; passengerIds: string[] }>
}

export class UnsupportedPassengerServiceAllocation extends Error {
  readonly code = 'UNSUPPORTED_PASSENGER_SERVICE_ALLOCATION'
  constructor(reason: string) {
    super(`Unsupported passenger-service allocation: ${reason}. Retain the original offer/command for reconciliation; do not create a replacement key.`)
    this.name = 'UnsupportedPassengerServiceAllocation'
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new UnsupportedPassengerServiceAllocation('missing explicit itinerary identity')
  return value as Record<string, unknown>
}

function id(value: unknown): string {
  if (typeof value !== 'string' || !value || value.trim() !== value) throw new UnsupportedPassengerServiceAllocation('missing or noncanonical service identity')
  return value
}

function ids(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length) throw new UnsupportedPassengerServiceAllocation('missing explicit passenger allocation')
  const result = (value as unknown[]).map(id).sort()
  if (new Set(result).size !== result.length) throw new UnsupportedPassengerServiceAllocation('duplicate passenger allocation')
  return result
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function date(value: unknown): number {
  if (typeof value !== 'string' && !(value instanceof Date)) throw new UnsupportedPassengerServiceAllocation('missing dated-service identity')
  const parsed = new Date(value).getTime()
  if (!Number.isFinite(parsed)) throw new UnsupportedPassengerServiceAllocation('invalid dated-service identity')
  return parsed
}

/** Called before a new hold claim and before conversion (including v1 holds).
 * Bucket/value conservation is checked separately: four conserved seats are
 * not proof of two valid services for the same two passengers on one flight.
 */
export function supportedPassengerServiceAllocation(value: unknown, passengerIds: readonly string[], acceptanceVersion: 1 | 2 = 2): PassengerServiceAllocation {
  const offer = record(value)
  const carrierId = id(record(offer.carrier).id)
  const party = ids(passengerIds)
  if (!Array.isArray(offer.passengers)) throw new UnsupportedPassengerServiceAllocation('missing explicit offer party')
  if (!sameIds(ids((offer.passengers as unknown[]).map(entry => record(entry).id)), party)) {
    throw new UnsupportedPassengerServiceAllocation('offer party differs from command')
  }
  if (!Array.isArray(offer.items)) throw new UnsupportedPassengerServiceAllocation('missing priced itinerary')
  const items = (offer.items as unknown[]).map(record).filter(item => item.itemType === 'flight')
  if (!items.length) throw new UnsupportedPassengerServiceAllocation('missing explicit priced flight')
  const services = new Set<string>(); const itemIds = new Set<string>(); const itemKeys = new Set<string>()
  const legs = items.map(item => {
    const itemId = id(item.id); const itemKey = id(item.itemKey)
    const flight = record(item.flightInstance); const bucket = record(item.inventoryBucket)
    const flightId = id(flight.id); const bucketId = id(bucket.id)
    if (itemIds.has(itemId) || itemKeys.has(itemKey)) throw new UnsupportedPassengerServiceAllocation('duplicate priced service identity')
    itemIds.add(itemId); itemKeys.add(itemKey)
    if (services.has(flightId)) throw new UnsupportedPassengerServiceAllocation('repeated dated flight needs an explicit reviewed extra-seat or separate service contract')
    services.add(flightId)
    if (id(record(item.carrier).id) !== carrierId || id(record(flight.carrier).id) !== carrierId || id(record(bucket.carrier).id) !== carrierId
      || id(record(bucket.flightInstance).id) !== flightId) throw new UnsupportedPassengerServiceAllocation('foreign or mismatched flight/bucket binding')
    if (item.currencyCode !== offer.currencyCode || typeof offer.currencyCode !== 'string' || !/^[A-Z]{3}$/.test(offer.currencyCode)) throw new UnsupportedPassengerServiceAllocation('service currency differs from accepted offer')
    // Original v1 converter carried every offered passenger on each leg; some
    // retained v1 terms omit references. Preserve that unversioned meaning only
    // when the protected hold version is 1. Any DECLARED allocation must match.
    const legacyWholeParty = acceptanceVersion === 1 && (item.passengerReferences == null || (Array.isArray(item.passengerReferences) && item.passengerReferences.length === 0))
    if (item.quantity !== party.length || (!legacyWholeParty && !sameIds(ids(item.passengerReferences), party))) throw new UnsupportedPassengerServiceAllocation('every supported leg must allocate exactly this whole party once')
    const originId = id(record(flight.origin).id); const destinationId = id(record(flight.destination).id)
    const departure = date(flight.scheduledDepartureAt); const arrival = date(flight.scheduledArrivalAt)
    if (originId === destinationId || arrival <= departure) throw new UnsupportedPassengerServiceAllocation('invalid service endpoints or chronology')
    return { itemId, flightId, bucketId, originId, destinationId, departure, arrival }
  }).sort((a, b) => a.departure - b.departure || a.itemId.localeCompare(b.itemId))
  for (let index = 1; index < legs.length; index++) {
    if (legs[index - 1].destinationId !== legs[index].originId || legs[index - 1].arrival > legs[index].departure) {
      throw new UnsupportedPassengerServiceAllocation('legs do not form the supported contiguous chronological journey; multiple journey partitions require an explicit contract')
    }
  }
  return { version: 1, type: PASSENGER_SERVICE_ALLOCATION_TYPE, passengerIds: party,
    legs: legs.map((leg, index) => ({ sequence: index + 1, offerItemId: leg.itemId, flightInstanceId: leg.flightId, inventoryBucketId: leg.bucketId, passengerIds: [...party] })) }
}

/** Verify v2 retained terms against THEIR frozen facts, never today's catalog.
 * v1 completed receipts deliberately do not pass through this new admission
 * validator; they retain historical evidence with a legacy-unversioned label.
 */
export function allocationFromAcceptedSnapshot(value: unknown): PassengerServiceAllocation {
  const accepted = record(value)
  const carrierId = id(accepted.carrierId)
  if (!Array.isArray(accepted.passengers) || !Array.isArray(accepted.items)) throw new UnsupportedPassengerServiceAllocation('incomplete frozen acceptance')
  const passengerIds = (accepted.passengers as unknown[]).map(entry => id(record(entry).id))
  const items = (accepted.items as unknown[]).map(entry => {
    const item = record(entry)
    if (item.itemType !== 'flight') return item
    const flight = record(item.flight)
    return { ...item, carrier: { id: carrierId }, flightInstance: { ...flight, carrier: { id: flight.carrierId }, origin: { id: flight.originId }, destination: { id: flight.destinationId } },
      inventoryBucket: { id: item.inventoryBucketId, carrier: { id: carrierId }, flightInstance: { id: flight.id } } }
  })
  return supportedPassengerServiceAllocation({ carrier: { id: carrierId }, currencyCode: record(accepted.economics).currencyCode, passengers: passengerIds.map(id => ({ id })), items }, passengerIds)
}

export function frozenAcceptanceVersion(value: unknown): 1 | 2 {
  const version = value && typeof value === 'object' && !Array.isArray(value) ? record(value).version : undefined
  if (version !== 1 && version !== 2) throw new Error('Legacy offer has no supported frozen acceptance version; reconcile the original offer, not a new booking key.')
  return version
}
