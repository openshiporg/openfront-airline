import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyGraphql, freshCarrierFilter, hasFreshPermission } from '../access'
import { hiddenSensitiveUi } from './fields'
import { trackingFields } from './trackingFields'

export const IdempotencyKey = list({
  access: {
    operation: {
      query: args => hasFreshPermission(args, 'canReadAudit', 'canManageIntegrations'),
      create: () => false, update: () => false, delete: () => false,
    },
    filter: { query: freshCarrierFilter },
  },
  graphql: commandOnlyGraphql(),
  ui: { labelField: 'key', listView: { initialColumns: ['key', 'scope', 'status', 'resourceType', 'resourceId', 'createdAt'] }, hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: 'read' } },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    key: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    scope: text({ validation: { isRequired: true } }),
    requestHash: text({ validation: { isRequired: true } }),
    status: select({ type: 'enum', defaultValue: 'started', options: [
      { label: 'Started', value: 'started' }, { label: 'Completed', value: 'completed' },
      { label: 'Failed', value: 'failed' },
    ] }),
    actor: relationship({ ref: 'User' }),
    approvedAgent: relationship({ ref: 'ApprovedAgent' }),
    resourceType: text(), resourceId: text(),
    result: json({ access: { read: denyAll, create: () => false, update: () => false }, ui: hiddenSensitiveUi }),
    lockedAt: timestamp({ defaultValue: { kind: 'now' } }),
    completedAt: timestamp(), expiresAt: timestamp(),
    ...trackingFields,
  },
})
