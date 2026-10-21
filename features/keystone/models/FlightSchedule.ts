import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { carrierScopedAccess } from '../access'
import {
  carrierRelationshipHooks,
  chronologicalRangeHooks,
  commandOwnedRelationshipHooks,
  combineListHooks,
  requiredRelationshipHooks,
} from '../lib/validation'
import { trackingFields } from './trackingFields'

export const FlightSchedule = list({
  access: carrierScopedAccess('canReadNetwork', 'canManageNetwork'),
  ui: {
    labelField: 'scheduleKey',
    listView: { initialColumns: ['flightNumber', 'route', 'effectiveFrom', 'effectiveTo', 'status'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier.schedules' }),
    scheduleKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    route: relationship({ ref: 'Route.schedules' }),
    operatingCarrier: relationship({ ref: 'Carrier' }),
    flightNumber: text({
      validation: { isRequired: true, match: { regex: /^[A-Z0-9]{2,3}\s?[0-9]{1,4}[A-Z]?$/, explanation: 'Use a carrier designator and service number.' } },
    }),
    serviceSuffix: text(),
    departureLocalTime: text({
      validation: { isRequired: true, match: { regex: /^([01]\d|2[0-3]):[0-5]\d$/, explanation: 'Use 24-hour HH:mm.' } },
    }),
    arrivalLocalTime: text({
      validation: { isRequired: true, match: { regex: /^([01]\d|2[0-3]):[0-5]\d$/, explanation: 'Use 24-hour HH:mm.' } },
    }),
    arrivalDayOffset: integer({ defaultValue: 0, validation: { min: -1, max: 2 } }),
    daysOfWeek: json({ defaultValue: [] }),
    effectiveFrom: timestamp(),
    effectiveTo: timestamp(),
    status: select({
      type: 'enum',
      defaultValue: 'draft',
      validation: { isRequired: true },
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Retired', value: 'retired' },
      ],
    }),
    instances: relationship({ ref: 'FlightInstance.schedule', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    {
      // Provisioning reads ISO weekdays (Monday 1 … Sunday 7) and treats an empty list as every day.
      validate({ resolvedData, addValidationError }: any) {
        const days = resolvedData.daysOfWeek
        if (days === undefined) return
        if (!Array.isArray(days) || days.some(day => !Number.isInteger(day) || day < 1 || day > 7) || new Set(days).size !== days.length) {
          addValidationError('Days of week must be unique ISO weekday numbers from 1 (Monday) to 7 (Sunday).')
        }
      },
    },
    requiredRelationshipHooks(['carrier', 'route']),
    carrierRelationshipHooks({ route: { model: 'route' }, operatingCarrier: { model: 'carrier', carrierField: 'id' } }),
    commandOwnedRelationshipHooks(['instances']),
    chronologicalRangeHooks('effectiveFrom', 'effectiveTo', 'Schedule effective period'),
  ),
})
