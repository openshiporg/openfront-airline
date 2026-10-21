import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, minorAmountHooks, requiredRelationshipHooks } from '../lib/validation'
import { immutableFieldAccess } from './fields'
import { trackingFields } from './trackingFields'

export const Exchange = list({
  access: commandOnlyCarrierAccess('canReadPayments', 'canManagePayments'),
  graphql: commandOnlyGraphql(),
  ui: { labelField: 'exchangeKey', listView: { initialColumns: ['exchangeKey', 'booking', 'status', 'priceDifferenceAmount', 'changeFeeAmount', 'quoteExpiresAt'] }, hideDelete: true },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    exchangeKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    idempotencyKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    booking: relationship({ ref: 'Booking.exchanges', access: immutableFieldAccess }),
    status: select({ type: 'enum', defaultValue: 'quoted', options: [
      { label: 'Quoted', value: 'quoted' }, { label: 'Accepted', value: 'accepted' },
      { label: 'Processing', value: 'processing' }, { label: 'Completed', value: 'completed' },
      { label: 'Failed', value: 'failed' }, { label: 'Cancelled', value: 'cancelled' },
      { label: 'Expired', value: 'expired' },
    ] }),
    originalSegments: relationship({ ref: 'BookingSegment.exchangesAsOriginal', many: true, access: immutableFieldAccess }),
    replacementSegments: relationship({ ref: 'BookingSegment.exchangesAsReplacement', many: true }),
    priceDifferenceAmount: integer({ defaultValue: 0, validation: { min: 0 }, access: immutableFieldAccess }),
    changeFeeAmount: integer({ defaultValue: 0, validation: { min: 0 }, access: immutableFieldAccess }),
    additionalCollectionAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    refundAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    currencyCode: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    quoteExpiresAt: timestamp({ access: immutableFieldAccess }),
    acceptedAt: timestamp(), completedAt: timestamp(),
    reason: text(), pricingSnapshot: json({ defaultValue: {}, access: immutableFieldAccess }),
    metadata: json({ defaultValue: {} }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'booking']),
    lifecycleHooks('exchange'),
    minorAmountHooks(['priceDifferenceAmount', 'changeFeeAmount', 'additionalCollectionAmount', 'refundAmount']),
  ),
})
