import { list } from '@keystone-6/core'
import { integer, json, relationship, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { combineListHooks, minorAmountHooks, requiredRelationshipHooks } from '../lib/validation'
import { immutableFieldAccess } from './fields'
import { trackingFields } from './trackingFields'

export const SettlementLedgerEntry = list({
  access: commandOnlyCarrierAccess('canReadPayments', 'canManagePayments'),
  graphql: commandOnlyGraphql(),
  ui: { labelField: 'externalReference', hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: 'read' }, listView: { initialColumns: ['externalReference', 'ledgerSource', 'amount', 'currencyCode', 'occurredAt', 'importedAt'] } },
  fields: {
    carrier: relationship({ ref: 'Carrier.settlementLedgerEntries', access: immutableFieldAccess }),
    connection: relationship({ ref: 'ProviderConnection', access: immutableFieldAccess }),
    ledgerKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    externalReference: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    ledgerSource: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    evidenceDigest: text({ isIndexed: true, validation: { isRequired: true, match: { regex: /^[a-f0-9]{64}$/i, explanation: 'Use a SHA-256 evidence digest.' } }, access: immutableFieldAccess }),
    amount: integer({ validation: { isRequired: true, min: 1 }, access: immutableFieldAccess }),
    currencyCode: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    occurredAt: timestamp({ validation: { isRequired: true }, access: immutableFieldAccess }),
    importedAt: timestamp({ defaultValue: { kind: 'now' }, access: immutableFieldAccess }),
    importedByCredentialId: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    sourceMetadata: json({ defaultValue: {}, access: immutableFieldAccess }),
    evidence: relationship({ ref: 'ManualPaymentEvidence.ledgerEntry', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(requiredRelationshipHooks(['carrier']), minorAmountHooks(['amount'])),
})
