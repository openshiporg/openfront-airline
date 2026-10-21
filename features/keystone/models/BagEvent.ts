import { list } from '@keystone-6/core'
import { json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { requiredRelationshipHooks } from '../lib/validation'
import { trackingFields } from './trackingFields'

export const BagEvent = list({
  access: commandOnlyCarrierAccess('canReadAirportService', 'canManageAirportService'),
  graphql: commandOnlyGraphql(),
  ui: { labelField: 'eventKey', listView: { initialColumns: ['bag', 'eventType', 'airport', 'occurredAt', 'source'] }, hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: 'read' } },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    eventKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    bag: relationship({ ref: 'Bag.events' }),
    airport: relationship({ ref: 'Airport.bagEvents' }),
    eventType: select({ type: 'enum', validation: { isRequired: true }, options: [
      { label: 'Accepted', value: 'accepted' }, { label: 'Security screened', value: 'screened' },
      { label: 'Loaded', value: 'loaded' }, { label: 'Unloaded', value: 'unloaded' },
      { label: 'Transferred', value: 'transferred' }, { label: 'Arrived', value: 'arrived' },
      { label: 'Delivered', value: 'delivered' }, { label: 'Exception', value: 'exception' },
    ] }),
    statusSnapshot: text({ validation: { isRequired: true } }),
    occurredAt: timestamp({ validation: { isRequired: true }, isIndexed: true }),
    source: select({ type: 'enum', defaultValue: 'system', options: [
      { label: 'System', value: 'system' }, { label: 'Scanner', value: 'scanner' },
      { label: 'Provider', value: 'provider' }, { label: 'Agent', value: 'agent' },
    ] }),
    providerConnection: relationship({ ref: 'ProviderConnection' }),
    providerReference: text(),
    payloadSummary: json({ defaultValue: {} }),
    ...trackingFields,
  },
  hooks: requiredRelationshipHooks(['carrier', 'bag']),
})
