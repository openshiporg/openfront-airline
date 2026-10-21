import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, requiredRelationshipHooks } from '../lib/validation'
import { trackingFields } from './trackingFields'

export const SeatMap = list({
  access: commandOnlyCarrierAccess('canReadNetwork', 'canManageNetwork'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'mapKey',
    listView: { initialColumns: ['mapKey', 'flightInstance', 'version', 'status', 'createdAt'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    mapKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    flightInstance: relationship({ ref: 'FlightInstance.seatMaps' }),
    version: integer({ defaultValue: 1, validation: { isRequired: true, min: 1 } }),
    status: select({
      type: 'enum',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Retired', value: 'retired' },
      ],
    }),
    layoutSnapshot: json({ defaultValue: {} }),
    seats: relationship({ ref: 'Seat.seatMap', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'flightInstance']),
    lifecycleHooks('seatMap'),
  ),
})
