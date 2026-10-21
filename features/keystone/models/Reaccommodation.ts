import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, minorAmountHooks, requiredRelationshipHooks } from '../lib/validation'
import { immutableFieldAccess } from './fields'
import { trackingFields } from './trackingFields'

export const Reaccommodation = list({
  access: commandOnlyCarrierAccess('canReadDisruptions', 'canManageDisruptions'),
  graphql: commandOnlyGraphql(),
  ui: { labelField: 'reaccommodationKey', listView: { initialColumns: ['booking', 'passenger', 'disruption', 'status', 'optionExpiresAt'] }, hideDelete: true },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    reaccommodationKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    idempotencyKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    booking: relationship({ ref: 'Booking.reaccommodations', access: immutableFieldAccess }),
    bookingPassenger: relationship({ ref: 'BookingPassenger.reaccommodations', access: immutableFieldAccess }),
    passenger: relationship({ ref: 'Passenger.reaccommodations', access: immutableFieldAccess }),
    disruption: relationship({ ref: 'Disruption.reaccommodations', access: immutableFieldAccess }),
    status: select({ type: 'enum', defaultValue: 'proposed', options: [
      { label: 'Proposed', value: 'proposed' }, { label: 'Accepted', value: 'accepted' },
      { label: 'Confirmed', value: 'confirmed' }, { label: 'Declined', value: 'declined' },
      { label: 'Failed', value: 'failed' }, { label: 'Expired', value: 'expired' },
      { label: 'Cancelled', value: 'cancelled' },
    ] }),
    originalSegments: relationship({ ref: 'BookingSegment.reaccommodationsAsOriginal', many: true, access: immutableFieldAccess }),
    replacementSegments: relationship({ ref: 'BookingSegment.reaccommodationsAsReplacement', many: true }),
    replacementOffer: relationship({ ref: 'Offer' }),
    optionExpiresAt: timestamp({ access: immutableFieldAccess }),
    priceDifferenceAmount: integer({ defaultValue: 0, validation: { min: 0 }, access: immutableFieldAccess }),
    additionalCollectionAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    refundAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    currencyCode: text({ defaultValue: 'USD', access: immutableFieldAccess }),
    acceptedAt: timestamp(), confirmedAt: timestamp(),
    reason: text(), optionSnapshot: json({ defaultValue: {}, access: immutableFieldAccess }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'booking', 'disruption']),
    lifecycleHooks('reaccommodation'),
    minorAmountHooks(['priceDifferenceAmount', 'additionalCollectionAmount', 'refundAmount']),
  ),
})
