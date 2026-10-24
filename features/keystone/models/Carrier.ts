import { list } from '@keystone-6/core'
import { checkbox, relationship, select, text } from '@keystone-6/core/fields'

import { freshCarrierFilter, hasFreshPermission, isFreshSignedIn } from '../access'
import { ONBOARDING_CURRENCIES } from '../lib/currency-policy'
import { trackingFields } from './trackingFields'

const ownCarrierFilter = (args: any) => freshCarrierFilter(args, '')

export const Carrier = list({
  access: {
    operation: {
      query: isFreshSignedIn,
      create: args => hasFreshPermission(args, 'canManageCarriers'),
      update: args => hasFreshPermission(args, 'canManageCarriers'),
      delete: () => false,
    },
    filter: {
      query: ownCarrierFilter,
      update: ownCarrierFilter,
    },
  },
  ui: {
    labelField: 'name',
    listView: { initialColumns: ['name', 'code', 'status', 'defaultCurrencyCode'] },
    hideDelete: true,
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    legalName: text({ validation: { isRequired: true } }),
    code: text({
      isIndexed: 'unique',
      validation: {
        isRequired: true,
        match: { regex: /^[A-Z0-9]{2,3}$/, explanation: 'Use a two or three character carrier designator.' },
      },
    }),
    icaoCode: text({
      isIndexed: 'unique',
      db: { isNullable: true },
      validation: { match: { regex: /^[A-Z]{3}$/, explanation: 'Use a three-letter ICAO designator.' } },
    }),
    callsign: text(),
    defaultCurrencyCode: text({
      defaultValue: 'USD',
      validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: 'Use an ISO 4217 currency code.' } },
    }),
    defaultTimezone: text({ defaultValue: 'UTC', validation: { isRequired: true } }),
    status: select({
      type: 'enum',
      defaultValue: 'active',
      validation: { isRequired: true },
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Archived', value: 'archived' },
      ],
    }),
    directSalesEnabled: checkbox({ defaultValue: true }),
    storefrontBrandColor: select({
      type: 'string',
      options: [
        { label: 'Slate', value: 'slate' },
        { label: 'Blue', value: 'blue' },
        { label: 'Indigo', value: 'indigo' },
        { label: 'Violet', value: 'violet' },
        { label: 'Rose', value: 'rose' },
        { label: 'Emerald', value: 'emerald' },
        { label: 'Amber', value: 'amber' },
      ],
      db: { isNullable: true },
      ui: { description: 'Allowlisted public storefront accent color' },
    }),
    storefrontHomepageTitle: text({
      db: { isNullable: true },
      validation: { length: { max: 120 } },
      ui: { description: 'Public storefront homepage heading' },
    }),
    storefrontHomepageDescription: text({
      db: { isNullable: true },
      validation: { length: { max: 320 } },
      ui: { displayMode: 'textarea', description: 'Public storefront homepage description' },
    }),
    storefrontContactEmail: text({ validation: { length: { max: 254 } }, ui: { description: 'Public customer service email' } }),
    storefrontContactPhone: text({ validation: { length: { max: 40 } }, ui: { description: 'Public customer service phone' } }),
    storefrontServiceHours: text({ validation: { length: { max: 200 } }, ui: { description: 'Public customer service hours' } }),
    users: relationship({ ref: 'User.carrier', many: true, access: { create: () => false, update: () => false } }),
    roles: relationship({ ref: 'Role.carrier', many: true, access: { create: () => false, update: () => false } }),
    approvedAgents: relationship({ ref: 'ApprovedAgent.carrier', many: true, access: { create: () => false, update: () => false } }),
    routes: relationship({ ref: 'Route.carrier', many: true, access: { create: () => false, update: () => false } }),
    schedules: relationship({ ref: 'FlightSchedule.carrier', many: true, access: { create: () => false, update: () => false } }),
    flightInstances: relationship({ ref: 'FlightInstance.carrier', many: true, access: { create: () => false, update: () => false } }),
    bookings: relationship({ ref: 'Booking.carrier', many: true, access: { create: () => false, update: () => false } }),
    serviceObligations: relationship({ ref: 'ServiceObligation.carrier', many: true, access: { create: () => false, update: () => false } }),
    ticketCouponLineages: relationship({ ref: 'TicketCouponLineage.carrier', many: true, access: { create: () => false, update: () => false } }),
    providerConnections: relationship({ ref: 'ProviderConnection.carrier', many: true, access: { create: () => false, update: () => false } }),
    stationAssignments: relationship({ ref: 'StationAssignment.carrier', many: true, access: { create: () => false, update: () => false } }),
    documentVerifications: relationship({ ref: 'DocumentVerification.carrier', many: true, access: { create: () => false, update: () => false } }),
    machineCredentials: relationship({ ref: 'MachineCredential.carrier', many: true, access: { create: () => false, update: () => false } }),
    outboxEvents: relationship({ ref: 'OutboxEvent.carrier', many: true, access: { create: () => false, update: () => false } }),
    manualPaymentEvidence: relationship({ ref: 'ManualPaymentEvidence.carrier', many: true, access: { create: () => false, update: () => false } }),
    settlementLedgerEntries: relationship({ ref: 'SettlementLedgerEntry.carrier', many: true, access: { create: () => false, update: () => false } }),
    onboardingSteps: relationship({ ref: 'OnboardingStep.carrier', many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields,
  },
  hooks: {
    async validate({ operation, resolvedData, item, context, addValidationError }: any) {
      const timezone = resolvedData.defaultTimezone
      if (resolvedData.defaultCurrencyCode !== undefined && !ONBOARDING_CURRENCIES.includes(resolvedData.defaultCurrencyCode)) {
        addValidationError(`Default currency must be one of ${ONBOARDING_CURRENCIES.join(', ')}.`)
      }
      if (timezone !== undefined) {
        try { new Intl.DateTimeFormat('en-US', { timeZone: String(timezone) }) } catch { addValidationError('Default timezone must be an IANA timezone such as America/New_York.') }
      }
      if (operation !== 'update') return
      // Fares, inventory, and local schedule times are fixed in the carrier's code, currency, and timezone.
      const changed = (['code', 'defaultCurrencyCode', 'defaultTimezone'] as const).filter(field => resolvedData[field] !== undefined && resolvedData[field] !== item?.[field])
      if (!changed.length) return
      const carrierId = item?.id
      const [bookings, flights, offers, buckets] = await Promise.all([
        context.prisma.booking.count({ where: { carrierId } }),
        context.prisma.flightInstance.count({ where: { carrierId } }),
        context.prisma.offer.count({ where: { carrierId } }),
        context.prisma.inventoryBucket.count({ where: { carrierId } }),
      ])
      if (bookings + flights + offers + buckets > 0) addValidationError('Carrier code, currency, and timezone are immutable after commercial records exist.')
    },
  },
})
