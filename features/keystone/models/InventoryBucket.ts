import { list } from '@keystone-6/core'
import { integer, relationship, select, text } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import {
  carrierRelationshipHooks,
  combineListHooks,
  commandOwnedRelationshipHooks,
  inventoryCountHooks,
  minorAmountHooks,
  requiredRelationshipHooks,
} from '../lib/validation'
import { trackingFields } from './trackingFields'

export const InventoryBucket = list({
  access: commandOnlyCarrierAccess('canReadInventory', 'canManageInventory'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'bucketKey',
    listView: { initialColumns: ['bucketKey', 'flightInstance', 'cabin', 'bookingClassCode', 'sold', 'held', 'authorized', 'status'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    bucketKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    flightInstance: relationship({ ref: 'FlightInstance.inventoryBuckets' }),
    cabin: relationship({ ref: 'Cabin.inventoryBuckets' }),
    fareBrand: relationship({ ref: 'FareBrand.inventoryBuckets' }),
    bookingClassCode: text({
      validation: { isRequired: true, match: { regex: /^[A-Z0-9]{1,4}$/, explanation: 'Use a one-to-four character booking class.' } },
    }),
    capacity: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    authorized: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    sold: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    held: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    blocked: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    baseAmount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    taxAmount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    currencyCode: text({
      defaultValue: 'USD',
      validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: 'Use an ISO 4217 currency code.' } },
    }),
    status: select({
      type: 'enum',
      defaultValue: 'open',
      validation: { isRequired: true },
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Closed', value: 'closed' },
        { label: 'Frozen', value: 'frozen' },
      ],
    }),
    holds: relationship({ ref: 'InventoryHold.inventoryBucket', many: true }),
    offerItems: relationship({ ref: 'OfferItem.inventoryBucket', many: true }),
    bookingSegments: relationship({ ref: 'BookingSegment.inventoryBucket', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'flightInstance', 'cabin']),
    carrierRelationshipHooks({ flightInstance: { model: 'flightInstance' }, cabin: { model: 'cabin' }, fareBrand: { model: 'fareBrand' } }),
    commandOwnedRelationshipHooks(['holds', 'offerItems', 'bookingSegments']),
    inventoryCountHooks(),
    minorAmountHooks(['baseAmount', 'taxAmount']),
  ),
})
