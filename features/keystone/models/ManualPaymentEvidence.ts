import { list } from '@keystone-6/core'
import { integer, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { combineListHooks, minorAmountHooks, requiredRelationshipHooks } from '../lib/validation'
import { immutableFieldAccess } from './fields'
import { trackingFields } from './trackingFields'

export const ManualPaymentEvidence = list({
  access: commandOnlyCarrierAccess('canReadPayments', 'canManagePayments'),
  graphql: commandOnlyGraphql(),
  ui: { labelField: 'evidenceKey', hideCreate: true, hideDelete: true, listView: { initialColumns: ['booking', 'purpose', 'externalReference', 'amount', 'currencyCode', 'status', 'submittedBy', 'approvedBy'] } },
  fields: {
    carrier: relationship({ ref: 'Carrier.manualPaymentEvidence', access: immutableFieldAccess }),
    evidenceKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    purpose: select({ type: 'enum', options: [{ label: 'Capture', value: 'capture' }, { label: 'Refund', value: 'refund' }], validation: { isRequired: true }, access: immutableFieldAccess }),
    booking: relationship({ ref: 'Booking.manualPaymentEvidence', access: immutableFieldAccess }),
    payment: relationship({ ref: 'Payment.manualPaymentEvidence', access: immutableFieldAccess }),
    ledgerEntry: relationship({ ref: 'SettlementLedgerEntry.evidence', access: immutableFieldAccess }),
    externalReference: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    ledgerSource: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    evidenceDigest: text({ isIndexed: true, validation: { isRequired: true, match: { regex: /^[a-f0-9]{64}$/i, explanation: 'Use a SHA-256 evidence digest.' } }, access: immutableFieldAccess }),
    amount: integer({ validation: { isRequired: true, min: 1 }, access: immutableFieldAccess }),
    currencyCode: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    status: select({ type: 'enum', defaultValue: 'submitted', options: [
      { label: 'Submitted', value: 'submitted' }, { label: 'Approved', value: 'approved' }, { label: 'Rejected', value: 'rejected' }, { label: 'Consumed', value: 'consumed' },
    ] }),
    submittedBy: relationship({ ref: 'User.submittedPaymentEvidence', access: immutableFieldAccess }),
    approvedBy: relationship({ ref: 'User.approvedPaymentEvidence' }),
    submittedAt: timestamp({ defaultValue: { kind: 'now' }, access: immutableFieldAccess }),
    approvedAt: timestamp(),
    consumedAt: timestamp(),
    rejectionReason: text(),
    ...trackingFields,
  },
  hooks: combineListHooks(requiredRelationshipHooks(['carrier', 'booking', 'ledgerEntry', 'submittedBy']), minorAmountHooks(['amount'])),
})
