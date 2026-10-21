import { list } from '@keystone-6/core'
import { checkbox, integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql, hasFreshPermission } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, requiredRelationshipHooks } from '../lib/validation'
import { hiddenSensitiveUi, immutableFieldAccess } from './fields'
import { trackingFields } from './trackingFields'

const manageIntegrations = (args: any) => hasFreshPermission(args, 'canManageIntegrations')

export const WebhookEvent = list({
  access: commandOnlyCarrierAccess('canReadIntegrations', 'canManageIntegrations'),
  graphql: commandOnlyGraphql(),
  ui: { labelField: 'eventKey', listView: { initialColumns: ['eventKey', 'direction', 'eventType', 'status', 'attemptCount', 'occurredAt'] }, hideDelete: true },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    eventKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    dedupeKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    providerEventId: text({ isIndexed: true, access: immutableFieldAccess }),
    connection: relationship({ ref: 'ProviderConnection.webhookEvents', access: immutableFieldAccess }),
    endpoint: relationship({ ref: 'WebhookEndpoint.events', access: immutableFieldAccess }),
    direction: select({ type: 'enum', validation: { isRequired: true }, access: immutableFieldAccess, options: [
      { label: 'Inbound', value: 'inbound' }, { label: 'Outbound', value: 'outbound' },
    ] }),
    eventType: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    resourceType: text({ access: immutableFieldAccess }),
    resourceId: text({ access: immutableFieldAccess }),
    status: select({ type: 'enum', defaultValue: 'pending', options: [
      { label: 'Pending', value: 'pending' }, { label: 'Processing', value: 'processing' },
      { label: 'Succeeded', value: 'succeeded' }, { label: 'Failed', value: 'failed' },
      { label: 'Dead lettered', value: 'dead_lettered' },
    ] }),
    signatureVerified: checkbox({ defaultValue: false }),
    payload: json({
      access: { read: manageIntegrations, create: manageIntegrations, update: manageIntegrations },
      ui: hiddenSensitiveUi,
    }),
    payloadSummary: json({ defaultValue: {} }),
    attemptCount: integer({ defaultValue: 0, validation: { min: 0 } }),
    occurredAt: timestamp({ defaultValue: { kind: 'now' }, access: immutableFieldAccess }),
    lastAttemptedAt: timestamp(), nextAttemptAt: timestamp(), completedAt: timestamp(),
    responseStatus: integer(), errorCode: text(), errorMessage: text(),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier']),
    lifecycleHooks('webhookEvent'),
  ),
})
