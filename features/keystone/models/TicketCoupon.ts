import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, minorAmountHooks, requiredRelationshipHooks } from '../lib/validation'
import { immutableFieldAccess } from './fields'
import { requirePrismaRelations } from '../lib/prisma-schema-constraints'
import { trackingFields } from './trackingFields'

export const TicketCoupon = list({
  // NOT NULL service obligation (and version) from migration 20260923044000; see prisma-schema-constraints.ts.
  db: { extendPrismaSchema: schema => requirePrismaRelations(schema, ['serviceObligation']) },
  access: commandOnlyCarrierAccess('canReadTicketing', 'canManageTicketing'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'couponKey',
    listView: { initialColumns: ['ticket', 'couponNumber', 'bookingSegment', 'status', 'amount'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    couponKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    ticket: relationship({ ref: 'Ticket.coupons', access: immutableFieldAccess }),
    serviceObligation: relationship({ ref: 'ServiceObligation.ticketCoupons', access: immutableFieldAccess }),
    serviceObligationVersion: integer({ validation: { isRequired: true, min: 1 }, db: { isNullable: false }, access: immutableFieldAccess }),
    bookingSegment: relationship({ ref: 'BookingSegment.ticketCoupons', access: immutableFieldAccess }),
    couponNumber: integer({ validation: { isRequired: true, min: 1 }, access: immutableFieldAccess }),
    status: select({
      type: 'enum',
      defaultValue: 'open',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Checked in', value: 'checked_in' },
        { label: 'Boarded', value: 'boarded' },
        { label: 'Flown', value: 'flown' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Voided', value: 'voided' },
        { label: 'Refunded', value: 'refunded' },
        { label: 'Exchanged', value: 'exchanged' },
      ],
    }),
    fareBasisCode: text({ access: immutableFieldAccess }),
    bookingClassCode: text({ access: immutableFieldAccess }),
    amount: integer({ defaultValue: 0, validation: { min: 0 }, access: immutableFieldAccess }),
    currencyCode: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    usedAt: timestamp(),
    entitlementSnapshot: json({ defaultValue: {}, access: immutableFieldAccess }),
    checkedInAt: timestamp(),
    checkIns: relationship({ ref: 'CheckIn.ticketCoupon', many: true }),
    bags: relationship({ ref: 'Bag.ticketCoupon', many: true }),
    lineageAsParent: relationship({ ref: 'TicketCouponLineage.parentCoupon', many: true }),
    lineageAsChild: relationship({ ref: 'TicketCouponLineage.childCoupon', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'ticket', 'bookingSegment', 'serviceObligation']),
    lifecycleHooks('ticketCoupon'),
    minorAmountHooks(['amount']),
  ),
})
