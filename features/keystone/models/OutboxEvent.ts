import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { addPrismaModelAttribute } from '../lib/prisma-schema-constraints'
import { requiredRelationshipHooks } from '../lib/validation'
import { immutableFieldAccess } from './fields'
import { trackingFields } from './trackingFields'

export const OutboxEvent = list({
  // Queue-eligibility indexes for the worker's every-cycle scans (claimOutboxEvents ready/stale-lease branches and the
  // dead-letter count). Additive only; the forward migration is generated from this model, never hand-written.
  db: {
    extendPrismaSchema: schema => addPrismaModelAttribute(
      addPrismaModelAttribute(schema, '@@index([status, availableAt, createdAt], map: "OutboxEvent_status_availableAt_createdAt_idx")'),
      '@@index([status, leasedAt], map: "OutboxEvent_status_leasedAt_idx")',
    ),
  },
  access: commandOnlyCarrierAccess('canReadAudit', 'canManageIntegrations'),
  graphql: commandOnlyGraphql(),
  ui: { labelField: 'eventKey', hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: 'read' }, listView: { initialColumns: ['topic', 'aggregateType', 'aggregateId', 'status', 'attemptCount', 'availableAt'] } },
  fields: {
    carrier: relationship({ ref: 'Carrier.outboxEvents', access: immutableFieldAccess }),
    eventKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    topic: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    aggregateType: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    aggregateId: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    payload: json({ defaultValue: {}, access: immutableFieldAccess }),
    status: select({ type: 'enum', defaultValue: 'pending', options: [
      { label: 'Pending', value: 'pending' }, { label: 'Processing', value: 'processing' }, { label: 'Delivered', value: 'delivered' }, { label: 'Failed', value: 'failed' }, { label: 'Dead lettered', value: 'dead_lettered' },
    ] }),
    attemptCount: integer({ defaultValue: 0, validation: { min: 0 } }),
    availableAt: timestamp({ defaultValue: { kind: 'now' } }),
    leasedAt: timestamp(),
    leaseOwner: text(),
    lastError: text(),
    deliveredAt: timestamp(),
    ...trackingFields,
  },
  hooks: requiredRelationshipHooks(['carrier']),
})
