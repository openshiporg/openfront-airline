import { list } from '@keystone-6/core'
import { integer, relationship, select, text } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, requiredRelationshipHooks } from '../lib/validation'
import { trackingFields } from './trackingFields'

export const Journey = list({
  access: commandOnlyCarrierAccess('canReadBookings', 'canManageBookings'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'journeyKey',
    listView: { initialColumns: ['journeyKey', 'booking', 'sequence', 'origin', 'destination', 'status'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    journeyKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    booking: relationship({ ref: 'Booking.journeys' }),
    sequence: integer({ validation: { isRequired: true, min: 1 } }),
    origin: relationship({ ref: 'Airport' }),
    destination: relationship({ ref: 'Airport' }),
    status: select({
      type: 'enum',
      defaultValue: 'planned',
      options: [
        { label: 'Planned', value: 'planned' },
        { label: 'In progress', value: 'in_progress' },
        { label: 'Completed', value: 'completed' },
        { label: 'Disrupted', value: 'disrupted' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    }),
    segments: relationship({ ref: 'BookingSegment.journey', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'booking', 'origin', 'destination']),
    lifecycleHooks('journey'),
  ),
})
