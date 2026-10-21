import { list } from '@keystone-6/core'
import { json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyGraphql, freshCarrierFilter, hasFreshPermission } from '../access'
import { requiredRelationshipHooks } from '../lib/validation'
import { trackingFields } from './trackingFields'

export const AuditEvent = list({
  access: {
    operation: {
      query: args => hasFreshPermission(args, 'canReadAudit'),
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: freshCarrierFilter },
  },
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'eventKey',
    listView: { initialColumns: ['action', 'aggregateType', 'aggregateId', 'actor', 'occurredAt'] },
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: 'read' },
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    eventKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    action: text({ validation: { isRequired: true } }),
    aggregateType: text({ validation: { isRequired: true } }),
    aggregateId: text({ validation: { isRequired: true } }),
    actor: relationship({ ref: 'User.auditEvents' }),
    approvedAgent: relationship({ ref: 'ApprovedAgent' }),
    source: select({ type: 'enum', defaultValue: 'platform', options: [
      { label: 'Platform', value: 'platform' }, { label: 'Storefront', value: 'storefront' },
      { label: 'Approved agent', value: 'agent' }, { label: 'Provider', value: 'provider' },
      { label: 'System', value: 'system' },
    ] }),
    correlationId: text({ isIndexed: true }),
    idempotencyKey: text({ isIndexed: true }),
    beforeSummary: json({ defaultValue: {} }),
    afterSummary: json({ defaultValue: {} }),
    metadata: json({ defaultValue: {} }),
    ipAddress: text(), userAgent: text(),
    occurredAt: timestamp({ defaultValue: { kind: 'now' }, validation: { isRequired: true }, isIndexed: true }),
    ...trackingFields,
  },
  hooks: requiredRelationshipHooks(['carrier']),
})
