import { list } from '@keystone-6/core'
import { relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyGraphql, hasFreshPermission, stationScopedCommandAccess } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import { combineListHooks, requiredRelationshipHooks } from '../lib/validation'
import { hiddenSensitiveUi, immutableFieldAccess } from './fields'
import { trackingFields } from './trackingFields'

const manageAirportService = (args: any) => hasFreshPermission(args, 'canManageAirportService')

export const BoardingPass = list({
  access: stationScopedCommandAccess('canReadAirportService', 'canManageAirportService', 'bookingSegment.flightInstance.origin', 'canBoard'),
  graphql: commandOnlyGraphql(),
  ui: { labelField: 'passNumber', listView: { initialColumns: ['passNumber', 'passenger', 'bookingSegment', 'status', 'boardingGroup', 'issuedAt'] }, hideDelete: true },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    passNumber: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    checkIn: relationship({ ref: 'CheckIn.boardingPasses', access: immutableFieldAccess }),
    passenger: relationship({ ref: 'Passenger.boardingPasses', access: immutableFieldAccess }),
    bookingSegment: relationship({ ref: 'BookingSegment', access: immutableFieldAccess }),
    seatAssignment: relationship({ ref: 'SeatAssignment', access: immutableFieldAccess }),
    status: select({ type: 'enum', defaultValue: 'issued', options: [
      { label: 'Issued', value: 'issued' }, { label: 'Reissued', value: 'reissued' },
      { label: 'Boarded', value: 'boarded' }, { label: 'Revoked', value: 'revoked' },
    ] }),
    barcodeToken: text({
      access: { read: manageAirportService, create: manageAirportService, update: manageAirportService },
      ui: hiddenSensitiveUi,
    }),
    seatDesignatorSnapshot: text({ access: immutableFieldAccess }),
    boardingGroup: text(), boardingZone: text(), sequenceNumber: text(),
    gateSnapshot: text(), terminalSnapshot: text(),
    issuedAt: timestamp({ defaultValue: { kind: 'now' }, access: immutableFieldAccess }),
    boardedAt: timestamp(), revokedAt: timestamp(),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'checkIn', 'passenger', 'bookingSegment']),
    lifecycleHooks('boardingPass'),
  ),
})
