import { list } from '@keystone-6/core'
import { integer, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, requiredRelationshipHooks } from '../lib/validation'
import { trackingFields } from './trackingFields'

const holdExpiryHooks = {
  validate({ operation, resolvedData, item, addValidationError }: any) {
    const expiresAt = resolvedData.expiresAt ?? item?.expiresAt
    if (!expiresAt || Number.isNaN(new Date(expiresAt).getTime())) {
      addValidationError('Hold expiry must be a valid timestamp.')
      return
    }
    if (operation === 'create' && new Date(expiresAt) <= new Date()) {
      addValidationError('A new inventory hold must expire in the future.')
    }
  },
}

export const InventoryHold = list({
  access: commandOnlyCarrierAccess('canReadInventory', 'canManageInventory'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'holdKey',
    listView: { initialColumns: ['holdKey', 'inventoryBucket', 'offer', 'quantity', 'status', 'expiresAt'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    holdKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    inventoryBucket: relationship({ ref: 'InventoryBucket.holds' }),
    offer: relationship({ ref: 'Offer.inventoryHolds' }),
    quantity: integer({ validation: { isRequired: true, min: 1 } }),
    status: select({
      type: 'enum',
      defaultValue: 'active',
      validation: { isRequired: true },
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Converted', value: 'converted' },
        { label: 'Released', value: 'released' },
        { label: 'Expired', value: 'expired' },
      ],
    }),
    expiresAt: timestamp({ validation: { isRequired: true }, isIndexed: true }),
    convertedAt: timestamp(),
    releasedAt: timestamp(),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'inventoryBucket', 'offer']),
    lifecycleHooks('inventoryHold'),
    holdExpiryHooks,
  ),
})
