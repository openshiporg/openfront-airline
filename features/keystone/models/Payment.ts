import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'
import { denyAll } from '@keystone-6/core/access'

import { commandOnlyCarrierAccess, commandOnlyGraphql, hasFreshPermission } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, minorAmountHooks, requiredRelationshipHooks } from '../lib/validation'
import { hiddenSensitiveUi, immutableFieldAccess } from './fields'
import { trackingFields } from './trackingFields'

const managePayments = (args: any) => hasFreshPermission(args, 'canManagePayments')

export const Payment = list({
  access: commandOnlyCarrierAccess('canReadPayments', 'canManagePayments'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'paymentKey',
    listView: { initialColumns: ['paymentKey', 'booking', 'provider', 'status', 'amount', 'capturedAmount', 'refundedAmount'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    paymentKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    idempotencyKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    booking: relationship({ ref: 'Booking.payments', access: immutableFieldAccess }),
    provider: relationship({ ref: 'PaymentProvider.payments', access: immutableFieldAccess }),
    session: relationship({ ref: 'PaymentSession.payment', access: immutableFieldAccess }),
    status: select({
      type: 'enum', defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' }, { label: 'Authorized', value: 'authorized' },
        { label: 'Captured', value: 'captured' }, { label: 'Partially refunded', value: 'partially_refunded' },
        { label: 'Refunded', value: 'refunded' }, { label: 'Failed', value: 'failed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    }),
    amount: integer({ validation: { isRequired: true, min: 0 }, access: immutableFieldAccess }),
    authorizedAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    capturedAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    refundedAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    currencyCode: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    providerPaymentId: text({ isIndexed: true, access: immutableFieldAccess }),
    providerCaptureId: text(),
    instrumentBrand: text(),
    instrumentLast4: text({
      db: { isNullable: true },
      validation: { match: { regex: /^\d{4}$/, explanation: 'Store only four digits.' } },
    }),
    rawProviderData: json({ access: { read: denyAll, create: managePayments, update: managePayments }, ui: hiddenSensitiveUi }),
    failureCode: text(), failureMessage: text(),
    authorizedAt: timestamp(), capturedAt: timestamp(), cancelledAt: timestamp(),
    refunds: relationship({ ref: 'Refund.payment', many: true }),
    manualPaymentEvidence: relationship({ ref: 'ManualPaymentEvidence.payment', many: true }),
    metadata: json({ defaultValue: {} }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'booking', 'provider']),
    lifecycleHooks('payment'),
    minorAmountHooks(['amount', 'authorizedAmount', 'capturedAmount', 'refundedAmount']),
  ),
})
