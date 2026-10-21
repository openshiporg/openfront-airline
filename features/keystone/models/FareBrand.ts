import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text } from '@keystone-6/core/fields'

import { carrierScopedAccess } from '../access'
import { carrierRelationshipHooks, combineListHooks, commandOwnedRelationshipHooks, requiredRelationshipHooks } from '../lib/validation'
import { normalizeIncludedBaggageSnapshot } from '../lib/snapshots'
import { trackingFields } from './trackingFields'

export const FareBrand = list({
  access: carrierScopedAccess('canReadOffers', 'canManageOffers'),
  ui: {
    labelField: 'name',
    listView: { initialColumns: ['name', 'code', 'cabin', 'status', 'displayOrder'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    code: text({ validation: { isRequired: true } }),
    name: text({ validation: { isRequired: true } }),
    description: text({ ui: { displayMode: 'textarea' } }),
    cabin: relationship({ ref: 'Cabin.fareBrands' }),
    status: select({
      type: 'enum',
      defaultValue: 'draft',
      validation: { isRequired: true },
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Archived', value: 'archived' },
      ],
    }),
    displayOrder: integer({ defaultValue: 0, validation: { min: 0 } }),
    includedBaggage: json({ defaultValue: {} }),
    benefits: json({ defaultValue: [] }),
    refundabilitySummary: text(),
    changeabilitySummary: text(),
    seatSelectionSummary: text(),
    rules: relationship({ ref: 'FareRule.fareBrand', many: true }),
    inventoryBuckets: relationship({ ref: 'InventoryBucket.fareBrand', many: true }),
    offerItems: relationship({ ref: 'OfferItem.fareBrand', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'cabin']),
    carrierRelationshipHooks({ cabin: { model: 'cabin' } }),
    commandOwnedRelationshipHooks(['rules', 'inventoryBuckets', 'offerItems']),
    {
      validate({ resolvedData, addValidationError }: any) {
        if (resolvedData.includedBaggage !== undefined) {
          try { normalizeIncludedBaggageSnapshot(resolvedData.includedBaggage) }
          catch (error) { addValidationError(error instanceof Error ? error.message : 'Included baggage policy is invalid.') }
        }
      },
    },
  ),
})
