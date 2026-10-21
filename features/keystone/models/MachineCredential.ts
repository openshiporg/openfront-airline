import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { hiddenSensitiveUi, immutableFieldAccess } from './fields'
import { requiredRelationshipHooks } from '../lib/validation'
import { trackingFields } from './trackingFields'

export const MachineCredential = list({
  access: commandOnlyCarrierAccess('canReadIntegrations', 'canManageIntegrations'),
  graphql: commandOnlyGraphql(),
  ui: { labelField: 'name', hideCreate: true, hideDelete: true, listView: { initialColumns: ['name', 'keyId', 'audience', 'status', 'expiresAt', 'lastUsedAt'] } },
  fields: {
    carrier: relationship({ ref: 'Carrier.machineCredentials', access: immutableFieldAccess }),
    name: text({ validation: { isRequired: true } }),
    keyId: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    tokenHash: text({ isIndexed: 'unique', validation: { isRequired: true }, access: { read: denyAll, create: denyAll, update: denyAll }, ui: hiddenSensitiveUi }),
    tokenPreview: text({ access: immutableFieldAccess }),
    audience: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    scopes: json({ defaultValue: [], access: immutableFieldAccess }),
    status: select({ type: 'enum', defaultValue: 'active', options: [
      { label: 'Active', value: 'active' }, { label: 'Revoked', value: 'revoked' }, { label: 'Expired', value: 'expired' },
    ] }),
    expiresAt: timestamp({ validation: { isRequired: true }, access: immutableFieldAccess }),
    lastUsedAt: timestamp(),
    revokedAt: timestamp(),
    ...trackingFields,
  },
  hooks: requiredRelationshipHooks(['carrier']),
})
