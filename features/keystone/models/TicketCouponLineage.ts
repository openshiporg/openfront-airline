import { list } from '@keystone-6/core'
import { json, relationship, select, text } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { combineListHooks, requiredRelationshipHooks } from '../lib/validation'
import { immutableFieldAccess } from './fields'
import { addPrismaModelAttribute, requirePrismaRelations } from '../lib/prisma-schema-constraints'
import { trackingFields } from './trackingFields'

export const TicketCouponLineage = list({
  // NOT NULL ownership/coupon links and the parent/child unique pair from migration 20260923044000.
  db: {
    extendPrismaSchema: schema => addPrismaModelAttribute(
      requirePrismaRelations(schema, ['carrier', 'bookingPassenger', 'parentCoupon', 'childCoupon']),
      '@@unique([parentCouponId, childCouponId], map: "TicketCouponLineage_parentCoupon_childCoupon_key")',
    ),
  },
  access: commandOnlyCarrierAccess('canReadTicketing', 'canManageTicketing'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'lineageKey',
    listView: { initialColumns: ['lineageKey', 'transformation', 'parentCoupon', 'childCoupon', 'changeSetKey'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier.ticketCouponLineages', access: immutableFieldAccess }),
    bookingPassenger: relationship({ ref: 'BookingPassenger.ticketCouponLineages', access: immutableFieldAccess }),
    lineageKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    changeSetKey: text({ isIndexed: true, validation: { isRequired: true }, access: immutableFieldAccess }),
    transformation: select({
      type: 'enum',
      validation: { isRequired: true },
      access: immutableFieldAccess,
      options: [
        { label: 'Alternative', value: 'alternative' },
        { label: 'Connection split', value: 'split' },
        { label: 'Consolidation', value: 'consolidation' },
      ],
    }),
    operationType: select({
      type: 'enum',
      validation: { isRequired: true },
      access: immutableFieldAccess,
      options: [
        { label: 'Exchange', value: 'exchange' },
        { label: 'Reaccommodation', value: 'reaccommodation' },
        { label: 'Servicing', value: 'servicing' },
      ],
    }),
    operationId: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    parentCoupon: relationship({ ref: 'TicketCoupon.lineageAsParent', access: immutableFieldAccess }),
    childCoupon: relationship({ ref: 'TicketCoupon.lineageAsChild', access: immutableFieldAccess }),
    metadata: json({ defaultValue: {}, access: immutableFieldAccess }),
    ...trackingFields,
  },
  hooks: combineListHooks(requiredRelationshipHooks(['carrier', 'bookingPassenger', 'parentCoupon', 'childCoupon'])),
})
