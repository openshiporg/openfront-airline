import { list } from '@keystone-6/core'
import { integer, relationship, select, text } from '@keystone-6/core/fields'

import { carrierScopedAccess } from '../access'
import { combineListHooks, commandOwnedRelationshipHooks, requiredRelationshipHooks } from '../lib/validation'
import { trackingFields } from './trackingFields'

export const Cabin = list({
  access: carrierScopedAccess('canReadNetwork', 'canManageNetwork'),
  ui: {
    labelField: 'name',
    listView: { initialColumns: ['name', 'code', 'cabinClass', 'displayOrder', 'carrier'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    code: text({ validation: { isRequired: true } }),
    name: text({ validation: { isRequired: true } }),
    cabinClass: select({
      type: 'enum',
      validation: { isRequired: true },
      options: [
        { label: 'Economy', value: 'economy' },
        { label: 'Premium economy', value: 'premium_economy' },
        { label: 'Business', value: 'business' },
        { label: 'First', value: 'first' },
      ],
    }),
    displayOrder: integer({ defaultValue: 0, validation: { min: 0 } }),
    fareBrands: relationship({ ref: 'FareBrand.cabin', many: true }),
    inventoryBuckets: relationship({ ref: 'InventoryBucket.cabin', many: true }),
    seats: relationship({ ref: 'Seat.cabin', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier']),
    commandOwnedRelationshipHooks(['fareBrands', 'inventoryBuckets', 'seats']),
  ),
})
