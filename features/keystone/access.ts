import { DomainError } from './lib/domain-error'
import { permissionsList, type Permission } from './models/fields'

export type SessionRole = {
  id: string
  name: string
} & Partial<Record<Permission, boolean>>

export type Session = {
  itemId: string
  listKey: string
  data: {
    name: string
    email: string
    carrier?: { id: string; code?: string | null } | null
    approvedAgent?: { id: string; status?: string | null } | null
    role?: SessionRole | null
  }
}

export type AccessArgs = {
  session?: Session | null
  context?: any
}

type ItemAccessArgs = AccessArgs & {
  inputData?: Record<string, any>
  item?: Record<string, any>
}

type CarrierAccessOptions = {
  appendOnly?: boolean
  allowDelete?: boolean
  carrierPath?: string
}

export function isSignedIn({ session }: AccessArgs) {
  return Boolean(session?.itemId)
}

export function hasPermission({ session }: AccessArgs, permission: Permission) {
  if (!session?.data.role || !permissionsList.includes(permission)) return false
  return session.data.role[permission] === true
}

export const permissions = Object.fromEntries(
  permissionsList.map(permission => [
    permission,
    (args: AccessArgs) => hasPermission(args, permission),
  ]),
) as Record<Permission, (args: AccessArgs) => boolean>

type FreshSessionActor = {
  id: string
  carrierId: string | null
  approvedAgent: { id: string; status: string | null } | null
  role: SessionRole | null
}

async function freshSessionActor(args: AccessArgs): Promise<FreshSessionActor | null> {
  if (!args.session?.itemId || args.session.listKey !== 'User' || !args.context?.prisma) return null
  return args.context.prisma.user.findUnique({
    where: { id: args.session.itemId },
    select: {
      id: true,
      carrierId: true,
      approvedAgent: { select: { id: true, status: true } },
      role: { select: Object.fromEntries(['id', 'name', ...permissionsList].map(name => [name, true])) },
    },
  })
}

type UserAuthority = Partial<Record<Permission, boolean>> | null | undefined

/** A delegated account may only grant a role whose every capability it holds. */
export function roleWithinGrantCeiling(actorRole: UserAuthority, targetRole: UserAuthority) {
  if (!actorRole) return false
  if (actorRole.canManageCarriers === true) return true
  return permissionsList.every(permission => targetRole?.[permission] !== true || actorRole[permission] === true)
}

/** Protect credentials of peers/superiors while still allowing a user to manage their own sign-in details. */
export async function canManageTargetUser(args: ItemAccessArgs) {
  const actor = await freshSessionActor(args)
  const targetId = typeof args.item?.id === 'string' ? args.item.id : null
  if (!actor?.role || !targetId) return false
  if (targetId === actor.id) return true
  if (actor.role.canManageCarriers === true) return true
  if (actor.role.canManageUsers !== true || !actor.carrierId) return false
  const target = await args.context.prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, carrierId: true, role: { select: Object.fromEntries(['id', 'name', ...permissionsList].map(name => [name, true])) } },
  })
  return Boolean(target && target.carrierId === actor.carrierId && roleWithinGrantCeiling(actor.role, target.role))
}

/**
 * Role relationships are an alternate privilege grant path, so validate the
 * target role itself against the actor's fresh capability ceiling. Self-role
 * changes are reserved to platform administrators.
 */
export async function canAssignUserRole(args: ItemAccessArgs) {
  const actor = await freshSessionActor(args)
  if (!actor?.role) return false
  const requestedRole = args.inputData?.role
  if (requestedRole === undefined) return true
  if (actor.role.canManageCarriers !== true && actor.role.canManageUsers !== true) return false
  if (args.item?.id === actor.id && actor.role.canManageCarriers !== true) return false
  if (requestedRole?.disconnect === true || requestedRole === null) return actor.role.canManageCarriers === true
  const roleId = connectedId(requestedRole)
  if (!roleId) return false
  const targetCarrierId = typeof args.item?.carrierId === 'string'
    ? args.item.carrierId
    : connectedId(args.inputData?.carrier)
  if (!targetCarrierId || (actor.role.canManageCarriers !== true && targetCarrierId !== actor.carrierId)) return false
  const targetRole = await args.context.prisma.role.findUnique({
    where: { id: roleId },
    select: { carrierId: true, ...Object.fromEntries(permissionsList.map(permission => [permission, true])) },
  })
  return Boolean(
    targetRole && targetRole.carrierId === targetCarrierId
    && roleWithinGrantCeiling(actor.role, targetRole),
  )
}

export async function isFreshSignedIn(args: AccessArgs) {
  return Boolean((await freshSessionActor(args))?.role)
}

export async function hasFreshPermission(args: AccessArgs, ...required: Permission[]) {
  const actor = await freshSessionActor(args)
  return Boolean(actor?.role && required.some(permission => actor.role?.[permission] === true))
}

