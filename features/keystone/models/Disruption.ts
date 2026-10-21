import { list } from '@keystone-6/core'
import { json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, requiredRelationshipHooks } from '../lib/validation'
import { trackingFields } from './trackingFields'

export const Disruption = list({
  access: commandOnlyCarrierAccess('canReadDisruptions', 'canManageDisruptions'),
  graphql: commandOnlyGraphql(),
  ui: { labelField: 'disruptionKey', listView: { initialColumns: ['disruptionKey', 'flightInstance', 'type', 'severity', 'status', 'detectedAt'] }, hideDelete: true },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    disruptionKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    flightInstance: relationship({ ref: 'FlightInstance.disruptions' }),
    type: select({ type: 'enum', validation: { isRequired: true }, options: [
      { label: 'Delay', value: 'delay' }, { label: 'Cancellation', value: 'cancellation' },
      { label: 'Schedule change', value: 'schedule_change' }, { label: 'Misconnection', value: 'misconnection' },
      { label: 'Diversion', value: 'diversion' }, { label: 'Equipment change', value: 'equipment_change' },
      { label: 'Other', value: 'other' },
    ] }),
    severity: select({ type: 'enum', defaultValue: 'medium', options: [
      { label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' },
      { label: 'High', value: 'high' }, { label: 'Critical', value: 'critical' },
    ] }),
    status: select({ type: 'enum', defaultValue: 'detected', options: [
      { label: 'Detected', value: 'detected' }, { label: 'Published', value: 'published' },
      { label: 'Recovering', value: 'recovering' }, { label: 'Resolved', value: 'resolved' },
      { label: 'Cancelled', value: 'cancelled' },
    ] }),
    affectedSegments: relationship({ ref: 'BookingSegment.disruptions', many: true }),
    publicSummary: text({ ui: { displayMode: 'textarea' } }),
    internalDetails: text({ ui: { displayMode: 'textarea' } }),
    providerConnection: relationship({ ref: 'ProviderConnection' }),
    providerReference: text(),
    detectedAt: timestamp({ defaultValue: { kind: 'now' } }),
    publishedAt: timestamp(), resolvedAt: timestamp(),
    impactSnapshot: json({ defaultValue: {} }),
    reaccommodations: relationship({ ref: 'Reaccommodation.disruption', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier']),
    lifecycleHooks('disruption'),
  ),
})
