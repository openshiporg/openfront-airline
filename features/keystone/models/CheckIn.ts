import { list } from '@keystone-6/core'
import { checkbox, integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyGraphql, stationScopedCommandAccess } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, requiredRelationshipHooks } from '../lib/validation'
import { trackingFields } from './trackingFields'

export const CheckIn = list({
  access: stationScopedCommandAccess('canReadAirportService', 'canManageAirportService', 'flightInstance.origin', 'canCheckIn'),
  graphql: commandOnlyGraphql(),
  ui: { labelField: 'checkInKey', listView: { initialColumns: ['booking', 'passenger', 'bookingSegment', 'status', 'channel', 'checkedInAt'] }, hideDelete: true },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    checkInKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    booking: relationship({ ref: 'Booking.checkIns' }),
    bookingPassenger: relationship({ ref: 'BookingPassenger.checkIns' }),
    passenger: relationship({ ref: 'Passenger.checkIns' }),
    bookingSegment: relationship({ ref: 'BookingSegment.checkIns' }),
    flightInstance: relationship({ ref: 'FlightInstance.checkIns' }),
    ticketCoupon: relationship({ ref: 'TicketCoupon.checkIns' }),
    seatAssignment: relationship({ ref: 'SeatAssignment' }),
    status: select({ type: 'enum', defaultValue: 'not_started', options: [
      { label: 'Not started', value: 'not_started' }, { label: 'Eligible', value: 'eligible' },
      { label: 'Checked in', value: 'checked_in' }, { label: 'Boarded', value: 'boarded' },
      { label: 'Blocked', value: 'blocked' }, { label: 'Offloaded', value: 'offloaded' },
      { label: 'Cancelled', value: 'cancelled' },
    ] }),
    channel: select({ type: 'enum', defaultValue: 'web', options: [
      { label: 'Web', value: 'web' }, { label: 'Mobile', value: 'mobile' },
      { label: 'Kiosk', value: 'kiosk' }, { label: 'Counter', value: 'counter' },
      { label: 'Agent', value: 'agent' }, { label: 'System', value: 'system' },
    ] }),
    travelDocumentsVerified: checkbox({ defaultValue: false }),
    checkedBagCount: integer({ defaultValue: 0, validation: { min: 0 } }),
    eligibilityData: json({ defaultValue: {} }),
    blockedReason: text(),
    checkedInAt: timestamp(), boardedAt: timestamp(), offloadedAt: timestamp(),
    boardingPasses: relationship({ ref: 'BoardingPass.checkIn', many: true }),
    bags: relationship({ ref: 'Bag.checkIn', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'booking', 'bookingPassenger', 'passenger', 'bookingSegment', 'flightInstance']),
    lifecycleHooks('checkIn'),
  ),
})
