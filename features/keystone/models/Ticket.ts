import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, minorAmountHooks, requiredRelationshipHooks } from '../lib/validation'
import { immutableFieldAccess } from './fields'
import { trackingFields } from './trackingFields'

export const Ticket = list({
  access: commandOnlyCarrierAccess('canReadTicketing', 'canManageTicketing'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'ticketNumber',
    listView: { initialColumns: ['ticketNumber', 'booking', 'passenger', 'status', 'totalAmount', 'currencyCode', 'issuedAt'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    ticketNumber: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    booking: relationship({ ref: 'Booking.tickets', access: immutableFieldAccess }),
    bookingPassenger: relationship({ ref: 'BookingPassenger.tickets', access: immutableFieldAccess }),
    passenger: relationship({ ref: 'Passenger.tickets', access: immutableFieldAccess }),
    issuingCarrierCode: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    validatingCarrierCode: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    status: select({
      type: 'enum',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Issued', value: 'issued' },
        { label: 'Partially used', value: 'partially_used' },
        { label: 'Used', value: 'used' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Voided', value: 'voided' },
        { label: 'Refunded', value: 'refunded' },
        { label: 'Exchanged', value: 'exchanged' },
      ],
    }),
    totalAmount: integer({ validation: { isRequired: true, min: 0 }, access: immutableFieldAccess }),
    currencyCode: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    issuedAt: timestamp({ access: immutableFieldAccess }),
    voidedAt: timestamp(),
    refundedAt: timestamp(),
    providerReference: text({ access: immutableFieldAccess }),
    originalTicket: relationship({ ref: 'Ticket.reissuedTickets', access: immutableFieldAccess }),
    reissuedTickets: relationship({ ref: 'Ticket.originalTicket', many: true }),
    coupons: relationship({ ref: 'TicketCoupon.ticket', many: true }),
    metadata: json({ defaultValue: {} }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'booking', 'bookingPassenger', 'passenger']),
    lifecycleHooks('ticket'),
    minorAmountHooks(['totalAmount']),
  ),
})
