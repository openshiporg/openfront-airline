import crypto from 'node:crypto'
import type { Context } from '.keystone/types'

import { requireFreshPermission } from '../access'
import { isEvidenceOnlyManualProvider } from '../lib/bounded-payment-policy'
import { supportedCurrencyCode } from '../lib/currency-policy'
import { runSerializableTransaction } from '../lib/transactions'
import onboardingContract from '../../platform/onboarding/seed.json'
import { createDatedFlightRecords, serviceDateInTimezone, zonedLocalDateTime } from './airlineProvisioning'
import { normalizeSearchDate } from './airlineWorkflows'
import { DomainError } from '../lib/domain-error'
import { AIRPORT_CATALOG } from '../../airline/lib/airport-catalog'
import { hasConfiguredStorefrontBrand } from '../../airline/lib/branding'
import { checkedMinorTotal } from '../lib/money'

const [PROFILE_STEP, CATALOG_STEP, DATED_SERVICE_STEP, STATION_STEP, SETTLEMENT_STEP, REVIEW_STEP] = onboardingContract.steps.map(step => step.key)


const initialAirportCatalog = AIRPORT_CATALOG

function required(value: string, label: string, pattern: RegExp) {
  const normalized = value.trim()
  if (!pattern.test(normalized)) throw new DomainError(`${label} is invalid.`)
  return normalized
}

function localTime(value: Date, timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(value)
  } catch {
    throw new DomainError('Timezone is not a recognized IANA timezone.')
  }
}

