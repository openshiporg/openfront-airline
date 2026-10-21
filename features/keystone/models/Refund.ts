import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, minorAmountHooks, requiredRelationshipHooks } from '../lib/validation'
import { immutableFieldAccess } from './fields'
import { trackingFields } from './trackingFields'

export const Refund = list({
  access: commandOnlyCarrierAccess('canReadPayments', 'canManagePayments'),
  graphql: commandOnlyGraphql(),
  ui: { labelField: 'refundKey', listView: { initialColumns: ['refundKey', 'booking', 'payment', 'status', 'amount', 'reason'] }, hideDelete: true },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    refundKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    idempotencyKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    booking: relationship({ ref: 'Booking.refunds', access: immutableFieldAccess }),
    payment: relationship({ ref: 'Payment.refunds', access: immutableFieldAccess }),
    status: select({ type: 'enum', defaultValue: 'requested', options: [
      { label: 'Requested', value: 'requested' }, { label: 'Approved', value: 'approved' },
      { label: 'Processing', value: 'processing' }, { label: 'Succeeded', value: 'succeeded' },
      { label: 'Failed', value: 'failed' }, { label: 'Cancelled', value: 'cancelled' },
    ] }),
    reason: select({ type: 'enum', defaultValue: 'customer_request', options: [
      { label: 'Customer request', value: 'customer_request' }, { label: 'Disruption', value: 'disruption' },
      { label: 'Schedule change', value: 'schedule_change' }, { label: 'Duplicate', value: 'duplicate' },
      { label: 'Fraud', value: 'fraud' }, { label: 'Other', value: 'other' },
    ] }),
    amount: integer({ validation: { isRequired: true, min: 0 }, access: immutableFieldAccess }),
    currencyCode: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    providerRefundId: text({ isIndexed: true }),
    note: text({ ui: { displayMode: 'textarea' } }),
    requestedAt: timestamp({ defaultValue: { kind: 'now' }, access: immutableFieldAccess }),
    approvedAt: timestamp(), processedAt: timestamp(),
    errorMessage: text(), metadata: json({ defaultValue: {} }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'booking', 'payment']),
    lifecycleHooks('refund'),
    minorAmountHooks(['amount']),
  ),
})
