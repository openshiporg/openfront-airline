import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, minorAmountHooks, requiredRelationshipHooks } from '../lib/validation'
import { trackingFields } from './trackingFields'

const bookingTotalHooks = {
  validate({ resolvedData, item, addValidationError }: any) {
    const value = (key: string) => Number(resolvedData[key] ?? item?.[key] ?? 0)
    if (
      value('baseAmount') + value('taxAmount') + value('feeAmount') -
      value('discountAmount') !== value('totalAmount')
    ) {
      addValidationError('Booking total must equal base plus tax and fees minus discounts.')
    }
  },
}

export const Booking = list({
  access: commandOnlyCarrierAccess('canReadBookings', 'canManageBookings'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'recordLocator',
    listView: { initialColumns: ['recordLocator', 'orderNumber', 'status', 'paymentStatus', 'ticketingStatus', 'totalAmount', 'currencyCode'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier.bookings' }),
    bookingKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    recordLocator: text({
      isIndexed: true,
      validation: { isRequired: true, match: { regex: /^[A-Z0-9]{5,8}$/, explanation: 'Use a five-to-eight character record locator.' } },
    }),
    orderNumber: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    idempotencyKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    accessTokenHash: text({ isIndexed: true, db: { isNullable: true }, access: { read: denyAll, create: denyAll, update: denyAll }, ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } } }),
    accessTokenExpiresAt: timestamp(),
    accessTokenVersion: integer({ defaultValue: 1, validation: { min: 1 } }),
    status: select({
      type: 'enum',
      defaultValue: 'pending',
      validation: { isRequired: true },
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Ticketed', value: 'ticketed' },
        { label: 'In progress', value: 'in_progress' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    }),
    paymentStatus: select({
      type: 'enum',
      defaultValue: 'unpaid',
      options: [
        { label: 'Unpaid', value: 'unpaid' },
        { label: 'Partially paid', value: 'partially_paid' },
        { label: 'Paid', value: 'paid' },
        { label: 'Partially refunded', value: 'partially_refunded' },
        { label: 'Refunded', value: 'refunded' },
        { label: 'Payment failed', value: 'failed' },
      ],
    }),
    ticketingStatus: select({
      type: 'enum',
      defaultValue: 'not_ticketed',
      options: [
        { label: 'Not ticketed', value: 'not_ticketed' },
        { label: 'Partially ticketed', value: 'partially_ticketed' },
        { label: 'Ticketed', value: 'ticketed' },
        { label: 'Voided', value: 'voided' },
        { label: 'Exchanged', value: 'exchanged' },
      ],
    }),
    source: select({
      type: 'enum',
      defaultValue: 'direct',
      options: [
        { label: 'Direct', value: 'direct' },
        { label: 'Website', value: 'website' },
        { label: 'Call center', value: 'call_center' },
        { label: 'Approved agent', value: 'agent' },
        { label: 'NDC', value: 'ndc' },
        { label: 'GDS', value: 'gds' },
        { label: 'Airport', value: 'airport' },
      ],
    }),
    contactEmail: text(),
    contactPhone: text(),
    preferredLanguage: text({ defaultValue: 'en' }),
    baseAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    taxAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    feeAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    discountAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    totalAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    currencyCode: text({
      defaultValue: 'USD',
      validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: 'Use an ISO 4217 currency code.' } },
    }),
    customer: relationship({ ref: 'User.bookings' }),
    approvedAgent: relationship({ ref: 'ApprovedAgent.bookings' }),
    sourceOffer: relationship({ ref: 'Offer.booking' }),
    passengers: relationship({ ref: 'BookingPassenger.booking', many: true }),
    journeys: relationship({ ref: 'Journey.booking', many: true }),
    segments: relationship({ ref: 'BookingSegment.booking', many: true }),
    lineItems: relationship({ ref: 'BookingLineItem.booking', many: true }),
    serviceRequests: relationship({ ref: 'ServiceRequest.booking', many: true }),
    tickets: relationship({ ref: 'Ticket.booking', many: true }),
    serviceObligations: relationship({ ref: 'ServiceObligation.booking', many: true }),
    electronicMiscDocuments: relationship({ ref: 'ElectronicMiscDocument.booking', many: true }),
    seatAssignments: relationship({ ref: 'SeatAssignment.booking', many: true }),
    paymentSessions: relationship({ ref: 'PaymentSession.booking', many: true }),
    payments: relationship({ ref: 'Payment.booking', many: true }),
    refunds: relationship({ ref: 'Refund.booking', many: true }),
    exchanges: relationship({ ref: 'Exchange.booking', many: true }),
    checkIns: relationship({ ref: 'CheckIn.booking', many: true }),
    bags: relationship({ ref: 'Bag.booking', many: true }),
    reaccommodations: relationship({ ref: 'Reaccommodation.booking', many: true }),
    manualPaymentEvidence: relationship({ ref: 'ManualPaymentEvidence.booking', many: true }),
    confirmedAt: timestamp(),
    ticketedAt: timestamp(),
    cancelledAt: timestamp(),
    completedAt: timestamp(),
    externalReferences: json({ defaultValue: {} }),
    metadata: json({ defaultValue: {} }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier']),
    lifecycleHooks('booking'),
    minorAmountHooks(['baseAmount', 'taxAmount', 'feeAmount', 'discountAmount', 'totalAmount']),
    bookingTotalHooks,
  ),
})
