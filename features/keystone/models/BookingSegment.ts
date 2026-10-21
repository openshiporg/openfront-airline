import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import {
  chronologicalRangeHooks,
  combineListHooks,
  requiredRelationshipHooks,
} from '../lib/validation'
import { immutableFieldAccess } from './fields'
import { trackingFields } from './trackingFields'

export const BookingSegment = list({
  access: commandOnlyCarrierAccess('canReadBookings', 'canManageBookings'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'segmentKey',
    listView: { initialColumns: ['segmentKey', 'booking', 'sequence', 'marketingFlightNumber', 'originCode', 'destinationCode', 'status'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    segmentKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    booking: relationship({ ref: 'Booking.segments', access: immutableFieldAccess }),
    journey: relationship({ ref: 'Journey.segments', access: immutableFieldAccess }),
    sourceOfferItem: relationship({ ref: 'OfferItem.bookingSegments', access: immutableFieldAccess }),
    flightInstance: relationship({ ref: 'FlightInstance.bookingSegments', access: immutableFieldAccess }),
    inventoryBucket: relationship({ ref: 'InventoryBucket.bookingSegments', access: immutableFieldAccess }),
    sequence: integer({ validation: { isRequired: true, min: 1 }, access: immutableFieldAccess }),
    status: select({
      type: 'enum',
      defaultValue: 'confirmed',
      options: [
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Checked in', value: 'checked_in' },
        { label: 'Boarded', value: 'boarded' },
        { label: 'Flown', value: 'flown' },
        { label: 'Offloaded', value: 'offloaded' },
        { label: 'Disrupted', value: 'disrupted' },
        { label: 'Reaccommodated', value: 'reaccommodated' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Refunded', value: 'refunded' },
      ],
    }),
    origin: relationship({ ref: 'Airport', access: immutableFieldAccess }),
    destination: relationship({ ref: 'Airport', access: immutableFieldAccess }),
    originCode: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    destinationCode: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    marketingCarrierCode: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    operatingCarrierCode: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    marketingFlightNumber: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    scheduledDepartureAt: timestamp({ validation: { isRequired: true }, access: immutableFieldAccess }),
    scheduledArrivalAt: timestamp({ validation: { isRequired: true }, access: immutableFieldAccess }),
    cabinCode: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    bookingClassCode: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    fareBrandCode: text({ access: immutableFieldAccess }),
    fareBasisCode: text({ access: immutableFieldAccess }),
    itinerarySnapshot: json({ defaultValue: {}, access: immutableFieldAccess }),
    includedBaggageSnapshot: json({ defaultValue: {}, access: immutableFieldAccess }),
    ticketCoupons: relationship({ ref: 'TicketCoupon.bookingSegment', many: true }),
    electronicMiscCoupons: relationship({ ref: 'ElectronicMiscCoupon.bookingSegment', many: true }),
    seatAssignments: relationship({ ref: 'SeatAssignment.bookingSegment', many: true }),
    serviceRequests: relationship({ ref: 'ServiceRequest.bookingSegment', many: true }),
    checkIns: relationship({ ref: 'CheckIn.bookingSegment', many: true }),
    documentVerifications: relationship({ ref: 'DocumentVerification.bookingSegment', many: true }),
    bags: relationship({ ref: 'Bag.segments', many: true }),
    primaryBags: relationship({ ref: 'Bag.bookingSegment', many: true }),
    disruptions: relationship({ ref: 'Disruption.affectedSegments', many: true }),
    exchangesAsOriginal: relationship({ ref: 'Exchange.originalSegments', many: true }),
    exchangesAsReplacement: relationship({ ref: 'Exchange.replacementSegments', many: true }),
    reaccommodationsAsOriginal: relationship({ ref: 'Reaccommodation.originalSegments', many: true }),
    reaccommodationsAsReplacement: relationship({ ref: 'Reaccommodation.replacementSegments', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'booking', 'journey', 'origin', 'destination']),
    chronologicalRangeHooks('scheduledDepartureAt', 'scheduledArrivalAt', 'Booked segment'),
    lifecycleHooks('bookingSegment'),
  ),
})
