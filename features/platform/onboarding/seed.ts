import 'dotenv/config'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { PrismaClient } from '@prisma/client'

const require = createRequire(import.meta.url)
const bcrypt = require('bcryptjs') as { hash(value: string, rounds: number): Promise<string> }

const CARRIER_CODE = 'AV'
const CARRIER_NAME = 'Avante Air'
const ADMIN_EMAIL = 'operations@avante.example'

if (process.env.NODE_ENV === 'production') throw new Error('The local runtime seed is disabled in production.')
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required for the local runtime seed.')
if (process.env.ALLOW_RUNTIME_SEED !== '1') throw new Error('Refusing to seed: set ALLOW_RUNTIME_SEED=1 for an explicitly selected local runtime database.')
const parsedUrl = new URL(databaseUrl)
const databaseName = parsedUrl.pathname.slice(1)
const allowedRuntime = databaseName.startsWith('runtime_airline')
const allowedDisposableTest = process.env.ALLOW_DISPOSABLE_DATABASE_TESTS === '1' && databaseName.startsWith('openfront_airline_test_')
if (!['127.0.0.1', 'localhost'].includes(parsedUrl.hostname) || (!allowedRuntime && !allowedDisposableTest)) {
  throw new Error('The runtime seed only permits loopback runtime_airline* databases or explicitly allowed openfront_airline_test_* databases.')
}

const prisma = new PrismaClient()
const permissions = {
  canAccessDashboard: true, canReadNetwork: true, canManageNetwork: true,
  canReadInventory: true, canManageInventory: true, canReadOffers: true, canManageOffers: true,
  canReadBookings: true, canManageBookings: true, canReadPassengers: true, canManagePassengers: true,
  canManageSecurePassengerData: true, canReadTicketing: true, canManageTicketing: true,
  canReadPayments: true, canManagePayments: true, canReadAirportService: true, canManageAirportService: true,
  canReadDisruptions: true, canManageDisruptions: true, canReadIntegrations: true, canManageIntegrations: true,
  canReadAudit: true, canManageOnboarding: true, canReadUsers: true, canManageUsers: true,
  canReadRoles: true, canManageRoles: true, canManageAgents: true,
} as const

function serviceTimes(daysFromNow: number) {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + daysFromNow)
  const serviceDate = date.toISOString().slice(0, 10)
  return {
    serviceDate,
    date: new Date(`${serviceDate}T00:00:00.000Z`),
    departure: new Date(`${serviceDate}T13:00:00.000Z`),
    arrival: new Date(`${serviceDate}T14:20:00.000Z`),
  }
}

