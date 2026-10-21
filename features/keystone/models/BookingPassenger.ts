import { list } from '@keystone-6/core'
import { checkbox, json, relationship, select, text } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { combineListHooks, requiredRelationshipHooks } from '../lib/validation'
import { immutableFieldAccess } from './fields'
import { trackingFields } from './trackingFields'

const passengerSnapshotHooks = {
  validate({ operation, resolvedData, addValidationError }: any) {
    if (operation === 'create' && !resolvedData.passengerSnapshot) {
      addValidationError('passengerSnapshot is required and immutable.')
    }
  },
}

export const BookingPassenger = list({
  access: commandOnlyCarrierAccess('canReadBookings', 'canManageBookings'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'bookingPassengerKey',
    listView: { initialColumns: ['booking', 'passenger', 'passengerType', 'status', 'isPrimaryContact'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    bookingPassengerKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    booking: relationship({ ref: 'Booking.passengers', access: immutableFieldAccess }),
    passenger: relationship({ ref: 'Passenger.bookingPassengers', access: immutableFieldAccess }),
    passengerType: select({
      type: 'enum',
      defaultValue: 'adult',
      access: immutableFieldAccess,
      options: [
        { label: 'Adult', value: 'adult' },
        { label: 'Child', value: 'child' },
        { label: 'Infant with seat', value: 'infant_with_seat' },
        { label: 'Infant without seat', value: 'infant_without_seat' },
      ],
    }),
    status: select({
      type: 'enum',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Completed', value: 'completed' },
      ],
    }),
    isPrimaryContact: checkbox({ defaultValue: false }),
    passengerSnapshot: json({ access: immutableFieldAccess }),
    loyaltySnapshot: json({ defaultValue: {}, access: immutableFieldAccess }),
    lineItems: relationship({ ref: 'BookingLineItem.bookingPassenger', many: true }),
    tickets: relationship({ ref: 'Ticket.bookingPassenger', many: true }),
    serviceObligations: relationship({ ref: 'ServiceObligation.bookingPassenger', many: true }),
    ticketCouponLineages: relationship({ ref: 'TicketCouponLineage.bookingPassenger', many: true }),
    electronicMiscDocuments: relationship({ ref: 'ElectronicMiscDocument.bookingPassenger', many: true }),
    seatAssignments: relationship({ ref: 'SeatAssignment.bookingPassenger', many: true }),
    checkIns: relationship({ ref: 'CheckIn.bookingPassenger', many: true }),
    bags: relationship({ ref: 'Bag.bookingPassenger', many: true }),
    reaccommodations: relationship({ ref: 'Reaccommodation.bookingPassenger', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'booking', 'passenger']),
    passengerSnapshotHooks,
  ),
})
