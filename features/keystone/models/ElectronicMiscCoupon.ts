import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, minorAmountHooks, requiredRelationshipHooks } from '../lib/validation'
import { immutableFieldAccess } from './fields'
import { trackingFields } from './trackingFields'

export const ElectronicMiscCoupon = list({
  access: commandOnlyCarrierAccess('canReadTicketing', 'canManageTicketing'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'couponKey',
    listView: { initialColumns: ['document', 'couponNumber', 'bookingSegment', 'ancillaryProduct', 'status', 'amount'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    couponKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    document: relationship({ ref: 'ElectronicMiscDocument.coupons', access: immutableFieldAccess }),
    couponNumber: integer({ validation: { isRequired: true, min: 1 }, access: immutableFieldAccess }),
    bookingSegment: relationship({ ref: 'BookingSegment.electronicMiscCoupons', access: immutableFieldAccess }),
    ancillaryProduct: relationship({ ref: 'AncillaryProduct.electronicMiscCoupons', access: immutableFieldAccess }),
    bookingLineItem: relationship({ ref: 'BookingLineItem', access: immutableFieldAccess }),
    status: select({
      type: 'enum',
      defaultValue: 'open',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Used', value: 'used' },
        { label: 'Voided', value: 'voided' },
        { label: 'Refunded', value: 'refunded' },
        { label: 'Exchanged', value: 'exchanged' },
      ],
    }),
    amount: integer({ defaultValue: 0, validation: { min: 0 }, access: immutableFieldAccess }),
    currencyCode: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    usedAt: timestamp(),
    entitlementSnapshot: json({ defaultValue: {}, access: immutableFieldAccess }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'document']),
    lifecycleHooks('electronicMiscCoupon'),
    minorAmountHooks(['amount']),
  ),
})
