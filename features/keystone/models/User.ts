import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { password, relationship, select, text } from '@keystone-6/core/fields'

import {
  canAssignUserRole,
  canCreateForSessionCarrier,
  canManageTargetUser,
  canUpdateForSessionCarrier,
  hasFreshPermission,
  hasPermission,
  isFreshSignedIn,
  userReadFilter,
  userUpdateFilter,
} from '../access'
import { ensureInitialCarrierAndRole, validateInitialOperatorInput } from '../lib/initial-operator-setup'
import { permissionsList } from './fields'
import { trackingFields } from './trackingFields'

const canCreateUser = (args: any) => args.session
  ? hasFreshPermission(args, 'canManageUsers', 'canManageCarriers')
  : false
const canManageUsersAccess = (args: any) => hasFreshPermission(args, 'canManageUsers', 'canManageCarriers')
const canManageUsersUi = (args: any) => hasPermission(args, 'canManageUsers') || hasPermission(args, 'canManageCarriers')

function connectedId(value: any) {
  return typeof value?.connect?.id === 'string' ? value.connect.id : typeof value?.id === 'string' ? value.id : null
}

async function canAssignCarrierRelationship(args: any, model: 'role' | 'approvedAgent') {
  const mayAssign = model === 'role'
    ? await canManageUsersAccess(args)
    : await hasFreshPermission(args, 'canManageUsers', 'canManageCarriers', 'canManageAgents')
  if (!mayAssign) return false
  if (args.inputData?.[model] === undefined || args.inputData[model]?.disconnect === true) return true
  const relatedId = connectedId(args.inputData[model])
  const carrierId = args.item?.carrierId ?? connectedId(args.inputData?.carrier)
  if (!relatedId || !carrierId) return false
  const related = await args.context.prisma[model].findUnique({ where: { id: relatedId }, select: { carrierId: true } })
  return related?.carrierId === carrierId
}

export const User = list({
  access: {
    operation: {
      query: isFreshSignedIn,
      create: canCreateUser,
      update: isFreshSignedIn,
      delete: canManageUsersAccess,
    },
    filter: {
      query: userReadFilter,
      update: userUpdateFilter,
      delete: userUpdateFilter,
    },
    item: {
      // Public signup cannot set carrier/role fields; authenticated managers
      // must create users in their own carrier unless they are platform admins.
      create: args => !args.session || canCreateForSessionCarrier(args),
      update: canUpdateForSessionCarrier,
      // Deleting an account removes its sign-in authority, so it is held to the same fresh target-role ceiling as
      // changing that account's credentials: a delegated manager cannot delete a peer or superior.
      delete: canManageTargetUser,
    },
  },
  ui: {
    hideCreate: args => !canManageUsersUi(args),
    hideDelete: args => !canManageUsersUi(args),
    listView: { initialColumns: ['name', 'email', 'carrier', 'role', 'approvedAgent'] },
    itemView: {
      defaultFieldMode: ({ session, item }) =>
        canManageUsersUi({ session }) || session?.itemId === item?.id ? 'edit' : 'read',
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    email: text({
      isIndexed: 'unique',
      validation: { isRequired: true },
      isFilterable: false,
      isOrderable: false,
      access: { create: canManageUsersAccess, update: canManageTargetUser },
    }),
    password: password({
      access: {
        read: denyAll,
        create: canManageUsersAccess,
        update: canManageTargetUser,
      },
      validation: {
        isRequired: true,
        length: { min: 10, max: 1000 },
        rejectCommon: true,
      },
    }),
    carrier: relationship({
      ref: 'Carrier.users',
      access: { create: canManageUsersAccess, update: canManageUsersAccess },
    }),
    role: relationship({
      ref: 'Role.assignedTo',
      access: {
        create: args => canAssignCarrierRelationship(args, 'role').then(allowed => allowed && canAssignUserRole(args)),
        update: args => canAssignCarrierRelationship(args, 'role').then(allowed => allowed && canAssignUserRole(args)),
      },
    }),
    approvedAgent: relationship({
      ref: 'ApprovedAgent.users',
      access: {
        create: args => canAssignCarrierRelationship(args, 'approvedAgent'),
        update: args => canAssignCarrierRelationship(args, 'approvedAgent'),
      },
    }),
    onboardingStatus: select({
      type: 'enum',
      defaultValue: 'not_started',
      options: [
        { label: 'Not started', value: 'not_started' },
        { label: 'In progress', value: 'in_progress' },
        { label: 'Completed', value: 'completed' },
        { label: 'Dismissed', value: 'dismissed' },
      ],
      access: { create: () => false, update: () => false },
      graphql: { omit: { create: true, update: true } },
    }),
    passengerProfile: relationship({ ref: 'Passenger.userAccount', access: { create: () => false, update: () => false } }),
    offers: relationship({ ref: 'Offer.customer', many: true, access: { create: () => false, update: () => false } }),
    bookings: relationship({ ref: 'Booking.customer', many: true, access: { create: () => false, update: () => false } }),
    auditEvents: relationship({ ref: 'AuditEvent.actor', many: true, access: { create: () => false, update: () => false } }),
    stationAssignments: relationship({ ref: 'StationAssignment.user', many: true, access: { create: () => false, update: () => false } }),
    documentVerifications: relationship({ ref: 'DocumentVerification.verifiedBy', many: true, access: { create: () => false, update: () => false } }),
    submittedPaymentEvidence: relationship({ ref: 'ManualPaymentEvidence.submittedBy', many: true, access: { create: () => false, update: () => false } }),
    approvedPaymentEvidence: relationship({ ref: 'ManualPaymentEvidence.approvedBy', many: true, access: { create: () => false, update: () => false } }),
    onboardingSteps: relationship({ ref: 'OnboardingStep.user', many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields,
  },
  hooks: {
    // First-run setup (createInitialUser, no session, empty user table) attaches the operator to the carrier and
    // full-permission role from ensureInitialCarrierAndRole. Invalid details write nothing: validate rejects them.
    async resolveInput({ operation, resolvedData, inputData, context }: any) {
      if (operation !== 'create' || context.session) return resolvedData
      if (await context.prisma.user.count() !== 0) return resolvedData
      try {
        validateInitialOperatorInput({ name: String(inputData.name ?? ''), email: String(inputData.email ?? ''), password: String(inputData.password ?? '') })
      } catch {
        return resolvedData
      }
      const { carrierId, roleId } = await ensureInitialCarrierAndRole(context.prisma, permissionsList)
      return { ...resolvedData, carrier: { connect: { id: carrierId } }, role: { connect: { id: roleId } } }
    },
    // createInitialUser runs without a session while no user exists. Hold that first operator to the launch policy
    // (name, email and password rules).
    async validate({ operation, inputData, context, addValidationError }: any) {
      if (operation !== 'create' || context.session) return
      if (await context.prisma.user.count() !== 0) return
      try {
        validateInitialOperatorInput({ name: String(inputData.name ?? ''), email: String(inputData.email ?? ''), password: String(inputData.password ?? '') })
      } catch (error) {
        addValidationError(error instanceof Error ? error.message : 'Initial operator details are invalid.')
      }
    },
  },
})