export async function freshCarrierFilter(args: AccessArgs, carrierPath = 'carrier'): Promise<boolean | Record<string, any>> {
  const actor = await freshSessionActor(args)
  if (!actor?.role) return false
  if (actor.role.canManageCarriers === true) return true
  return actor.carrierId ? nestedRelationshipFilter(carrierPath, actor.carrierId) : false
}

function nestedRelationshipFilter(path: string, id: string | { in: string[] }) {
  const parts = path.split('.').filter(Boolean)
  return parts.reduceRight<Record<string, any>>(
    (filter, relationship) => ({ [relationship]: filter }),
    { id: typeof id === 'string' ? { equals: id } : id },
  )
}

export function carrierFilter(
  { session }: AccessArgs,
  carrierPath = 'carrier',
): boolean | Record<string, any> {
  if (!session) return false
  if (hasPermission({ session }, 'canManageCarriers')) return true
  const carrierId = session.data.carrier?.id
  if (!carrierId) return false
  return nestedRelationshipFilter(carrierPath, carrierId)
}

function connectedId(value: any): string | null {
  if (typeof value === 'string') return value
  if (typeof value?.id === 'string') return value.id
  if (typeof value?.connect?.id === 'string') return value.connect.id
  return null
}

export async function canCreateForSessionCarrier(args: ItemAccessArgs) {
  const actor = await freshSessionActor(args)
  if (!actor?.role) return false
  if (actor.role.canManageCarriers === true) return true
  return Boolean(actor.carrierId && connectedId(args.inputData?.carrier) === actor.carrierId)
}

export async function canUpdateForSessionCarrier(args: ItemAccessArgs) {
  const actor = await freshSessionActor(args)
  if (!actor?.role) return false
  if (args.inputData?.carrier === undefined) return true
  const requestedCarrierId = connectedId(args.inputData.carrier)
  if (!requestedCarrierId) return false

  // Tenant ownership is immutable once assigned, including for platform admins.
  // This keeps audit/idempotency namespaces and historical aggregates stable.
  const currentCarrierId = typeof args.item?.carrierId === 'string' ? args.item.carrierId : null
  if (currentCarrierId) return requestedCarrierId === currentCarrierId
  if (actor.role.canManageCarriers === true) return true
  return requestedCarrierId === actor.carrierId
}

export function carrierScopedAccess(
  readPermission: Permission,
  managePermission: Permission,
  options: CarrierAccessOptions = {},
) {
  const appendOnly = options.appendOnly ?? false
  const allowDelete = options.allowDelete ?? false
  const carrierPath = options.carrierPath ?? 'carrier'
  const canRead = (args: AccessArgs) => hasFreshPermission(args, readPermission, managePermission)
  const canManage = (args: AccessArgs) => hasFreshPermission(args, managePermission)
  const scoped = (args: AccessArgs) => freshCarrierFilter(args, carrierPath)

  return {
    operation: {
      query: canRead,
      create: canManage,
      update: appendOnly ? () => false : canManage,
      delete: appendOnly || !allowDelete ? () => false : canManage,
    },
    filter: {
      query: scoped,
      update: scoped,
      delete: scoped,
    },
    item: {
      create: canCreateForSessionCarrier,
      update: canUpdateForSessionCarrier,
    },
  }
}

export function commandOnlyCarrierAccess(
  readPermission: Permission,
  managePermission: Permission,
  carrierPath = 'carrier',
) {
  const canRead = (args: AccessArgs) => hasFreshPermission(args, readPermission, managePermission)
  return {
    operation: { query: canRead, create: () => false, update: () => false, delete: () => false },
    filter: { query: (args: AccessArgs) => freshCarrierFilter(args, carrierPath) },
  }
}

export function stationScopedCommandAccess(
  readPermission: Permission,
  managePermission: Permission,
  airportPath: string,
  capability: 'canCheckIn' | 'canAcceptBags' | 'canBoard',
) {
  const canRead = (args: AccessArgs) => hasFreshPermission(args, readPermission, managePermission)
  return {
    operation: { query: canRead, create: () => false, update: () => false, delete: () => false },
    filter: {
      query: async (args: any) => {
        const carrierScope = await freshCarrierFilter(args)
        if (carrierScope === false) return false
        const actor = await freshSessionActor(args)
        if (!actor?.role) return false
        if (actor.role.canManageCarriers === true) return carrierScope
        const userId = actor.id
        const carrierId = actor.carrierId
        if (!carrierId) return false
        const assignments = await args.context.prisma.stationAssignment.findMany({
          where: { userId, carrierId, status: 'active', [capability]: true, validFrom: { lte: new Date() }, OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }] },
          select: { airportId: true },
        })
        const airportIds = assignments.map((entry: any) => entry.airportId).filter(Boolean)
        if (!airportIds.length) return false
        return { AND: [carrierScope, nestedRelationshipFilter(airportPath, { in: airportIds })] }
      },
    },
  }
}

