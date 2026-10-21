import { list } from '@keystone-6/core'
import { json, relationship, select, text } from '@keystone-6/core/fields'

import { carrierScopedAccess } from '../access'
import { requiredRelationshipHooks } from '../lib/validation'
import { trackingFields } from './trackingFields'

export const IntegrationProvider = list({
  access: carrierScopedAccess('canReadIntegrations', 'canManageIntegrations'),
  ui: { labelField: 'name', listView: { initialColumns: ['name', 'code', 'type', 'status', 'carrier'] }, hideDelete: true },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    providerKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    name: text({ validation: { isRequired: true } }),
    code: text({ validation: { isRequired: true } }),
    type: select({ type: 'enum', validation: { isRequired: true }, options: [
      { label: 'NDC', value: 'ndc' }, { label: 'GDS', value: 'gds' },
      { label: 'DCS', value: 'dcs' }, { label: 'Identity', value: 'identity' },
      { label: 'Baggage', value: 'baggage' }, { label: 'Notification', value: 'notification' },
      { label: 'Loyalty', value: 'loyalty' }, { label: 'Other', value: 'other' },
    ] }),
    status: select({ type: 'enum', defaultValue: 'active', options: [
      { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' },
      { label: 'Deprecated', value: 'deprecated' },
    ] }),
    adapterModule: text({ validation: { isRequired: true } }),
    capabilities: json({ defaultValue: [] }),
    connections: relationship({ ref: 'ProviderConnection.provider', many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields,
  },
  hooks: requiredRelationshipHooks(['carrier']),
})
