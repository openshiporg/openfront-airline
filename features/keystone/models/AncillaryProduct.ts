import { list } from '@keystone-6/core'
import { checkbox, integer, json, relationship, select, text } from '@keystone-6/core/fields'

import { carrierScopedAccess } from '../access'
import { combineListHooks, commandOwnedRelationshipHooks, minorAmountHooks, requiredRelationshipHooks } from '../lib/validation'
import { trackingFields } from './trackingFields'

export const AncillaryProduct = list({
  access: carrierScopedAccess('canReadOffers', 'canManageOffers'),
  ui: {
    labelField: 'name',
    listView: { initialColumns: ['name', 'code', 'type', 'status', 'defaultPriceAmount', 'currencyCode'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    productKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    code: text({ validation: { isRequired: true } }),
    name: text({ validation: { isRequired: true } }),
    description: text({ ui: { displayMode: 'textarea' } }),
    type: select({
      type: 'enum',
      validation: { isRequired: true },
      options: [
        { label: 'Seat', value: 'seat' },
        { label: 'Checked bag', value: 'checked_bag' },
        { label: 'Cabin bag', value: 'cabin_bag' },
        { label: 'Priority', value: 'priority' },
        { label: 'Lounge', value: 'lounge' },
        { label: 'Meal', value: 'meal' },
        { label: 'Wi-Fi', value: 'wifi' },
        { label: 'Assistance', value: 'assistance' },
        { label: 'Other', value: 'other' },
      ],
    }),
    status: select({
      type: 'enum',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Archived', value: 'archived' },
      ],
    }),
    fulfillmentType: select({
      type: 'enum',
      defaultValue: 'associated',
      options: [
        { label: 'Associated to flight', value: 'associated' },
        { label: 'Standalone', value: 'standalone' },
      ],
    }),
    defaultPriceAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    taxAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    currencyCode: text({
      defaultValue: 'USD',
      validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: 'Use an ISO 4217 currency code.' } },
    }),
    requiresInventory: checkbox({ defaultValue: false }),
    attributes: json({ defaultValue: {} }),
    offerItems: relationship({ ref: 'OfferItem.ancillaryProduct', many: true }),
    bookingLineItems: relationship({ ref: 'BookingLineItem.ancillaryProduct', many: true }),
    electronicMiscCoupons: relationship({ ref: 'ElectronicMiscCoupon.ancillaryProduct', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier']),
    commandOwnedRelationshipHooks(['offerItems', 'bookingLineItems', 'electronicMiscCoupons']),
    minorAmountHooks(['defaultPriceAmount', 'taxAmount']),
  ),
})
