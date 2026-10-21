import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, minorAmountHooks, requiredRelationshipHooks } from '../lib/validation'
import { trackingFields } from './trackingFields'

const offerInvariantHooks = {
  validate({ operation, resolvedData, item, addValidationError }: any) {
    const value = (key: string) => Number(resolvedData[key] ?? item?.[key] ?? 0)
    const base = value('baseAmount')
    const tax = value('taxAmount')
    const fee = value('feeAmount')
    const discount = value('discountAmount')
    const total = value('totalAmount')
    if (base + tax + fee - discount !== total) {
      addValidationError('Offer total must equal base plus tax and fees minus discounts.')
    }

    const expiresAt = resolvedData.expiresAt ?? item?.expiresAt
    const status = resolvedData.status ?? item?.status ?? 'draft'
    if (['available', 'held'].includes(status)) {
      const expiry = new Date(expiresAt)
      if (!expiresAt || Number.isNaN(expiry.getTime())) {
        addValidationError('A sellable offer requires a valid expiry timestamp.')
      } else if (operation === 'create' && expiry <= new Date()) {
        addValidationError('A sellable offer must expire in the future.')
      }
    }
  },
}

export const Offer = list({
  access: commandOnlyCarrierAccess('canReadOffers', 'canManageOffers'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'offerNumber',
    listView: { initialColumns: ['offerNumber', 'status', 'source', 'totalAmount', 'currencyCode', 'expiresAt'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    offerNumber: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    shoppingSessionId: text({ isIndexed: true, access: { read: denyAll, create: denyAll, update: denyAll } }),
    idempotencyKey: text({ isIndexed: 'unique' }),
    status: select({
      type: 'enum',
      defaultValue: 'draft',
      validation: { isRequired: true },
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Available', value: 'available' },
        { label: 'Held', value: 'held' },
        { label: 'Accepted', value: 'accepted' },
        { label: 'Expired', value: 'expired' },
        { label: 'Withdrawn', value: 'withdrawn' },
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
      ],
    }),
    expiresAt: timestamp({ isIndexed: true }),
    baseAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    taxAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    feeAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    discountAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    totalAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    currencyCode: text({
      defaultValue: 'USD',
      validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: 'Use an ISO 4217 currency code.' } },
    }),
    customer: relationship({ ref: 'User.offers' }),
    approvedAgent: relationship({ ref: 'ApprovedAgent.offers' }),
    passengers: relationship({ ref: 'Passenger.offers', many: true }),
    passengerCriteria: json({ defaultValue: [] }),
    items: relationship({ ref: 'OfferItem.offer', many: true }),
    inventoryHolds: relationship({ ref: 'InventoryHold.offer', many: true }),
    booking: relationship({ ref: 'Booking.sourceOffer' }),
    externalReferences: json({ defaultValue: {} }),
    metadata: json({ defaultValue: {} }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier']),
    lifecycleHooks('offer'),
    minorAmountHooks(['baseAmount', 'taxAmount', 'feeAmount', 'discountAmount', 'totalAmount']),
    offerInvariantHooks,
  ),
})
