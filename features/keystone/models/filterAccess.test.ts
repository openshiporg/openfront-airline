/* eslint-disable @typescript-eslint/no-explicit-any */
// Local access test: needs DATABASE_URL pointing at a migrated scratch database.
import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'

const enabled = Boolean(process.env.DATABASE_URL && process.env.AIRLINE_FILTER_ACCESS_TEST)

let ctx: any
const sessions: Record<string, any> = {}

function sessionFor(user: any, role: any, carrierId: string) {
  return {
    itemId: user.id,
    listKey: 'User',
    data: { name: user.name, email: user.email, carrier: { id: carrierId }, approvedAgent: null, role },
  }
}

async function count(role: string, query: string): Promise<number | 'error'> {
  const c = role === 'anonymous' ? ctx : ctx.withSession(sessions[role])
  const result: any = await c.graphql.raw({ query: `{ ${query} }` })
  if (result.errors?.length) return 'error'
  const value = Object.values(result.data ?? {})[0]
  return typeof value === 'number' ? value : 'error'
}

before(async () => {
  if (!enabled) return
  const { getContext } = await import('@keystone-6/core/context')
  const PrismaModule = await import('@prisma/client')
  const config = (await import('../index')).default
  ctx = getContext(config as any, PrismaModule)
  const prisma = ctx.prisma
  await prisma.user.deleteMany({ where: { email: { endsWith: '@example.com' } } })
  await prisma.role.deleteMany({ where: { carrier: { code: 'FLT' } } })
  await prisma.carrier.deleteMany({ where: { code: 'FLT' } })
  const carrier = await prisma.carrier.create({ data: { name: 'Filter Air', legalName: 'Filter Air', code: 'FLT', status: 'active' } })
  const roleDefs: Record<string, Record<string, boolean>> = {
    admin: { canManageCarriers: true, canAccessDashboard: true },
    network: { canAccessDashboard: true, canReadNetwork: true },
    bookings: { canAccessDashboard: true, canReadBookings: true },
  }
  for (const [name, flags] of Object.entries(roleDefs)) {
    const role = await prisma.role.create({ data: { name, carrierId: carrier.id, ...flags } })
    const user = await prisma.user.create({
      data: { name: `Zulu ${name}`, email: `${name}@example.com`, password: 'x', carrierId: carrier.id, roleId: role.id },
    })
    sessions[name] = sessionFor(user, { id: role.id, name, ...flags }, carrier.id)
  }
})

after(async () => {
  if (enabled) await ctx?.prisma.$disconnect()
})

// Each probe pair: a value that exists ("Zulu") and one that does not ("Qq"). A limited role must get the same
// answer for both, or an access error.
const probes: Array<[string, (v: string) => string]> = [
  ['carrier -> users.name', v => `carriersCount(where: { users: { some: { name: { startsWith: "${v}" } } } })`],
  ['carrier -> users.email', v => `carriersCount(where: { users: { some: { email: { startsWith: "${v}" } } } })`],
  ['carrier -> roles.name', v => `carriersCount(where: { roles: { some: { name: { startsWith: "${v}" } } } })`],
  ['role -> assignedTo.name', v => `rolesCount(where: { assignedTo: { some: { name: { startsWith: "${v}" } } } })`],
  ['user -> role.name', v => `usersCount(where: { role: { name: { startsWith: "${v}" } } })`],
  ['user -> carrier.users.name', v => `usersCount(where: { carrier: { users: { some: { name: { startsWith: "${v}" } } } } })`],
  ['flight -> bookingSegments', v => `flightInstancesCount(where: { bookingSegments: { some: { originCode: { startsWith: "${v}" } } } })`],
  ['carrier -> bookings.status', v => `carriersCount(where: { bookings: { some: { status: { startsWith: "${v}" } } } })`],
  ['carrier -> providerConnections', v => `carriersCount(where: { providerConnections: { some: { externalAccountId: { startsWith: "${v}" } } } })`],
]

for (const role of ['anonymous', 'network', 'bookings']) {
  for (const [name, build] of probes) {
    test(`${role}: ${name} gives the same answer for a present and an absent value`, { skip: !enabled }, async () => {
      const present = await count(role, build('Zulu'))
      const absent = await count(role, build('Qq'))
      assert.deepEqual(present, absent, `${role} ${name}: present=${present} absent=${absent}`)
    })
  }
}

test('network role cannot filter users or roles through the carrier', { skip: !enabled }, async () => {
  assert.equal(await count('network', probes[0][1]('Zulu')), 'error')
  assert.equal(await count('network', probes[2][1]('Zulu')), 'error')
  assert.equal(await count('bookings', probes[0][1]('Zulu')), 'error')
})

test('admin keeps real relation filters', { skip: !enabled }, async () => {
  assert.equal(await count('admin', probes[0][1]('Zulu')), 1)
  assert.equal(await count('admin', probes[0][1]('Qq')), 0)
  assert.equal(await count('admin', probes[2][1]('net')), 1)
})
