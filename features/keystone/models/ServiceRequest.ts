import { list } from '@keystone-6/core'
import { json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, requiredRelationshipHooks } from '../lib/validation'
import { trackingFields } from './trackingFields'

export const ServiceRequest = list({
  access: commandOnlyCarrierAccess('canReadBookings', 'canManageBookings'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'requestKey',
    listView: { initialColumns: ['requestKey', 'booking', 'passenger', 'code', 'category', 'status'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    requestKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    booking: relationship({ ref: 'Booking.serviceRequests' }),
    passenger: relationship({ ref: 'Passenger.serviceRequests' }),
    bookingPassenger: relationship({ ref: 'BookingPassenger' }),
    bookingSegment: relationship({ ref: 'BookingSegment.serviceRequests' }),
    code: text({ validation: { isRequired: true } }),
    category: select({
      type: 'enum',
      defaultValue: 'ssr',
      options: [
        { label: 'Special service request', value: 'ssr' },
        { label: 'Other service information', value: 'osi' },
        { label: 'Accessibility', value: 'accessibility' },
        { label: 'Meal', value: 'meal' },
        { label: 'Assistance', value: 'assistance' },
        { label: 'Other', value: 'other' },
      ],
    }),
    status: select({
      type: 'enum',
      defaultValue: 'requested',
      options: [
        { label: 'Requested', value: 'requested' },
        { label: 'Pending', value: 'pending' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Fulfilled', value: 'fulfilled' },
        { label: 'Unable', value: 'unable' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    }),
    travelerText: text(),
    internalNotes: text({ ui: { displayMode: 'textarea' } }),
    serviceData: json({ defaultValue: {} }),
    confirmedAt: timestamp(),
    fulfilledAt: timestamp(),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'booking', 'passenger']),
    lifecycleHooks('serviceRequest'),
  ),
})
