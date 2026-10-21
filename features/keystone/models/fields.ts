import { checkbox } from '@keystone-6/core/fields'

const permissionLabels = {
  canAccessDashboard: 'Access the operations dashboard',
  canManageCarriers: 'Manage carrier tenants and cross carrier boundaries',
  canReadUsers: 'Read carrier users',
  canManageUsers: 'Create and manage carrier users',
  canReadRoles: 'Read carrier roles',
  canManageRoles: 'Create and manage carrier roles',
  canManageAgents: 'Approve and manage travel sellers',
  canReadNetwork: 'Read airports, routes, schedules, and dated flights',
  canManageNetwork: 'Manage routes, schedules, dated flights, cabins, and seat maps',
  canReadInventory: 'Read commercial inventory and holds',
  canManageInventory: 'Manage commercial inventory and holds',
  canReadOffers: 'Read fares, products, and offers',
  canManageOffers: 'Manage fares, products, and offers',
  canReadBookings: 'Read bookings and immutable commercial lines',
  canManageBookings: 'Create and service bookings',
  canReadPassengers: 'Read passenger profiles',
  canManagePassengers: 'Manage passenger profiles and service requests',
  canManageSecurePassengerData: 'Read and manage encrypted travel-document data',
  canReadTicketing: 'Read tickets, coupons, and EMDs',
  canManageTicketing: 'Issue and service tickets, coupons, and EMDs',
  canReadPayments: 'Read payment and refund records',
  canManagePayments: 'Manage payment, refund, and exchange records',
  canReadAirportService: 'Read check-in, boarding, seat, and baggage records',
  canManageAirportService: 'Manage check-in, boarding, seat, and baggage records',
  canReadDisruptions: 'Read disruption and reaccommodation records',
  canManageDisruptions: 'Manage disruption and reaccommodation records',
  canReadIntegrations: 'Read provider and webhook health records',
  canManageIntegrations: 'Manage provider connections and webhooks',
  canReadAudit: 'Read carrier audit events',
  canManageOnboarding: 'Run carrier onboarding and runtime setup',
} as const

export type Permission = keyof typeof permissionLabels

type PermissionGrantArgs = {
  inputData?: Partial<Record<Permission, unknown>>
  context?: any
  session?: {
    data?: {
      role?: Partial<Record<Permission, boolean>> | null
    }
  } | null
}

export function canGrantPermission(args: PermissionGrantArgs, permission: Permission) {
  // Clearing/defaulting a capability cannot escalate privilege.
  if (args.inputData?.[permission] !== true) return true
  // Anonymous Role writes are still denied at list operation access; allowing
  // fields here keeps Keystone's one-time createInitialUser bootstrap working.
  if (!args.session) return true
  const role = args.session.data?.role
  if (role?.canManageCarriers === true) return true
  if (permission === 'canManageCarriers') return false
  return role?.[permission] === true
}

async function canGrantFreshPermission(args: PermissionGrantArgs, permission: Permission) {
  if (args.inputData?.[permission] !== true || !args.session) return true
  const userId = (args.session as any).itemId
  if (!userId || !args.context?.prisma) return false
  const user = await args.context.prisma.user.findUnique({
    where: { id: userId },
    select: { role: { select: { canManageCarriers: true, [permission]: true } } },
  })
  return canGrantPermission({ inputData: args.inputData, session: { data: { role: user?.role ?? null } } }, permission)
}

export const permissionFields = Object.fromEntries(
  Object.entries(permissionLabels).map(([key, label]) => [
    key,
    checkbox({
      defaultValue: false,
      label,
      access: {
        create: args => canGrantFreshPermission(args, key as Permission),
        update: args => canGrantFreshPermission(args, key as Permission),
      },
    }),
  ]),
) as Record<Permission, ReturnType<typeof checkbox>>

export const permissionsList = Object.keys(permissionLabels) as Permission[]

export const immutableFieldAccess = {
  update: () => false,
}

export const hiddenSensitiveUi = {
  createView: { fieldMode: 'hidden' as const },
  itemView: { fieldMode: 'hidden' as const },
  listView: { fieldMode: 'hidden' as const },
}
