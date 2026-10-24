// As in E-commerce: first-run setup is open while the database has no user. Keystone's initFirstItem mutation and
// redirectToInit both refuse once any user exists, so this only governs the empty-database window.
export function initialOperatorSetupEnabled(_env: NodeJS.ProcessEnv = process.env) {
  return true
}

export function validateInitialOperatorInput(input: { name: string; email: string; password: string }) {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  if (!name || name.length > 120) throw new Error('Operator name is required and must be at most 120 characters.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Enter a valid operator email address.')
  // Same rule as every account, and as E-commerce (the shared setup form describes no other): the password field
  // requires 10+ characters and rejects common passwords.
  if (input.password.length < 10 || input.password.length > 1000) throw new Error('The initial operator password must contain at least 10 characters.')
  return { name, email, password: input.password }
}

const INITIAL_ROLE_NAME = 'Initial Carrier Administrator'

// The first operator's carrier and full-permission role, found or created in one transaction. A carrier or role
// with no users (left by an earlier attempt that failed validation) is reused, so a failed first try never blocks
// the next one on Carrier.code.
export async function ensureInitialCarrierAndRole(prisma: any, permissions: readonly string[], env: NodeJS.ProcessEnv = process.env) {
  const allPermissions = Object.fromEntries(permissions.map(permission => [permission, true]))
  return prisma.$transaction(async (tx: any) => {
    let carrier = await tx.carrier.findFirst({ where: { users: { none: {} } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } })
    if (!carrier) {
      carrier = await tx.carrier.create({
        data: {
          name: env.INITIAL_CARRIER_NAME || 'Avante Air',
          legalName: env.INITIAL_CARRIER_LEGAL_NAME || 'Avante Air LLC',
          code: (env.INITIAL_CARRIER_CODE || 'AV').toUpperCase(),
          defaultCurrencyCode: env.INITIAL_CURRENCY_CODE || 'USD',
          defaultTimezone: env.INITIAL_TIMEZONE || 'America/New_York',
          status: 'active',
          directSalesEnabled: false,
        },
        select: { id: true },
      })
    }
    const existingRole = await tx.role.findFirst({
      where: { name: INITIAL_ROLE_NAME, assignedTo: { none: {} }, OR: [{ carrierId: carrier.id }, { carrierId: null }] },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    })
    const role = existingRole
      ? await tx.role.update({ where: { id: existingRole.id }, data: { carrierId: carrier.id, ...allPermissions }, select: { id: true } })
      : await tx.role.create({ data: { carrierId: carrier.id, name: INITIAL_ROLE_NAME, ...allPermissions }, select: { id: true } })
    // Copies left by earlier failed attempts carry every permission and no carrier: remove them.
    await tx.role.deleteMany({ where: { id: { not: role.id }, name: INITIAL_ROLE_NAME, carrierId: null, assignedTo: { none: {} } } })
    return { carrierId: carrier.id as string, roleId: role.id as string }
  })
}
