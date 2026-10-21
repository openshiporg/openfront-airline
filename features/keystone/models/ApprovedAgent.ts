import { list } from '@keystone-6/core'
import { json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import {
  canCreateForSessionCarrier,
  canUpdateForSessionCarrier,
  freshCarrierFilter,
  hasFreshPermission,
} from '../access'
import {
  chronologicalRangeHooks,
  combineListHooks,
  commandOwnedRelationshipHooks,
  requiredRelationshipHooks,
} from '../lib/validation'
import { trackingFields } from './trackingFields'

const canReadAgents = (args: any) => hasFreshPermission(args, 'canManageAgents', 'canReadOffers', 'canReadBookings')

export const ApprovedAgent = list({
  access: {
    operation: {
      query: canReadAgents,
      create: args => hasFreshPermission(args, 'canManageAgents'),
      update: args => hasFreshPermission(args, 'canManageAgents'),
      delete: () => false,
    },
    filter: {
      query: freshCarrierFilter,
      update: freshCarrierFilter,
    },
    item: {
      create: canCreateForSessionCarrier,
      update: canUpdateForSessionCarrier,
    },
  },
  ui: {
    labelField: 'legalName',
    listView: { initialColumns: ['legalName', 'tradingName', 'status', 'accreditationNumber', 'validTo'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier.approvedAgents' }),
    legalName: text({ validation: { isRequired: true } }),
    tradingName: text(),
    externalReference: text({ isIndexed: true }),
    accreditationType: select({
      type: 'enum',
      defaultValue: 'other',
      options: [
        { label: 'IATA', value: 'iata' },
        { label: 'TIDS', value: 'tids' },
        { label: 'ARC', value: 'arc' },
        { label: 'Carrier appointed', value: 'carrier_appointed' },
        { label: 'Other', value: 'other' },
      ],
    }),
    accreditationNumber: text({ isIndexed: true }),
    status: select({
      type: 'enum',
      defaultValue: 'pending',
      validation: { isRequired: true },
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Revoked', value: 'revoked' },
        { label: 'Expired', value: 'expired' },
      ],
    }),
    validFrom: timestamp(),
    validTo: timestamp(),
    salesChannels: json({ defaultValue: [] }),
    servicingScopes: json({ defaultValue: [] }),
    contactEmail: text(),
    contactPhone: text(),
    users: relationship({ ref: 'User.approvedAgent', many: true, access: { create: () => false, update: () => false } }),
    offers: relationship({ ref: 'Offer.approvedAgent', many: true }),
    bookings: relationship({ ref: 'Booking.approvedAgent', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier']),
    commandOwnedRelationshipHooks(['offers', 'bookings']),
    chronologicalRangeHooks('validFrom', 'validTo', 'Agent approval'),
  ),
})
