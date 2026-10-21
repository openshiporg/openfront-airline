import { list } from '@keystone-6/core'
import { checkbox, integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { carrierScopedAccess } from '../access'
import {
  carrierRelationshipHooks,
  chronologicalRangeHooks,
  combineListHooks,
  commandOwnedRelationshipHooks,
  minorAmountHooks,
  requiredRelationshipHooks,
} from '../lib/validation'
import { trackingFields } from './trackingFields'

export const FareRule = list({
  access: carrierScopedAccess('canReadOffers', 'canManageOffers'),
  ui: {
    labelField: 'ruleKey',
    listView: { initialColumns: ['ruleKey', 'fareBrand', 'route', 'status', 'effectiveFrom', 'effectiveTo'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    ruleKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    fareBrand: relationship({ ref: 'FareBrand.rules' }),
    route: relationship({ ref: 'Route.fareRules' }),
    fareBasisPattern: text(),
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
    effectiveFrom: timestamp(),
    effectiveTo: timestamp(),
    travelFrom: timestamp(),
    travelTo: timestamp(),
    salesChannels: json({ defaultValue: [] }),
    passengerTypes: json({ defaultValue: ['adult'] }),
    minimumStayDays: integer({ validation: { min: 0 } }),
    maximumStayDays: integer({ validation: { min: 0 } }),
    minimumAdvancePurchaseHours: integer({ validation: { min: 0 } }),
    isRefundable: checkbox({ defaultValue: false }),
    isChangeable: checkbox({ defaultValue: false }),
    changeFeeAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    cancellationFeeAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    noShowFeeAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    currencyCode: text({
      defaultValue: 'USD',
      validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: 'Use an ISO 4217 currency code.' } },
    }),
    restrictions: json({ defaultValue: {} }),
    offerItems: relationship({ ref: 'OfferItem.fareRule', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'fareBrand']),
    carrierRelationshipHooks({ fareBrand: { model: 'fareBrand' }, route: { model: 'route' } }),
    commandOwnedRelationshipHooks(['offerItems']),
    chronologicalRangeHooks('effectiveFrom', 'effectiveTo', 'Fare-rule effective period'),
    chronologicalRangeHooks('travelFrom', 'travelTo', 'Fare-rule travel period'),
    minorAmountHooks(['changeFeeAmount', 'cancellationFeeAmount', 'noShowFeeAmount']),
  ),
})
