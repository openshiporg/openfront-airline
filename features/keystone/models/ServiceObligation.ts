import { list } from '@keystone-6/core'
import { integer, relationship, select, text } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { combineListHooks, requiredRelationshipHooks } from '../lib/validation'
import { immutableFieldAccess } from './fields'
import { requirePrismaRelations } from '../lib/prisma-schema-constraints'
import { trackingFields } from './trackingFields'

export const ServiceObligation = list({
  // NOT NULL carrier/booking/passenger ownership from migration 20260923044000; see prisma-schema-constraints.ts.
  db: { extendPrismaSchema: schema => requirePrismaRelations(schema, ['carrier', 'booking', 'bookingPassenger']) },
  access: commandOnlyCarrierAccess('canReadTicketing', 'canManageTicketing'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'obligationKey',
    listView: { initialColumns: ['obligationKey', 'bookingPassenger', 'currentVersion', 'status'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier.serviceObligations', access: immutableFieldAccess }),
    booking: relationship({ ref: 'Booking.serviceObligations', access: immutableFieldAccess }),
    bookingPassenger: relationship({ ref: 'BookingPassenger.serviceObligations', access: immutableFieldAccess }),
    obligationKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    currentVersion: integer({ defaultValue: 1, validation: { isRequired: true, min: 1 }, access: immutableFieldAccess }),
    status: select({
      type: 'enum',
      defaultValue: 'active',
      validation: { isRequired: true },
      access: immutableFieldAccess,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Fulfilled', value: 'fulfilled' },
        { label: 'Retired', value: 'retired' },
      ],
    }),
    ticketCoupons: relationship({ ref: 'TicketCoupon.serviceObligation', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(requiredRelationshipHooks(['carrier', 'booking', 'bookingPassenger'])),
})
