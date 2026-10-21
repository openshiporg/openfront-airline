import { list } from '@keystone-6/core'
import { checkbox, integer, relationship, select, text } from '@keystone-6/core/fields'

import { carrierScopedAccess } from '../access'
import { combineListHooks, commandOwnedRelationshipHooks, requiredRelationshipHooks } from '../lib/validation'
import { trackingFields } from './trackingFields'

// Schedules and dated flights copy their airports from the route at creation, so a route that is in use cannot be
// renamed or re-pointed to other airports.
const routeIdentityHooks = {
  async validate({ operation, resolvedData, item, context, addValidationError }: any) {
    if (operation !== 'update') return
    const relationChanged = (field: 'origin' | 'destination') => resolvedData[field] !== undefined && resolvedData[field]?.connect?.id !== item?.[`${field}Id`]
    if (!((resolvedData.routeKey !== undefined && resolvedData.routeKey !== item?.routeKey) || relationChanged('origin') || relationChanged('destination'))) return
    const [schedules, flights] = await Promise.all([
      context.prisma.flightSchedule.count({ where: { routeId: item.id } }),
      context.prisma.flightInstance.count({ where: { routeId: item.id } }),
    ])
    if (schedules + flights > 0) addValidationError('Route key, origin, and destination are fixed once schedules or dated flights use the route.')
  },
}

export const Route = list({
  access: carrierScopedAccess('canReadNetwork', 'canManageNetwork'),
  ui: {
    labelField: 'routeKey',
    listView: { initialColumns: ['routeKey', 'origin', 'destination', 'status', 'distanceKilometers'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier.routes' }),
    routeKey: text({
      isIndexed: 'unique',
      validation: { isRequired: true, match: { regex: /^[A-Z0-9]{2,3}:[A-Z0-9]{3}:[A-Z0-9]{3}$/, explanation: 'Use CARRIER:ORIGIN:DESTINATION.' } },
    }),
    origin: relationship({ ref: 'Airport.departingRoutes' }),
    destination: relationship({ ref: 'Airport.arrivingRoutes' }),
    status: select({
      type: 'enum',
      defaultValue: 'active',
      validation: { isRequired: true },
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Archived', value: 'archived' },
      ],
    }),
    distanceKilometers: integer({ validation: { min: 0 } }),
    minimumConnectionMinutes: integer({ validation: { min: 0 } }),
    isInternational: checkbox({ defaultValue: false }),
    schedules: relationship({ ref: 'FlightSchedule.route', many: true }),
    flightInstances: relationship({ ref: 'FlightInstance.route', many: true }),
    fareRules: relationship({ ref: 'FareRule.route', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'origin', 'destination']),
    commandOwnedRelationshipHooks(['schedules', 'flightInstances', 'fareRules']),
    routeIdentityHooks,
  ),
})
