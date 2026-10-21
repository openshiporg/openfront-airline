import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyGraphql, stationScopedCommandAccess } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, requiredRelationshipHooks } from '../lib/validation'
import { immutableFieldAccess } from './fields'
import { trackingFields } from './trackingFields'

export const Bag = list({
  access: stationScopedCommandAccess('canReadAirportService', 'canManageAirportService', 'origin', 'canAcceptBags'),
  graphql: commandOnlyGraphql(),
  ui: { labelField: 'tagNumber', listView: { initialColumns: ['tagNumber', 'booking', 'passenger', 'flightInstance', 'status', 'weightGrams'] }, hideDelete: true },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    bagKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    tagNumber: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    booking: relationship({ ref: 'Booking.bags', access: immutableFieldAccess }),
    bookingPassenger: relationship({ ref: 'BookingPassenger.bags', access: immutableFieldAccess }),
    passenger: relationship({ ref: 'Passenger.bags', access: immutableFieldAccess }),
    flightInstance: relationship({ ref: 'FlightInstance.bags', access: immutableFieldAccess }),
    bookingSegment: relationship({ ref: 'BookingSegment.primaryBags', access: immutableFieldAccess }),
    checkIn: relationship({ ref: 'CheckIn.bags', access: immutableFieldAccess }),
    ticketCoupon: relationship({ ref: 'TicketCoupon.bags', access: immutableFieldAccess }),
    entitlementDocument: relationship({ ref: 'ElectronicMiscDocument', access: immutableFieldAccess }),
    segments: relationship({ ref: 'BookingSegment.bags', many: true, access: immutableFieldAccess }),
    origin: relationship({ ref: 'Airport', access: immutableFieldAccess }),
    destination: relationship({ ref: 'Airport', access: immutableFieldAccess }),
    status: select({ type: 'enum', defaultValue: 'accepted', options: [
      { label: 'Accepted', value: 'accepted' }, { label: 'Loaded', value: 'loaded' },
      { label: 'In transit', value: 'in_transit' }, { label: 'Arrived', value: 'arrived' },
      { label: 'Delivered', value: 'delivered' }, { label: 'Delayed', value: 'delayed' },
      { label: 'Mishandled', value: 'mishandled' }, { label: 'Closed', value: 'closed' },
    ] }),
    bagType: select({ type: 'enum', defaultValue: 'checked', options: [
      { label: 'Checked', value: 'checked' }, { label: 'Gate checked', value: 'gate_checked' },
      { label: 'Special item', value: 'special_item' }, { label: 'Mobility aid', value: 'mobility_aid' },
    ] }),
    weightGrams: integer({ validation: { min: 0 }, access: immutableFieldAccess }),
    routeSnapshot: json({ defaultValue: [], access: immutableFieldAccess }),
    acceptedAt: timestamp(), deliveredAt: timestamp(),
    events: relationship({ ref: 'BagEvent.bag', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'booking', 'bookingPassenger', 'passenger', 'bookingSegment', 'checkIn', 'ticketCoupon']),
    lifecycleHooks('bag'),
  ),
})
