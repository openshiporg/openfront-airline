import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { assertExternalWebhookUrl } from '../../integrations/webhook-url'
import { carrierScopedAccess, hasFreshPermission } from '../access'
import { carrierRelationshipHooks, combineListHooks, requiredRelationshipHooks } from '../lib/validation'
import { hiddenSensitiveUi } from './fields'
import { trackingFields } from './trackingFields'

const manageIntegrations = (args: any) => hasFreshPermission(args, 'canManageIntegrations')

export const WebhookEndpoint = list({
  access: carrierScopedAccess('canReadIntegrations', 'canManageIntegrations'),
  ui: { labelField: 'name', listView: { initialColumns: ['name', 'url', 'status', 'failureCount', 'lastDeliveredAt'] }, hideDelete: true },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    endpointKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    connection: relationship({ ref: 'ProviderConnection.webhookEndpoints' }),
    name: text({ validation: { isRequired: true } }),
    url: text({
      validation: { isRequired: true },
      // Stored normalized, so the value the worker dispatches to is exactly the one validated on save.
      hooks: { resolveInput: ({ resolvedData }: any) => { try { return typeof resolvedData.url === 'string' ? new URL(resolvedData.url).toString() : resolvedData.url } catch { return resolvedData.url } } },
    }),
    eventTypes: json({ defaultValue: [] }),
    status: select({ type: 'enum', defaultValue: 'active', options: [
      { label: 'Active', value: 'active' }, { label: 'Paused', value: 'paused' },
      { label: 'Failed', value: 'failed' }, { label: 'Disabled', value: 'disabled' },
    ] }),
    // The receiver must already hold the shared secret to verify signatures, so the operator supplies it; a secret
    // generated here could never be read back (read: denyAll) and nothing could verify it.
    secret: text({
      access: { read: denyAll, create: manageIntegrations, update: manageIntegrations },
      ui: hiddenSensitiveUi,
    }),
    failureCount: integer({ defaultValue: 0, validation: { min: 0 } }),
    lastAttemptedAt: timestamp(), lastDeliveredAt: timestamp(), nextAttemptAt: timestamp(),
    events: relationship({ ref: 'WebhookEvent.endpoint', many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    {
      validate({ resolvedData, addValidationError }: any) {
        if (resolvedData.url === undefined) return
        let url: URL
        try { url = new URL(String(resolvedData.url)) } catch { return addValidationError('Webhook URL must be an absolute http(s) URL.') }
        if (!['http:', 'https:'].includes(url.protocol)) return addValidationError('Webhook URL must be an absolute http(s) URL.')
        try { assertExternalWebhookUrl(url) } catch (error) { addValidationError(error instanceof Error ? error.message : 'Webhook URL is not allowed.') }
      },
    },
    {
      validate({ operation, resolvedData, inputData, addValidationError }: any) {
        // [] subscribes to nothing; "*" is a deliberate subscription to every topic (outbox-worker.ts).
        const eventTypes = resolvedData.eventTypes
        if (eventTypes !== undefined && (!Array.isArray(eventTypes) || eventTypes.length > 50 || eventTypes.some((type: unknown) => typeof type !== 'string' || !(type === '*' || /^[a-z0-9][a-z0-9._-]{0,99}$/.test(type))))) {
          addValidationError('Event types must be a list of topic names (for example booking.confirmed), or "*" for every topic.')
        }
        if (operation === 'create' && typeof inputData.secret !== 'string') addValidationError('Enter the signing secret shared with the receiver (at least 32 characters).')
        if (typeof inputData.secret === 'string' && inputData.secret.length < 32) addValidationError('Webhook signing secrets must be at least 32 characters.')
      },
    },
    requiredRelationshipHooks(['carrier']),
    carrierRelationshipHooks({ connection: { model: 'providerConnection' } }),
  ),
})
