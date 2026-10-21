import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyGraphql, stationScopedCommandAccess } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, minorAmountHooks, requiredRelationshipHooks } from '../lib/validation'
import { immutableFieldAccess } from './fields'
import { trackingFields } from './trackingFields'

export const SeatAssignment = list({
  access: stationScopedCommandAccess('canReadAirportService', 'canManageAirportService', 'bookingSegment.flightInstance.origin', 'canCheckIn'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'assignmentKey',
    listView: { initialColumns: ['booking', 'passenger', 'bookingSegment', 'seat', 'status', 'assignedAt'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    assignmentKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    occupancyKey: text({ isIndexed: 'unique', db: { isNullable: true }, access: immutableFieldAccess }),
    booking: relationship({ ref: 'Booking.seatAssignments', access: immutableFieldAccess }),
    bookingPassenger: relationship({ ref: 'BookingPassenger.seatAssignments', access: immutableFieldAccess }),
    passenger: relationship({ ref: 'Passenger.seatAssignments', access: immutableFieldAccess }),
    bookingSegment: relationship({ ref: 'BookingSegment.seatAssignments', access: immutableFieldAccess }),
    seat: relationship({ ref: 'Seat.assignments', access: immutableFieldAccess }),
    status: select({
      type: 'enum',
      defaultValue: 'held',
      options: [
        { label: 'Held', value: 'held' },
        { label: 'Assigned', value: 'assigned' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Boarded', value: 'boarded' },
        { label: 'Released', value: 'released' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    }),
    seatDesignatorSnapshot: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    cabinCodeSnapshot: text({ access: immutableFieldAccess }),
    characteristicsSnapshot: json({ defaultValue: [], access: immutableFieldAccess }),
    amount: integer({ defaultValue: 0, validation: { min: 0 }, access: immutableFieldAccess }),
    currencyCode: text({ defaultValue: 'USD', access: immutableFieldAccess }),
    assignedAt: timestamp(),
    confirmedAt: timestamp(),
    releasedAt: timestamp(),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'booking', 'bookingPassenger', 'passenger', 'bookingSegment', 'seat']),
    lifecycleHooks('seatAssignment'),
    minorAmountHooks(['amount']),
  ),
})
