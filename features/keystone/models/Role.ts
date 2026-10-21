import { list } from '@keystone-6/core'
import { relationship, text } from '@keystone-6/core/fields'

import {
  canCreateForSessionCarrier,
  canUpdateForSessionCarrier,
  freshCarrierFilter,
  hasFreshPermission,
  hasPermission,
  isFreshSignedIn,
} from '../access'
import { permissionFields } from './fields'
import { trackingFields } from './trackingFields'

export const canReadRolesAccess = (args: any) => isFreshSignedIn(args)
export async function roleReadFilter(args: any) {
  if (!(await isFreshSignedIn(args))) return false
  if (await hasFreshPermission(args, 'canReadRoles', 'canManageRoles')) return freshCarrierFilter(args)
  return { assignedTo: { some: { id: { equals: args.session.itemId } } } }
}
const canReadRolesUi = (args: any) => hasPermission(args, 'canReadRoles') || hasPermission(args, 'canManageRoles')

export const Role = list({
  access: {
    operation: {
      query: canReadRolesAccess,
      create: args => hasFreshPermission(args, 'canManageRoles'),
      update: args => hasFreshPermission(args, 'canManageRoles'),
      delete: args => hasFreshPermission(args, 'canManageRoles'),
    },
    filter: {
      query: roleReadFilter,
      update: freshCarrierFilter,
      delete: freshCarrierFilter,
    },
    item: {
      create: canCreateForSessionCarrier,
      update: canUpdateForSessionCarrier,
    },
  },
  ui: {
    hideCreate: args => !hasPermission(args, 'canManageRoles'),
    hideDelete: args => !hasPermission(args, 'canManageRoles'),
    isHidden: args => !canReadRolesUi(args),
    listView: { initialColumns: ['name', 'carrier', 'assignedTo'] },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    carrier: relationship({ ref: 'Carrier.roles' }),
    ...permissionFields,
    assignedTo: relationship({ ref: 'User.role', many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields,
  },
})
