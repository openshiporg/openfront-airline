import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql, hasFreshPermission } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, requiredRelationshipHooks } from '../lib/validation'
import { hiddenSensitiveUi } from './fields'
import { trackingFields } from './trackingFields'

const manageIntegrations = (args: any) => hasFreshPermission(args, 'canManageIntegrations')

export const ProviderConnection = list({
  access: commandOnlyCarrierAccess('canReadIntegrations', 'canManageIntegrations'),
  graphql: commandOnlyGraphql(),
  ui: { labelField: 'name', listView: { initialColumns: ['name', 'provider', 'status', 'externalAccountId', 'lastSucceededAt'] }, hideDelete: true },
  fields: {
    carrier: relationship({ ref: 'Carrier.providerConnections' }),
    connectionKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    provider: relationship({ ref: 'IntegrationProvider.connections' }),
    name: text({ validation: { isRequired: true } }),
    status: select({ type: 'enum', defaultValue: 'pending', options: [
      { label: 'Pending', value: 'pending' }, { label: 'Active', value: 'active' },
      { label: 'Paused', value: 'paused' }, { label: 'Failed', value: 'failed' },
      { label: 'Revoked', value: 'revoked' },
    ] }),
    credentials: json({
      defaultValue: {},
      access: { read: denyAll, create: manageIntegrations, update: manageIntegrations },
      ui: hiddenSensitiveUi,
    }),
    configuration: json({ defaultValue: {} }),
    capabilities: json({ defaultValue: [] }),
    externalAccountId: text(),
    lastAttemptedAt: timestamp(), lastSucceededAt: timestamp(),
    lastErrorCode: text(), lastErrorMessage: text(),
    webhookEndpoints: relationship({ ref: 'WebhookEndpoint.connection', many: true }),
    webhookEvents: relationship({ ref: 'WebhookEvent.connection', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'provider']),
    lifecycleHooks('providerConnection'),
  ),
})
