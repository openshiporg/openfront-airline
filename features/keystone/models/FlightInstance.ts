import { list } from '@keystone-6/core'
import { relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { lifecycleHooks } from '../lib/lifecycle'
import {
  carrierRelationshipHooks,
  chronologicalRangeHooks,
  combineListHooks,
  requiredRelationshipHooks,
} from '../lib/validation'
import { trackingFields } from './trackingFields'

export const FlightInstance = list({
  access: commandOnlyCarrierAccess('canReadNetwork', 'canManageNetwork'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'instanceKey',
    listView: { initialColumns: ['flightNumber', 'serviceDate', 'origin', 'destination', 'status'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier.flightInstances' }),
    instanceKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    schedule: relationship({ ref: 'FlightSchedule.instances' }),
    route: relationship({ ref: 'Route.flightInstances' }),
    origin: relationship({ ref: 'Airport.departingFlights' }),
    destination: relationship({ ref: 'Airport.arrivingFlights' }),
    operatingCarrier: relationship({ ref: 'Carrier' }),
    flightNumber: text({ validation: { isRequired: true } }),
    serviceDate: timestamp({ validation: { isRequired: true }, isIndexed: true }),
    scheduledDepartureAt: timestamp({ validation: { isRequired: true }, isIndexed: true }),
    scheduledArrivalAt: timestamp({ validation: { isRequired: true }, isIndexed: true }),
    estimatedDepartureAt: timestamp(),
    estimatedArrivalAt: timestamp(),
    actualDepartureAt: timestamp(),
    actualArrivalAt: timestamp(),
    departureTerminal: text(),
    departureGate: text(),
    arrivalTerminal: text(),
    arrivalGate: text(),
    status: select({
      type: 'enum',
      defaultValue: 'scheduled',
      validation: { isRequired: true },
      options: [
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Open for sale', value: 'open_for_sale' },
        { label: 'Closed for sale', value: 'closed_for_sale' },
        { label: 'Delayed', value: 'delayed' },
        { label: 'Departed', value: 'departed' },
        { label: 'Arrived', value: 'arrived' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    }),
    inventoryBuckets: relationship({ ref: 'InventoryBucket.flightInstance', many: true }),
    seatMaps: relationship({ ref: 'SeatMap.flightInstance', many: true }),
    bookingSegments: relationship({ ref: 'BookingSegment.flightInstance', many: true }),
    checkIns: relationship({ ref: 'CheckIn.flightInstance', many: true }),
    bags: relationship({ ref: 'Bag.flightInstance', many: true }),
    disruptions: relationship({ ref: 'Disruption.flightInstance', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'route', 'origin', 'destination']),
    carrierRelationshipHooks({ schedule: { model: 'flightSchedule' }, route: { model: 'route' }, operatingCarrier: { model: 'carrier', carrierField: 'id' } }),
    chronologicalRangeHooks('scheduledDepartureAt', 'scheduledArrivalAt', 'Scheduled flight'),
    lifecycleHooks('flightInstance'),
  ),
})
