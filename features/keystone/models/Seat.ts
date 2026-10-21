import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text } from '@keystone-6/core/fields'

import { carrierScopedAccess } from '../access'
import { carrierRelationshipHooks, combineListHooks, commandOwnedRelationshipHooks, minorAmountHooks, requiredRelationshipHooks } from '../lib/validation'
import { immutableFieldAccess } from './fields'
import { trackingFields } from './trackingFields'

export const Seat = list({
  access: carrierScopedAccess('canReadNetwork', 'canManageNetwork'),
  ui: {
    labelField: 'designator',
    listView: { initialColumns: ['designator', 'seatMap', 'cabin', 'status', 'surchargeAmount'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    seatKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    // Seat-map structure is fixed at creation (SeatMap itself is command-only); status, type, and surcharge stay editable.
    seatMap: relationship({ ref: 'SeatMap.seats', access: immutableFieldAccess }),
    cabin: relationship({ ref: 'Cabin.seats', access: immutableFieldAccess }),
    designator: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    rowNumber: integer({ validation: { isRequired: true, min: 1 }, access: immutableFieldAccess }),
    columnCode: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    status: select({
      type: 'enum',
      defaultValue: 'available',
      options: [
        { label: 'Available', value: 'available' },
        { label: 'Blocked', value: 'blocked' },
        { label: 'Unavailable', value: 'unavailable' },
      ],
    }),
    seatType: select({
      type: 'enum',
      defaultValue: 'standard',
      options: [
        { label: 'Standard', value: 'standard' },
        { label: 'Preferred', value: 'preferred' },
        { label: 'Extra legroom', value: 'extra_legroom' },
        { label: 'Bassinet', value: 'bassinet' },
        { label: 'Restricted', value: 'restricted' },
      ],
    }),
    characteristics: json({ defaultValue: [] }),
    surchargeAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    currencyCode: text({ defaultValue: 'USD', validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: 'Use an ISO 4217 currency code.' } } }),
    assignments: relationship({ ref: 'SeatAssignment.seat', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'seatMap', 'cabin']),
    carrierRelationshipHooks({ seatMap: { model: 'seatMap' }, cabin: { model: 'cabin' } }),
    commandOwnedRelationshipHooks(['assignments']),
    minorAmountHooks(['surchargeAmount']),
  ),
})
