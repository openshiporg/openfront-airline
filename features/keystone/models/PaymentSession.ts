import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql, hasFreshPermission } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, minorAmountHooks, requiredRelationshipHooks } from '../lib/validation'
import { hiddenSensitiveUi } from './fields'
import { trackingFields } from './trackingFields'

const canManagePayments = (args: any) => hasFreshPermission(args, 'canManagePayments')

export const PaymentSession = list({
  access: commandOnlyCarrierAccess('canReadPayments', 'canManagePayments'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'sessionKey',
    listView: { initialColumns: ['sessionKey', 'booking', 'provider', 'status', 'amount', 'currencyCode', 'expiresAt'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    sessionKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    idempotencyKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    booking: relationship({ ref: 'Booking.paymentSessions' }),
    provider: relationship({ ref: 'PaymentProvider.sessions' }),
    payment: relationship({ ref: 'Payment.session' }),
    status: select({
      type: 'enum',
      defaultValue: 'created',
      options: [
        { label: 'Created', value: 'created' },
        { label: 'Pending', value: 'pending' },
        { label: 'Authorized', value: 'authorized' },
        { label: 'Captured', value: 'captured' },
        { label: 'Failed', value: 'failed' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Expired', value: 'expired' },
      ],
    }),
    amount: integer({ validation: { isRequired: true, min: 0 } }),
    currencyCode: text({ validation: { isRequired: true } }),
    providerSessionId: text({ isIndexed: true }),
    providerData: json({
      defaultValue: {},
      access: { read: canManagePayments, create: canManagePayments, update: canManagePayments },
      ui: hiddenSensitiveUi,
    }),
    expiresAt: timestamp(),
    authorizedAt: timestamp(),
    completedAt: timestamp(),
    failureCode: text(),
    failureMessage: text(),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'booking', 'provider']),
    lifecycleHooks('paymentSession'),
    minorAmountHooks(['amount']),
  ),
})
