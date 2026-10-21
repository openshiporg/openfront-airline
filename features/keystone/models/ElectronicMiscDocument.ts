import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, minorAmountHooks, requiredRelationshipHooks } from '../lib/validation'
import { immutableFieldAccess } from './fields'
import { trackingFields } from './trackingFields'

export const ElectronicMiscDocument = list({
  access: commandOnlyCarrierAccess('canReadTicketing', 'canManageTicketing'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'documentNumber',
    listView: { initialColumns: ['documentNumber', 'booking', 'passenger', 'documentType', 'status', 'totalAmount'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    documentNumber: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    booking: relationship({ ref: 'Booking.electronicMiscDocuments', access: immutableFieldAccess }),
    bookingPassenger: relationship({ ref: 'BookingPassenger.electronicMiscDocuments', access: immutableFieldAccess }),
    passenger: relationship({ ref: 'Passenger.electronicMiscDocuments', access: immutableFieldAccess }),
    documentType: select({
      type: 'enum',
      defaultValue: 'associated',
      access: immutableFieldAccess,
      options: [
        { label: 'Associated', value: 'associated' },
        { label: 'Standalone', value: 'standalone' },
      ],
    }),
    reasonForIssuanceCode: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    serviceCode: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    ancillaryProduct: relationship({ ref: 'AncillaryProduct', access: immutableFieldAccess }),
    status: select({
      type: 'enum',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Issued', value: 'issued' },
        { label: 'Partially used', value: 'partially_used' },
        { label: 'Used', value: 'used' },
        { label: 'Voided', value: 'voided' },
        { label: 'Refunded', value: 'refunded' },
        { label: 'Exchanged', value: 'exchanged' },
      ],
    }),
    totalAmount: integer({ validation: { isRequired: true, min: 0 }, access: immutableFieldAccess }),
    currencyCode: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    issuedAt: timestamp({ access: immutableFieldAccess }),
    providerReference: text({ access: immutableFieldAccess }),
    coupons: relationship({ ref: 'ElectronicMiscCoupon.document', many: true }),
    metadata: json({ defaultValue: {} }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'booking', 'bookingPassenger', 'passenger']),
    lifecycleHooks('electronicMiscDocument'),
    minorAmountHooks(['totalAmount']),
  ),
})