async function main() {
  const existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL }, select: { id: true, carrierId: true, roleId: true } })
  const suppliedPassword = process.env.RUNTIME_ADMIN_PASSWORD ?? ''
  if (!existingAdmin && suppliedPassword.length < 16) {
    throw new Error('RUNTIME_ADMIN_PASSWORD with at least 16 characters is required when creating the local Avante Air administrator. Existing credentials are never reset by replay.')
  }

  const carrier = await prisma.carrier.upsert({
    where: { code: CARRIER_CODE },
    update: {},
    create: { name: CARRIER_NAME, legalName: 'Avante Air LLC', code: CARRIER_CODE, defaultCurrencyCode: 'USD', defaultTimezone: 'America/New_York', status: 'active', directSalesEnabled: true },
  })
  const retainedRole = await prisma.role.findUnique({ where: { id: 'runtime-avante-admin-role' }, select: { carrierId: true } })
  if (retainedRole?.carrierId && retainedRole.carrierId !== carrier.id) throw new Error('The runtime role identity belongs to a different carrier; seed replay will not reassign it.')
  const role = await prisma.role.upsert({
    where: { id: 'runtime-avante-admin-role' },
    update: {},
    create: { id: 'runtime-avante-admin-role', name: 'Avante Air administrator', carrierId: carrier.id, ...permissions },
  })
  if (existingAdmin?.carrierId && existingAdmin.carrierId !== carrier.id) throw new Error('The configured runtime administrator belongs to a different carrier; seed replay will not reassign retained tenant data.')
  if (existingAdmin && !existingAdmin.roleId) throw new Error('The retained runtime administrator has no role; seed replay will not silently replace its authorization.')
  const admin = existingAdmin
    ? await prisma.user.findUniqueOrThrow({ where: { id: existingAdmin.id } })
    : await prisma.user.create({ data: { name: 'Avante Air Administrator', email: ADMIN_EMAIL, password: await bcrypt.hash(suppliedPassword, 12), carrierId: carrier.id, roleId: role.id, onboardingStatus: 'in_progress' } })

  const loadAirport = async (input: { iataCode: string; name: string; city: string; countryCode: string; timezone: string }) => {
    const airport = await prisma.airport.upsert({ where: { iataCode: input.iataCode }, update: {}, create: input })
    if (!airport.isActive || airport.name !== input.name || airport.city !== input.city || airport.countryCode !== input.countryCode || airport.timezone !== input.timezone) throw new Error(`Retained airport ${input.iataCode} differs from the bounded runtime seed catalog.`)
    return airport
  }
  const [origin, destination] = await Promise.all([
    loadAirport({ iataCode: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', countryCode: 'US', timezone: 'America/New_York' }),
    loadAirport({ iataCode: 'BOS', name: 'Boston Logan International Airport', city: 'Boston', countryCode: 'US', timezone: 'America/New_York' }),
  ])
  await prisma.stationAssignment.upsert({
    where: { assignmentKey: `${carrier.id}:${admin.id}:${origin.id}` },
    update: {},
    create: { carrierId: carrier.id, assignmentKey: `${carrier.id}:${admin.id}:${origin.id}`, userId: admin.id, airportId: origin.id, status: 'active', canCheckIn: true, canAcceptBags: true, canBoard: true },
  })
  const route = await prisma.route.upsert({
    where: { routeKey: `${CARRIER_CODE}:JFK:BOS` }, update: {},
    create: { carrierId: carrier.id, routeKey: `${CARRIER_CODE}:JFK:BOS`, originId: origin.id, destinationId: destination.id, status: 'active' },
  })
  if (route.carrierId !== carrier.id || route.originId !== origin.id || route.destinationId !== destination.id || route.status !== 'active') throw new Error('Retained route differs from the bounded runtime seed catalog.')
  const now = new Date()
  const expectedEffectiveFrom = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
  const expectedEffectiveTo = new Date(Date.UTC(now.getUTCFullYear() + 1, 11, 31))
  const expectedDaysOfWeek = [1, 2, 3, 4, 5, 6, 7]
  const schedule = await prisma.flightSchedule.upsert({
    where: { scheduleKey: `${CARRIER_CODE}:101` }, update: {},
    create: { carrierId: carrier.id, scheduleKey: `${CARRIER_CODE}:101`, routeId: route.id, operatingCarrierId: carrier.id, flightNumber: '101', departureLocalTime: '09:00', arrivalLocalTime: '10:20', arrivalDayOffset: 0, daysOfWeek: expectedDaysOfWeek, effectiveFrom: expectedEffectiveFrom, effectiveTo: expectedEffectiveTo, status: 'published' },
  })
  if (schedule.carrierId !== carrier.id || schedule.routeId !== route.id || schedule.operatingCarrierId !== carrier.id || schedule.flightNumber !== '101' || schedule.departureLocalTime !== '09:00' || schedule.arrivalLocalTime !== '10:20' || schedule.arrivalDayOffset !== 0 || schedule.status !== 'published' || schedule.effectiveFrom?.getTime() !== expectedEffectiveFrom.getTime() || schedule.effectiveTo?.getTime() !== expectedEffectiveTo.getTime() || JSON.stringify(schedule.daysOfWeek) !== JSON.stringify(expectedDaysOfWeek)) throw new Error('Retained schedule differs from the bounded runtime seed catalog.')
  const times = serviceTimes(14)
  const instanceKey = `${CARRIER_CODE}:101:${times.serviceDate}`
  const retainedCatalog = await prisma.inventoryBucket.findUnique({ where: { bucketKey: `${instanceKey}:Y:STANDARD` }, include: { flightInstance: true, cabin: true, fareBrand: true } })
  let cabin
  let fareBrand
  if (retainedCatalog) {
    if (!retainedCatalog.cabin || !retainedCatalog.fareBrand) throw new Error('Retained launch inventory catalog has incomplete relationships; replay will not rewrite commercial relationships.')
    cabin = retainedCatalog.cabin
    fareBrand = retainedCatalog.fareBrand
    const catalogMatches = retainedCatalog.carrierId === carrier.id && retainedCatalog.flightInstance?.instanceKey === instanceKey && retainedCatalog.bookingClassCode === 'Y'
      && retainedCatalog.capacity === 30 && retainedCatalog.baseAmount === 12900 && retainedCatalog.taxAmount === 2580 && retainedCatalog.currencyCode === 'USD' && retainedCatalog.status === 'open'
      && retainedCatalog.authorized >= retainedCatalog.sold + retainedCatalog.held + retainedCatalog.blocked && retainedCatalog.authorized <= retainedCatalog.capacity
      && cabin.carrierId === carrier.id && cabin.code === 'Y' && cabin.name === 'Economy' && cabin.cabinClass === 'economy'
      && fareBrand.carrierId === carrier.id && fareBrand.cabinId === cabin.id && fareBrand.code === 'STANDARD' && fareBrand.name === 'Standard' && fareBrand.status === 'active'
      && (fareBrand.includedBaggage as any)?.pieces === 1 && (fareBrand.includedBaggage as any)?.maxWeightGrams === 23000 && JSON.stringify(fareBrand.benefits) === JSON.stringify(['Standard seat selection', 'One checked bag'])
    if (!catalogMatches) throw new Error('Retained launch inventory catalog differs from the bounded runtime seed; replay will not rewrite commercial relationships.')
  } else {
    const launchCabinId = `${carrier.id}:launch-cabin-y`
    const launchFareBrandId = `${carrier.id}:launch-fare-standard`
    const [retainedCabin, retainedFareBrand] = await Promise.all([
      prisma.cabin.findUnique({ where: { id: launchCabinId } }),
      prisma.fareBrand.findUnique({ where: { id: launchFareBrandId } }),
    ])
    const cabinCompatible = (record: any) => !record || record.carrierId === carrier.id && record.code === 'Y' && record.name === 'Economy' && record.cabinClass === 'economy'
    const fareCompatible = (record: any) => !record || record.carrierId === carrier.id && record.cabinId === launchCabinId && record.code === 'STANDARD' && record.name === 'Standard' && record.status === 'active'
      && record.includedBaggage?.pieces === 1 && record.includedBaggage?.maxWeightGrams === 23000 && JSON.stringify(record.benefits) === JSON.stringify(['Standard seat selection', 'One checked bag'])
    if (!cabinCompatible(retainedCabin) || !fareCompatible(retainedFareBrand)) throw new Error('Partial retained launch cabin/fare catalog differs from the bounded runtime seed; replay will not complete or rewrite it.')
    cabin = await prisma.cabin.upsert({ where: { id: launchCabinId }, update: {}, create: { id: launchCabinId, carrierId: carrier.id, code: 'Y', name: 'Economy', cabinClass: 'economy' } })
    fareBrand = await prisma.fareBrand.upsert({
      where: { id: launchFareBrandId }, update: {},
      create: { id: launchFareBrandId, carrierId: carrier.id, cabinId: cabin.id, code: 'STANDARD', name: 'Standard', status: 'active', includedBaggage: { pieces: 1, maxWeightGrams: 23000 }, benefits: ['Standard seat selection', 'One checked bag'], refundabilitySummary: 'Refunds require verified operator processing.' },
    })
    if (!cabinCompatible(cabin) || !fareCompatible(fareBrand)) throw new Error('Launch cabin/fare catalog could not be verified after creation.')
  }
  const flight = await prisma.flightInstance.upsert({
    where: { instanceKey }, update: {},
    create: { carrierId: carrier.id, instanceKey, scheduleId: schedule.id, routeId: route.id, originId: origin.id, destinationId: destination.id, operatingCarrierId: carrier.id, flightNumber: '101', serviceDate: times.date, scheduledDepartureAt: times.departure, scheduledArrivalAt: times.arrival, departureTerminal: '5', departureGate: '12', status: 'open_for_sale' },
  })
  if (flight.carrierId !== carrier.id || flight.scheduleId !== schedule.id || flight.routeId !== route.id || flight.originId !== origin.id || flight.destinationId !== destination.id || flight.operatingCarrierId !== carrier.id || flight.flightNumber !== '101' || flight.serviceDate.getTime() !== times.date.getTime() || flight.scheduledDepartureAt.getTime() !== times.departure.getTime() || flight.scheduledArrivalAt.getTime() !== times.arrival.getTime()) throw new Error('Retained dated flight differs from the bounded runtime seed catalog.')
  const bucketKey = `${instanceKey}:Y:STANDARD`
  const bucket = await prisma.inventoryBucket.upsert({
    where: { bucketKey }, update: {},
    create: { carrierId: carrier.id, bucketKey, flightInstanceId: flight.id, cabinId: cabin.id, fareBrandId: fareBrand.id, bookingClassCode: 'Y', capacity: 30, authorized: 30, sold: 0, held: 0, blocked: 0, baseAmount: 12900, taxAmount: 2580, currencyCode: 'USD', status: 'open' },
  })
  const mapKey = `${instanceKey}:Y`
  const seatMap = await prisma.seatMap.upsert({
    where: { mapKey }, update: {},
    create: { carrierId: carrier.id, mapKey, flightInstanceId: flight.id, version: 1, status: 'published', layoutSnapshot: { rows: 5, columns: ['A', 'B', 'C', 'D', 'E', 'F'], generatedForCapacity: 30 } },
  })
  for (const row of [1, 2, 3, 4, 5]) for (const columnCode of ['A', 'B', 'C', 'D', 'E', 'F']) {
    await prisma.seat.upsert({
      where: { seatKey: `${instanceKey}:${row}${columnCode}` }, update: {},
      create: { carrierId: carrier.id, seatKey: `${instanceKey}:${row}${columnCode}`, seatMapId: seatMap.id, cabinId: cabin.id, designator: `${row}${columnCode}`, rowNumber: row, columnCode, status: 'available', seatType: 'standard', characteristics: [], surchargeAmount: 0, currencyCode: 'USD' },
    })
  }
  if (bucket.carrierId !== carrier.id || bucket.flightInstanceId !== flight.id || bucket.cabinId !== cabin.id || bucket.fareBrandId !== fareBrand.id || bucket.bookingClassCode !== 'Y' || bucket.capacity !== 30 || bucket.baseAmount !== 12900 || bucket.taxAmount !== 2580 || bucket.currencyCode !== 'USD' || bucket.authorized < bucket.sold + bucket.held + bucket.blocked || bucket.authorized > bucket.capacity) throw new Error('Retained inventory bucket differs from the bounded runtime seed catalog.')
  const retainedSeats = await prisma.seat.findMany({ where: { seatMapId: seatMap.id }, orderBy: [{ rowNumber: 'asc' }, { columnCode: 'asc' }] })
  const layout = seatMap.layoutSnapshot as any
  const expectedColumns = ['A', 'B', 'C', 'D', 'E', 'F']
  const seatCatalogMatches = retainedSeats.length === 30 && retainedSeats.every((seat, index) => { const rowNumber = Math.floor(index / expectedColumns.length) + 1; const columnCode = expectedColumns[index % expectedColumns.length]; const designator = `${rowNumber}${columnCode}`; return seat.carrierId === carrier.id && seat.cabinId === cabin.id && seat.seatKey === `${instanceKey}:${designator}` && seat.designator === designator && seat.rowNumber === rowNumber && seat.columnCode === columnCode && ['available', 'blocked', 'unavailable'].includes(seat.status ?? '') && seat.seatType === 'standard' && seat.surchargeAmount === 0 && seat.currencyCode === 'USD' })
  if (seatMap.carrierId !== carrier.id || seatMap.flightInstanceId !== flight.id || seatMap.version !== 1 || seatMap.status !== 'published' || layout?.rows !== 5 || JSON.stringify(layout?.columns) !== JSON.stringify(expectedColumns) || (layout?.generatedForCapacity !== undefined && layout.generatedForCapacity !== 30) || !seatCatalogMatches) throw new Error('Retained seat-map catalog differs from the bounded runtime seed catalog.')
  const provider = await prisma.paymentProvider.upsert({
    where: { providerKey: `${CARRIER_CODE}:external-settlement-evidence` }, update: {},
    create: { carrierId: carrier.id, providerKey: `${CARRIER_CODE}:external-settlement-evidence`, name: 'External settlement evidence', code: 'EXTERNAL_EVIDENCE', adapterType: 'manual', status: 'active', createPaymentFunction: 'manual.capture', capturePaymentFunction: 'manual.capture', refundPaymentFunction: 'manual.refund', getPaymentStatusFunction: 'manual.status', handleWebhookFunction: 'manual.webhook', configuration: { mode: 'external_evidence_only', providerExecution: false, requiresIndependentApproval: true } },
  })
  const settlementProvider = await prisma.integrationProvider.upsert({
    where: { providerKey: `${CARRIER_CODE}:local-settlement-ledger-provider` }, update: {},
    create: { carrierId: carrier.id, providerKey: `${CARRIER_CODE}:local-settlement-ledger-provider`, name: 'Local settlement evidence import', code: 'LOCAL_SETTLEMENT_EVIDENCE', type: 'other', status: 'active', adapterModule: 'settlement-ledger-import', capabilities: ['settlement_import'] },
  })
  await prisma.providerConnection.upsert({
    where: { connectionKey: `${CARRIER_CODE}:local-settlement-ledger` }, update: {},
    create: { carrierId: carrier.id, connectionKey: `${CARRIER_CODE}:local-settlement-ledger`, providerId: settlementProvider.id, name: 'Local settlement evidence connection', status: 'active', capabilities: ['settlement_import'], configuration: { localOnly: true, providerExecution: false } },
  })
  const passenger = await prisma.passenger.upsert({
    where: { passengerKey: `${CARRIER_CODE}:sample-passenger-001` }, update: {},
    create: { carrierId: carrier.id, passengerKey: `${CARRIER_CODE}:sample-passenger-001`, givenName: 'Jordan', familyName: 'Lee', email: 'traveler@example.test', phone: '+1 212 555 0100' },
  })
  console.log(JSON.stringify({ carrier: { code: carrier.code, name: carrier.name }, admin: admin.email, passwordInitialized: !existingAdmin, passenger: passenger.passengerKey, route: 'JFK-BOS', serviceDate: times.serviceDate, flight: flight.flightNumber, inventoryBucket: bucket.bucketKey, seatMap: seatMap.mapKey, paymentBoundary: provider.name }, null, 2))
}

async function markRetainedCatalogNeedsAttention(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (!/retained|catalog|differs|incomplete/i.test(message)) return
  const carrier = await prisma.carrier.findUnique({ where: { code: CARRIER_CODE }, select: { id: true } })
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL }, select: { id: true, carrierId: true } })
  if (!carrier || !admin || admin.carrierId !== carrier.id) return
  const now = new Date()
  const digest = crypto.createHash('sha256').update('bounded-runtime-seed-retained-contract-v1').digest('hex')
  for (const step of ['network_catalog', 'launch_review']) await prisma.onboardingStep.upsert({
    where: { progressKey: `${carrier.id}:${admin.id}:${step}` },
    update: { status: 'needs_attention', requirements: [message], inputDigest: digest, lastAttemptedAt: now, attemptCount: { increment: 1 }, completedAt: null },
    create: { carrierId: carrier.id, userId: admin.id, progressKey: `${carrier.id}:${admin.id}:${step}`, step, status: 'needs_attention', requirements: [message], inputDigest: digest, attemptCount: 1, lastAttemptedAt: now },
  })
}

main().catch(async error => { await markRetainedCatalogNeedsAttention(error); console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
