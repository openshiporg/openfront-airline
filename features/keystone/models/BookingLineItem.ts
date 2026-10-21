import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { combineListHooks, minorAmountHooks, requiredRelationshipHooks } from '../lib/validation'
import { trackingFields } from './trackingFields'

const lineTotalHooks = {
  validate({ resolvedData, addValidationError }: any) {
    const quantity = Number(resolvedData.quantity ?? 1)
    const unit = Number(resolvedData.unitAmount ?? 0)
    const base = Number(resolvedData.baseAmount ?? 0)
    const tax = Number(resolvedData.taxAmount ?? 0)
    const fee = Number(resolvedData.feeAmount ?? 0)
    const total = Number(resolvedData.totalAmount ?? 0)
    if (!Number.isSafeInteger(unit * quantity) || unit * quantity !== base) {
      addValidationError('Booking line base amount must equal unit amount multiplied by quantity.')
    }
    if (base + tax + fee !== total) {
      addValidationError('Booking line total must equal base, tax, and fee amounts.')
    }
  },
}

export const BookingLineItem = list({
  access: commandOnlyCarrierAccess('canReadBookings', 'canManageBookings'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'description',
    listView: { initialColumns: ['booking', 'itemType', 'description', 'quantity', 'totalAmount', 'currencyCode'] },
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: 'read' },
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    lineItemKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    booking: relationship({ ref: 'Booking.lineItems' }),
    sourceOfferItem: relationship({ ref: 'OfferItem.bookingLineItems' }),
    bookingSegment: relationship({ ref: 'BookingSegment' }),
    bookingPassenger: relationship({ ref: 'BookingPassenger.lineItems' }),
    ancillaryProduct: relationship({ ref: 'AncillaryProduct.bookingLineItems' }),
    itemType: select({
      type: 'enum',
      validation: { isRequired: true },
      options: [
        { label: 'Flight', value: 'flight' },
        { label: 'Ancillary', value: 'ancillary' },
        { label: 'Fee', value: 'fee' },
        { label: 'Tax', value: 'tax' },
        { label: 'Discount', value: 'discount' },
        { label: 'Exchange', value: 'exchange' },
      ],
    }),
    description: text({ validation: { isRequired: true } }),
    quantity: integer({ defaultValue: 1, validation: { isRequired: true, min: 1 } }),
    unitAmount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    baseAmount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    taxAmount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    feeAmount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    totalAmount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    currencyCode: text({
      validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: 'Use an ISO 4217 currency code.' } },
    }),
    sourceReference: text(),
    productSnapshot: json({ defaultValue: {} }),
    pricingSnapshot: json({ defaultValue: {} }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'booking']),
    minorAmountHooks(['unitAmount', 'baseAmount', 'taxAmount', 'feeAmount', 'totalAmount']),
    lineTotalHooks,
  ),
})
