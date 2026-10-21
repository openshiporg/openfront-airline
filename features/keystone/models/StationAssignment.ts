import { list } from '@keystone-6/core'
import { checkbox, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { carrierScopedAccess } from '../access'
import { carrierRelationshipHooks, chronologicalRangeHooks, combineListHooks, requiredRelationshipHooks } from '../lib/validation'
import { trackingFields } from './trackingFields'

export const StationAssignment = list({
  access: carrierScopedAccess('canReadUsers', 'canManageUsers'),
  ui: { labelField: 'assignmentKey', listView: { initialColumns: ['user', 'airport', 'status', 'validFrom', 'validUntil'] } },
  fields: {
    carrier: relationship({ ref: 'Carrier.stationAssignments' }),
    assignmentKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    user: relationship({ ref: 'User.stationAssignments' }),
    airport: relationship({ ref: 'Airport.stationAssignments' }),
    status: select({ type: 'enum', defaultValue: 'active', options: [
      { label: 'Active', value: 'active' }, { label: 'Suspended', value: 'suspended' }, { label: 'Revoked', value: 'revoked' },
    ] }),
    canCheckIn: checkbox({ defaultValue: false }),
    canAcceptBags: checkbox({ defaultValue: false }),
    canBoard: checkbox({ defaultValue: false }),
    validFrom: timestamp({ defaultValue: { kind: 'now' } }),
    validUntil: timestamp(),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'user', 'airport']),
    carrierRelationshipHooks({ user: { model: 'user' } }),
    // An inverted range would silently never take effect in station capability checks.
    chronologicalRangeHooks('validFrom', 'validUntil', 'Station assignment validity'),
    {
      async validate({ resolvedData, context, addValidationError }: any) {
        const airportId = resolvedData.airport?.connect?.id
        if (!airportId) return
        const airport = await context.prisma.airport.findUnique({ where: { id: airportId }, select: { isActive: true } })
        if (!airport?.isActive) addValidationError('Station assignments require an active airport.')
      },
    },
  ),
})