export function commandOnlyGraphql() {
  return { omit: { create: true, update: true, delete: true } } as const
}

export function globalReferenceAccess(readPermission: Permission, managePermission: Permission) {
  const canRead = (args: AccessArgs) => hasFreshPermission(args, readPermission, managePermission)
  const canManage = (args: AccessArgs) => hasFreshPermission(args, managePermission)
  return {
    operation: { query: canRead, create: canManage, update: canManage, delete: canManage },
  }
}

export async function userReadFilter(args: AccessArgs) {
  const actor = await freshSessionActor(args)
  if (!actor?.role) return false
  if (actor.role.canManageCarriers === true) return true
  if (actor.role.canReadUsers === true || actor.role.canManageUsers === true) return actor.carrierId ? nestedRelationshipFilter('carrier', actor.carrierId) : false
  return { id: { equals: actor.id } }
}

export async function userUpdateFilter(args: AccessArgs) {
  const actor = await freshSessionActor(args)
  if (!actor?.role) return false
  if (actor.role.canManageCarriers === true) return true
  if (actor.role.canManageUsers === true) return actor.carrierId ? nestedRelationshipFilter('carrier', actor.carrierId) : false
  return { id: { equals: actor.id } }
}

export async function approvedAgentBookingFilter(args: AccessArgs) {
  const actor = await freshSessionActor(args)
  if (!actor?.role) return false
  const carrierScope = actor.role.canManageCarriers === true ? true : actor.carrierId ? nestedRelationshipFilter('carrier', actor.carrierId) : false
  if (carrierScope === false) return false
  if (actor.role.canManageBookings === true) return carrierScope
  const approvedAgentId = actor.approvedAgent?.status === 'approved' ? actor.approvedAgent.id : null
  if (!approvedAgentId) return false
  return {
    AND: [
      carrierScope,
      { approvedAgent: { id: { equals: approvedAgentId } } },
    ],
  }
}

export function canReadSecurePassengerData(args: AccessArgs) {
  return hasFreshPermission(args, 'canManageSecurePassengerData')
}

export function canReadIntegrationSecrets(args: AccessArgs) {
  return hasFreshPermission(args, 'canManageIntegrations')
}

export function canReadPaymentSecrets(args: AccessArgs) {
  return hasFreshPermission(args, 'canManagePayments')
}

export function assertCarrierPermission(
  session: Session | null | undefined,
  permission: Permission,
  carrierId: string,
) {
  if (!session?.itemId) throw new DomainError('You must be signed in.', 'FORBIDDEN')
  if (!hasPermission({ session }, permission)) {
    throw new DomainError(`You do not have ${permission} permission.`, 'FORBIDDEN')
  }
  if (
    !hasPermission({ session }, 'canManageCarriers') &&
    session.data.carrier?.id !== carrierId
  ) {
    throw new DomainError('The requested record is outside your carrier.', 'FORBIDDEN')
  }
}

type FreshActor = {
  itemId: string
  carrierId: string
  canManageCarriers: boolean
}

export async function requireFreshPermission(context: any, permission: Permission): Promise<FreshActor> {
  const session = context.session as Session | null | undefined
  if (!session?.itemId || session.listKey !== 'User') throw new DomainError('Resource not found or inaccessible.', 'NOT_FOUND')
  const user = await context.prisma.user.findUnique({
    where: { id: session.itemId },
    select: { id: true, carrierId: true, role: { select: Object.fromEntries([...permissionsList, 'id'].map(name => [name, true])) } },
  })
  if (!user?.role || user.role[permission] !== true || !user.carrierId) throw new DomainError('Resource not found or inaccessible.', 'NOT_FOUND')
  return { itemId: user.id, carrierId: user.carrierId, canManageCarriers: user.role.canManageCarriers === true }
}

export async function requireFreshCarrierPermission(context: any, permission: Permission, carrierId: string) {
  const actor = await requireFreshPermission(context, permission)
  if (!actor.canManageCarriers && actor.carrierId !== carrierId) throw new DomainError('Resource not found or inaccessible.', 'NOT_FOUND')
  return actor
}

export async function requireStationCapability(
  context: any,
  permission: Permission,
  carrierId: string,
  airportId: string,
  capability: 'canCheckIn' | 'canAcceptBags' | 'canBoard',
) {
  const actor = await requireFreshCarrierPermission(context, permission, carrierId)
  if (actor.canManageCarriers) return actor
  const assignment = await context.prisma.stationAssignment.findFirst({
    where: {
      userId: actor.itemId, carrierId, airportId, status: 'active', [capability]: true,
      validFrom: { lte: new Date() }, OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
    },
    select: { id: true },
  })
  if (!assignment) throw new DomainError('Resource not found or inaccessible.', 'NOT_FOUND')
  return actor
}

export const rules = {
  canReadPeople: userReadFilter,
  canUpdatePeople: userUpdateFilter,
}