export async function completeCarrierOnboarding(
  _root: unknown,
  args: {
    name: string
    legalName: string
    code: string
    currencyCode: string
    timezone: string
    originCode: string
    destinationCode: string
    flightNumber: string
    serviceDate: string
    scheduledDepartureAt: string
    scheduledArrivalAt: string
    capacity: number
    baseAmount: number
    taxAmount: number
  },
  context: Context,
) {
  const actor = await requireFreshPermission(context, 'canManageOnboarding')
  await requireFreshPermission(context, 'canManageNetwork')
  await requireFreshPermission(context, 'canManageInventory')
  // Setup also writes the evidence-only payment provider and the settlement-import integration.
  await requireFreshPermission(context, 'canManagePayments')
  await requireFreshPermission(context, 'canManageIntegrations')
  // Setup creates the operator's active origin station assignment, which is otherwise managed only by canManageUsers.
  await requireFreshPermission(context, 'canManageUsers')
  const serviceDate = normalizeSearchDate(args.serviceDate)
  const timezone = required(args.timezone, 'Timezone', /^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+)$/)
  const departure = zonedLocalDateTime(args.scheduledDepartureAt, timezone, 'Scheduled departure')
  const arrival = zonedLocalDateTime(args.scheduledArrivalAt, timezone, 'Scheduled arrival')
  if (departure <= new Date() || arrival <= departure || arrival.getTime() - departure.getTime() > 24 * 60 * 60_000) throw new DomainError('Scheduled departure must be in the future and arrival must be after departure within 24 hours.')
  const serviceDay = new Date(`${serviceDate}T00:00:00.000Z`)
  if (serviceDay < new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z') || serviceDay > new Date(Date.now() + 180 * 86_400_000)) throw new DomainError('Initial service date must be today through six months from now.')
  if (!Number.isSafeInteger(args.capacity) || args.capacity < 1 || args.capacity > 300) throw new DomainError('Capacity must be an integer between 1 and 300.')
  if (![args.baseAmount, args.taxAmount].every(value => Number.isSafeInteger(value) && value >= 0)) throw new DomainError('Amounts must be non-negative minor-unit integers.')
  // A nine-traveler party total must still fit the 32-bit amount columns and GraphQL Int results.
  checkedMinorTotal([args.baseAmount, args.taxAmount], 9)
  const data = {
    name: required(args.name, 'Carrier name', /^.{2,120}$/),
    legalName: required(args.legalName, 'Legal name', /^.{2,160}$/),
    code: required(args.code.toUpperCase(), 'Carrier code', /^[A-Z0-9]{2,3}$/),
    defaultCurrencyCode: supportedCurrencyCode(args.currencyCode),
    defaultTimezone: timezone,
    originCode: required(args.originCode.toUpperCase(), 'Origin airport', /^[A-Z]{3}$/),
    destinationCode: required(args.destinationCode.toUpperCase(), 'Destination airport', /^[A-Z]{3}$/),
    flightNumber: required(args.flightNumber.toUpperCase(), 'Flight number', /^[A-Z0-9]{1,6}$/),
    serviceDate,
    scheduledDepartureAt: departure.toISOString(),
    scheduledArrivalAt: arrival.toISOString(),
    capacity: args.capacity,
    baseAmount: args.baseAmount,
    taxAmount: args.taxAmount,
  }
  if (data.originCode === data.destinationCode) throw new DomainError('Origin and destination must differ.')
  if (serviceDateInTimezone(departure, data.defaultTimezone) !== serviceDate) throw new DomainError('Scheduled departure must fall on the service date in the carrier timezone.')
  const digest = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')

  try {
    return await runSerializableTransaction(context, async transactionContext => {
    const tx = transactionContext.prisma as any
    const sudo = transactionContext.sudo() as any
    const now = new Date()
    await tx.$queryRaw`SELECT "id" FROM "Carrier" WHERE "id" = ${actor.carrierId} FOR UPDATE`
    const currentCarrier = await tx.carrier.findUnique({ where: { id: actor.carrierId }, select: { code: true, defaultCurrencyCode: true, defaultTimezone: true } })
    if (!currentCarrier) throw new DomainError('Carrier not found or inaccessible.')
    if (currentCarrier.code !== data.code || currentCarrier.defaultCurrencyCode !== data.defaultCurrencyCode || currentCarrier.defaultTimezone !== data.defaultTimezone) {
      const retainedCommercialRows = await tx.flightInstance.count({ where: { carrierId: actor.carrierId } }) + await tx.booking.count({ where: { carrierId: actor.carrierId } }) + await tx.offer.count({ where: { carrierId: actor.carrierId } })
      if (retainedCommercialRows) throw new DomainError('Carrier code, currency, and timezone cannot change after dated flights, offers, or bookings exist.')
    }
    await tx.user.update({ where: { id: actor.itemId }, data: { onboardingStatus: 'in_progress' } })
    const carrierRecord = await tx.carrier.update({ where: { id: actor.carrierId }, data: { name: data.name, legalName: data.legalName, code: data.code, defaultCurrencyCode: data.defaultCurrencyCode, defaultTimezone: data.defaultTimezone } })

    const loadAirport = async (iataCode: string) => {
      const existing = await tx.airport.findUnique({ where: { iataCode } })
      const reference = initialAirportCatalog[iataCode]
      // Any active airport already in the network (from this catalog or registered on the Network page) is used as is.
      if (existing) {
        if (!existing.isActive) throw new DomainError(`Airport ${iataCode} is inactive.`)
        return existing
      }
      if (!reference) throw new DomainError(`Add airport ${iataCode} on the Network page first.`)
      return tx.airport.create({ data: { iataCode, ...reference } })
    }
    const [origin, destination] = await Promise.all([loadAirport(data.originCode), loadAirport(data.destinationCode)])
    const route = await tx.route.upsert({
      where: { routeKey: `${data.code}:${data.originCode}:${data.destinationCode}` },
      update: {},
      create: { carrierId: actor.carrierId, routeKey: `${data.code}:${data.originCode}:${data.destinationCode}`, originId: origin.id, destinationId: destination.id, status: 'active' },
    })
    if (route.carrierId !== actor.carrierId || route.originId !== origin.id || route.destinationId !== destination.id || route.status !== 'active') throw new DomainError('Retained route differs from the authoritative launch catalog.')
    const expectedScheduleDay = serviceDay.getUTCDay() || 7
    const expectedEffectiveFrom = new Date(serviceDay.getTime() - 30 * 86_400_000)
    const expectedEffectiveTo = new Date(serviceDay.getTime() + 365 * 86_400_000)
    const arrivalLocalDate = serviceDateInTimezone(arrival, data.defaultTimezone)
    const expectedArrivalDayOffset = Math.round((new Date(`${arrivalLocalDate}T00:00:00.000Z`).getTime() - serviceDay.getTime()) / 86_400_000)
    const schedule = await tx.flightSchedule.upsert({
      where: { scheduleKey: `${data.code}:${data.flightNumber}` },
      update: {},
      create: {
        carrierId: actor.carrierId,
        scheduleKey: `${data.code}:${data.flightNumber}`,
        routeId: route.id,
        operatingCarrierId: actor.carrierId,
        flightNumber: data.flightNumber,
        departureLocalTime: localTime(departure, data.defaultTimezone),
        arrivalLocalTime: localTime(arrival, data.defaultTimezone),
        arrivalDayOffset: expectedArrivalDayOffset,
        daysOfWeek: [expectedScheduleDay],
        effectiveFrom: expectedEffectiveFrom,
        effectiveTo: expectedEffectiveTo,
        status: 'published',
      },
    })
    const expectedDepartureLocalTime = localTime(departure, data.defaultTimezone)
    const expectedArrivalLocalTime = localTime(arrival, data.defaultTimezone)
    if (schedule.carrierId !== actor.carrierId || schedule.routeId !== route.id || schedule.operatingCarrierId !== actor.carrierId || schedule.flightNumber !== data.flightNumber || schedule.departureLocalTime !== expectedDepartureLocalTime || schedule.arrivalLocalTime !== expectedArrivalLocalTime || schedule.arrivalDayOffset !== expectedArrivalDayOffset || schedule.status !== 'published' || !schedule.effectiveFrom || schedule.effectiveFrom > serviceDay || !schedule.effectiveTo || schedule.effectiveTo < serviceDay || !Array.isArray(schedule.daysOfWeek) || !schedule.daysOfWeek.includes(expectedScheduleDay)) throw new DomainError('Retained schedule differs from the authoritative launch catalog.')
    const instanceKey = `${data.code}:${data.flightNumber}:${serviceDate}`
    const retainedFlight = await tx.flightInstance.findUnique({ where: { instanceKey }, select: { id: true } })
    const retainedCatalog = await tx.inventoryBucket.findUnique({
      where: { bucketKey: `${instanceKey}:Y:STANDARD` },
      include: { cabin: true, fareBrand: true },
    })
    let cabin: any
    let fareBrand: any
    if (retainedCatalog) {
      cabin = retainedCatalog.cabin
      fareBrand = retainedCatalog.fareBrand
      const catalogMatches = retainedFlight?.id === retainedCatalog.flightInstanceId
        && retainedCatalog.carrierId === actor.carrierId && retainedCatalog.bookingClassCode === 'Y' && retainedCatalog.capacity === data.capacity
        && retainedCatalog.baseAmount === data.baseAmount && retainedCatalog.taxAmount === data.taxAmount && retainedCatalog.currencyCode === data.defaultCurrencyCode && retainedCatalog.status === 'open'
        && retainedCatalog.authorized >= retainedCatalog.sold + retainedCatalog.held + retainedCatalog.blocked && retainedCatalog.authorized <= retainedCatalog.capacity
        && cabin?.carrierId === actor.carrierId && cabin.code === 'Y' && cabin.name === 'Economy' && cabin.cabinClass === 'economy'
        && fareBrand?.carrierId === actor.carrierId && fareBrand.cabinId === cabin.id && fareBrand.code === 'STANDARD' && fareBrand.name === 'Standard' && fareBrand.status === 'active'
        && fareBrand.includedBaggage?.pieces === 1 && fareBrand.includedBaggage?.maxWeightGrams === 23000 && JSON.stringify(fareBrand.benefits) === JSON.stringify(['Standard seat selection', 'One checked bag'])
      if (!catalogMatches) throw new DomainError('Retained launch inventory catalog differs from the bounded onboarding contract; replay will not rewrite commercial relationships.')
    } else {
      const launchCabinId = `${actor.carrierId}:launch-cabin-y`
      const launchFareBrandId = `${actor.carrierId}:launch-fare-standard`
      const [retainedCabin, retainedFareBrand] = await Promise.all([
        tx.cabin.findUnique({ where: { id: launchCabinId } }),
        tx.fareBrand.findUnique({ where: { id: launchFareBrandId } }),
      ])
      const cabinCompatible = (record: any) => !record || record.carrierId === actor.carrierId && record.code === 'Y' && record.name === 'Economy' && record.cabinClass === 'economy'
      const fareCompatible = (record: any) => !record || record.carrierId === actor.carrierId && record.cabinId === launchCabinId && record.code === 'STANDARD' && record.name === 'Standard' && record.status === 'active'
        && record.includedBaggage?.pieces === 1 && record.includedBaggage?.maxWeightGrams === 23000 && JSON.stringify(record.benefits) === JSON.stringify(['Standard seat selection', 'One checked bag'])
      if (!cabinCompatible(retainedCabin) || !fareCompatible(retainedFareBrand)) throw new DomainError('Partial retained launch cabin/fare catalog differs from the bounded onboarding contract; replay will not complete or rewrite it.')
      cabin = await tx.cabin.upsert({
        where: { id: launchCabinId },
        update: {},
        create: { id: launchCabinId, carrierId: actor.carrierId, code: 'Y', name: 'Economy', cabinClass: 'economy' },
      })
      fareBrand = await tx.fareBrand.upsert({
        where: { id: launchFareBrandId },
        update: {},
        create: { id: launchFareBrandId, carrierId: actor.carrierId, cabinId: cabin.id, code: 'STANDARD', name: 'Standard', status: 'active', includedBaggage: { pieces: 1, maxWeightGrams: 23000 }, benefits: ['Standard seat selection', 'One checked bag'], refundabilitySummary: 'Refunds require verified operator processing.' },
      })
      if (!cabinCompatible(cabin) || !fareCompatible(fareBrand)) throw new DomainError('Launch cabin/fare catalog could not be verified after creation.')
    }
    const datedService = await createDatedFlightRecords(tx, {
      carrierId: actor.carrierId,
      carrierCode: data.code,
      scheduleId: schedule.id,
      routeId: route.id,
      originId: origin.id,
      destinationId: destination.id,
      operatingCarrierId: actor.carrierId,
      flightNumber: data.flightNumber,
      serviceDate,
      scheduledDepartureAt: departure,
      scheduledArrivalAt: arrival,
      cabinId: cabin.id,
      cabinCode: cabin.code,
      fareBrandId: fareBrand.id,
      fareBrandCode: fareBrand.code,
      capacity: data.capacity,
      baseAmount: data.baseAmount,
      taxAmount: data.taxAmount,
      currencyCode: data.defaultCurrencyCode,
    }, sudo.query)
    const stationAssignment = await tx.stationAssignment.upsert({
      where: { assignmentKey: `${actor.carrierId}:${actor.itemId}:${origin.id}` },
      update: {},
      create: { carrierId: actor.carrierId, assignmentKey: `${actor.carrierId}:${actor.itemId}:${origin.id}`, userId: actor.itemId, airportId: origin.id, status: 'active', canCheckIn: true, canAcceptBags: true, canBoard: true, validFrom: now },
    })
    const paymentProvider = await tx.paymentProvider.upsert({
      where: { providerKey: `${data.code}:external-settlement-evidence` },
      update: {},
      create: {
        carrierId: actor.carrierId,
        providerKey: `${data.code}:external-settlement-evidence`,
        name: 'External settlement evidence',
        code: 'EXTERNAL_EVIDENCE',
        adapterType: 'manual',
        status: 'active',
        createPaymentFunction: 'manual.capture',
        capturePaymentFunction: 'manual.capture',
        refundPaymentFunction: 'manual.refund',
        getPaymentStatusFunction: 'manual.status',
        handleWebhookFunction: 'manual.webhook',
        configuration: { mode: 'external_evidence_only', providerExecution: false, requiresIndependentApproval: true },
      },
    })
    const settlementProvider = await tx.integrationProvider.upsert({
      where: { providerKey: `${data.code}:local-settlement-ledger-provider` },
      update: {},
      create: { carrierId: actor.carrierId, providerKey: `${data.code}:local-settlement-ledger-provider`, name: 'Local settlement evidence import', code: 'LOCAL_SETTLEMENT_EVIDENCE', type: 'other', status: 'active', adapterModule: 'settlement-ledger-import', capabilities: ['settlement_import'] },
    })
    const settlementConnection = await tx.providerConnection.upsert({
      where: { connectionKey: `${data.code}:local-settlement-ledger` },
      update: {},
      create: { carrierId: actor.carrierId, connectionKey: `${data.code}:local-settlement-ledger`, providerId: settlementProvider.id, name: 'Local settlement evidence connection', status: 'active', capabilities: ['settlement_import'], configuration: { localOnly: true, providerExecution: false } },
    })
    // Provider keys derive from the carrier code; never adopt rows another carrier already owns under that key.
    if ([paymentProvider, settlementProvider, settlementConnection].some((row: any) => row.carrierId !== actor.carrierId) || settlementConnection.providerId !== settlementProvider.id) {
      throw new DomainError('Settlement provider keys for this carrier code belong to another carrier or connection; reconcile them before launch review.')
    }

    const paymentOperatorCount = await tx.user.count({ where: { carrierId: actor.carrierId, role: { canManagePayments: true } } })
    const settlementCredentials = await tx.machineCredential.findMany({ where: { carrierId: actor.carrierId, audience: 'settlement-import', status: 'active', expiresAt: { gt: now } }, select: { scopes: true }, take: 100 })
    const settlementCredentialReady = settlementCredentials.some((credential: any) => Array.isArray(credential.scopes) && credential.scopes.includes('settlements:write'))
    const datedReady = ['scheduled', 'open_for_sale'].includes(datedService.flight.status) && datedService.bucket.status === 'open' && datedService.bucket.authorized >= datedService.bucket.sold + datedService.bucket.held + datedService.bucket.blocked
    const stationReady = stationAssignment.status === 'active' && stationAssignment.canCheckIn && stationAssignment.canAcceptBags && stationAssignment.canBoard && (!stationAssignment.validFrom || stationAssignment.validFrom <= now) && (!stationAssignment.validUntil || stationAssignment.validUntil > now)
    const settlementReady = paymentProvider.status === 'active' && isEvidenceOnlyManualProvider(paymentProvider) && settlementProvider.status === 'active' && settlementProvider.adapterModule === 'settlement-ledger-import' && Array.isArray(settlementProvider.capabilities) && (settlementProvider.capabilities as any[]).includes('settlement_import') && settlementConnection.status === 'active' && (settlementConnection.configuration as any)?.providerExecution === false && Array.isArray(settlementConnection.capabilities) && (settlementConnection.capabilities as any[]).includes('settlement_import') && paymentOperatorCount >= 2 && settlementCredentialReady
    const profileReady = carrierRecord.status === 'active' && carrierRecord.directSalesEnabled === true
    const completed = profileReady && datedReady && stationReady && settlementReady
    const upsertStep = (step: string, status: 'completed' | 'needs_attention', requirements: string[] = []) => tx.onboardingStep.upsert({
      where: { progressKey: `${actor.carrierId}:${actor.itemId}:${step}` },
      update: { status, requirements, inputDigest: digest, lastAttemptedAt: now, attemptCount: { increment: 1 }, ...(status === 'completed' ? { completedAt: now } : { completedAt: null }) },
      create: { carrierId: actor.carrierId, userId: actor.itemId, progressKey: `${actor.carrierId}:${actor.itemId}:${step}`, step, status, requirements, inputDigest: digest, attemptCount: 1, lastAttemptedAt: now, ...(status === 'completed' ? { completedAt: now } : {}) },
    })
    // Selling also needs the public storefront branding; the review step points there until it is set.
    const storefrontReady = hasConfiguredStorefrontBrand(carrierRecord)
    const steps = [
      await upsertStep(PROFILE_STEP, profileReady ? 'completed' : 'needs_attention', profileReady ? [] : ['Turn on direct sales for your carrier in Carrier settings.']),
      await upsertStep(CATALOG_STEP, 'completed'),
      await upsertStep(DATED_SERVICE_STEP, datedReady ? 'completed' : 'needs_attention', datedReady ? [] : ['Open a future flight for sale on Schedules & flights.']),
      await upsertStep(STATION_STEP, stationReady ? 'completed' : 'needs_attention', stationReady ? [] : ['Give an operator check-in, bag and boarding access at the origin airport on Stations & access.']),
      await upsertStep(SETTLEMENT_STEP, settlementReady ? 'completed' : 'needs_attention', settlementReady ? ['One payment operator records money received; a second approves it.'] : ['Add a second user with payment permission (one records payments, another approves them), keep the manual settlement provider active on Payment providers, and keep an active settlement credential.']),
      await upsertStep(REVIEW_STEP, completed ? 'completed' : 'needs_attention', completed ? (storefrontReady ? [] : ['Set the storefront title, description and brand colour in Storefront settings to start selling.']) : ['Finish the steps above, then run setup again.']),
    ]
    await tx.user.update({ where: { id: actor.itemId }, data: { onboardingStatus: completed ? 'completed' : 'in_progress' } })
    // The launch is per carrier: once it is complete, no other onboarding manager should still see the setup card.
    if (completed) await tx.user.updateMany({
      where: { carrierId: actor.carrierId, id: { not: actor.itemId }, onboardingStatus: { in: ['not_started', 'in_progress', 'dismissed'] }, role: { canManageOnboarding: true } },
      data: { onboardingStatus: 'completed' },
    })
    if (completed) await tx.outboxEvent.upsert({
      where: { eventKey: `onboarding:${actor.carrierId}:${digest}` },
      update: {},
      create: { carrierId: actor.carrierId, eventKey: `onboarding:${actor.carrierId}:${digest}`, topic: 'carrier.onboarding.completed', aggregateType: 'Carrier', aggregateId: actor.carrierId, payload: { code: data.code, flightInstanceId: datedService.flight.id, boundedScope: onboardingContract.launchScope }, status: 'pending', availableAt: now },
    })
    return { completed, steps: steps.map((step: any) => ({ key: step.step, status: step.status, attemptCount: step.attemptCount, requirements: step.requirements ?? [] })) }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onboarding failed closed.'
    const now = new Date()
    const markNeedsAttention = (step: string) => (context.prisma as any).onboardingStep.upsert({
      where: { progressKey: `${actor.carrierId}:${actor.itemId}:${step}` },
      update: { status: 'needs_attention', requirements: [message], inputDigest: digest, lastAttemptedAt: now, attemptCount: { increment: 1 }, completedAt: null },
      create: { carrierId: actor.carrierId, userId: actor.itemId, progressKey: `${actor.carrierId}:${actor.itemId}:${step}`, step, status: 'needs_attention', requirements: [message], inputDigest: digest, attemptCount: 1, lastAttemptedAt: now },
    })
    await markNeedsAttention(REVIEW_STEP)
    if (/retained|catalog|dated service/i.test(message)) await markNeedsAttention(CATALOG_STEP)
    throw error
  }
}

// Sidebar "Skip for now": the operator's own onboarding card only. User.onboardingStatus stays command-only, a
// completed launch is never overwritten, and a later setup run sets in_progress again.
export async function dismissCarrierOnboarding(_root: unknown, _args: Record<string, never>, context: Context) {
  const actor = await requireFreshPermission(context, 'canManageOnboarding')
  return (context.prisma as any).$transaction(async (tx: any) => {
    const dismissed = await tx.user.updateMany({
      where: { id: actor.itemId, carrierId: actor.carrierId, onboardingStatus: { in: ['not_started', 'in_progress'] } },
      data: { onboardingStatus: 'dismissed' },
    })
    const user = await tx.user.findUniqueOrThrow({ where: { id: actor.itemId }, select: { id: true, onboardingStatus: true } })
    if (dismissed.count === 1) {
      const now = new Date()
      await tx.auditEvent.create({ data: {
        carrierId: actor.carrierId, actorId: actor.itemId, eventKey: `user:${actor.itemId}:onboarding-dismissed:${now.getTime()}`,
        action: 'onboarding.dismiss', aggregateType: 'User', aggregateId: actor.itemId, source: 'platform',
        beforeSummary: {}, afterSummary: { onboardingStatus: 'dismissed' }, metadata: {}, occurredAt: now,
      } })
    }
    return { id: user.id, onboardingStatus: user.onboardingStatus }
  })
}
