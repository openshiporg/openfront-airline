import assert from 'node:assert/strict'
import test from 'node:test'

import { ensureInitialCarrierAndRole, validateInitialOperatorInput } from './initial-operator-setup'

// Minimal in-memory stand-in for the Prisma calls ensureInitialCarrierAndRole makes.
function fakePrisma(state: { carriers: any[]; roles: any[] }) {
  let next = 1
  const tx = {
    carrier: {
      findFirst: async () => state.carriers.find(carrier => !carrier.users) ?? null,
      create: async ({ data }: any) => {
        if (state.carriers.some(carrier => carrier.code === data.code)) throw new Error('Unique constraint failed on Carrier.code')
        const carrier = { id: `c${next++}`, users: 0, ...data }
        state.carriers.push(carrier)
        return { id: carrier.id }
      },
    },
    role: {
      findFirst: async ({ where }: any) => state.roles.find(role => role.name === where.name && !role.users && (role.carrierId === null || role.carrierId === where.OR[0].carrierId)) ?? null,
      update: async ({ where, data }: any) => { const role = state.roles.find(entry => entry.id === where.id); Object.assign(role, data); return { id: role.id } },
      create: async ({ data }: any) => { const role = { id: `r${next++}`, users: 0, ...data }; state.roles.push(role); return { id: role.id } },
    },
  }
  return { $transaction: (run: (client: typeof tx) => Promise<unknown>) => run(tx) }
}

test('a carrier and role left by a failed first attempt are reused, not recreated', async () => {
  const state: { carriers: any[]; roles: any[] } = { carriers: [{ id: 'orphan', code: 'AV', users: 0 }], roles: [{ id: 'orphan-role', name: 'Initial Carrier Administrator', carrierId: null, users: 0 }] }
  const result = await ensureInitialCarrierAndRole(fakePrisma(state), ['canManageUsers'], { NODE_ENV: 'test' })
  assert.deepEqual(result, { carrierId: 'orphan', roleId: 'orphan-role' })
  assert.equal(state.carriers.length, 1)
  assert.equal(state.roles[0].carrierId, 'orphan')
  assert.equal(state.roles[0].canManageUsers, true)
})

test('an empty database gets a new carrier and a full-permission role', async () => {
  const state = { carriers: [] as any[], roles: [] as any[] }
  const result = await ensureInitialCarrierAndRole(fakePrisma(state), ['canManageUsers', 'canManagePayments'], { NODE_ENV: 'test' })
  assert.equal(state.carriers[0].code, 'AV')
  assert.equal(result.carrierId, state.carriers[0].id)
  assert.equal(state.roles[0].canManagePayments, true)
})

test('first operator details follow the shared password rule', () => {
  assert.throws(() => validateInitialOperatorInput({ name: 'QA', email: 'qa@example.com', password: 'short' }))
  assert.doesNotThrow(() => validateInitialOperatorInput({ name: 'QA', email: 'qa@example.com', password: 'a-long-passphrase' }))
})
