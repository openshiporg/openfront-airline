import { list } from '@keystone-6/core'
import { checkbox, relationship, text } from '@keystone-6/core/fields'

import { commandOnlyGraphql, hasFreshPermission } from '../access'
import { trackingFields } from './trackingFields'

const canReadAirport = (args: any) => hasFreshPermission(
  args,
  'canReadNetwork', 'canManageNetwork', 'canReadOffers', 'canManageOffers',
  'canReadBookings', 'canManageBookings', 'canReadAirportService', 'canManageAirportService',
)

export const Airport = list({
  access: {
    operation: {
      query: canReadAirport,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
  },
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'iataCode',
    listView: { initialColumns: ['iataCode', 'name', 'city', 'countryCode', 'timezone'] },
    hideDelete: true,
  },
  fields: {
    iataCode: text({
      isIndexed: 'unique',
      validation: { isRequired: true, match: { regex: /^[A-Z0-9]{3}$/, explanation: 'Use a three-character IATA location code.' } },
    }),
    icaoCode: text({
      isIndexed: 'unique',
      db: { isNullable: true },
      validation: { match: { regex: /^[A-Z0-9]{4}$/, explanation: 'Use a four-character ICAO airport code.' } },
    }),
    name: text({ validation: { isRequired: true } }),
    city: text({ validation: { isRequired: true } }),
    subdivisionCode: text(),
    countryCode: text({
      validation: { isRequired: true, match: { regex: /^[A-Z]{2}$/, explanation: 'Use an ISO 3166-1 alpha-2 country code.' } },
    }),
    timezone: text({ validation: { isRequired: true } }),
    isActive: checkbox({ defaultValue: true }),
    departingRoutes: relationship({ ref: 'Route.origin', many: true }),
    arrivingRoutes: relationship({ ref: 'Route.destination', many: true }),
    departingFlights: relationship({ ref: 'FlightInstance.origin', many: true }),
    arrivingFlights: relationship({ ref: 'FlightInstance.destination', many: true }),
    bagEvents: relationship({ ref: 'BagEvent.airport', many: true }),
    stationAssignments: relationship({ ref: 'StationAssignment.airport', many: true }),
    ...trackingFields,
  },
})
