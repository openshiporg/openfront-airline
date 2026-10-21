import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

import { permissionsList } from '../features/keystone/models/fields'
import { ONBOARDING_CURRENCIES } from '../features/keystone/lib/currency-policy'

// package.json has no "type": "module", so tsx runs this file as CommonJS: no top-level await or import.meta.
const bcrypt = require('bcryptjs') as { hash(value: string, rounds: number): Promise<string> }

async function main() {
  if (process.env.BOOTSTRAP_CONFIRM !== 'create-first-airline-admin') throw new Error('Set BOOTSTRAP_CONFIRM=create-first-airline-admin for this one-time command.')
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? ''
  const carrierName = process.env.BOOTSTRAP_CARRIER_NAME?.trim()
  const carrierCode = process.env.BOOTSTRAP_CARRIER_CODE?.trim().toUpperCase()
  const currencyCode = (process.env.BOOTSTRAP_CURRENCY_CODE || 'USD').trim().toUpperCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 16 || !carrierName || !carrierCode || !/^[A-Z0-9]{2,3}$/.test(carrierCode)) throw new Error('Explicit admin email, 16+ character password, carrier name, and carrier code are required.')
  if (!ONBOARDING_CURRENCIES.includes(currencyCode)) throw new Error(`BOOTSTRAP_CURRENCY_CODE must be one of ${ONBOARDING_CURRENCIES.join(', ')}.`)
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')

  const prisma = new PrismaClient()
  try {
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('openfront-airline:production-bootstrap'))::text AS "lock"`
      const [users, carriers, roles] = await Promise.all([tx.user.count(), tx.carrier.count(), tx.role.count()])
      if (users !== 0 || carriers !== 0 || roles !== 0) throw new Error('Bootstrap is disabled unless user, carrier, and role tables are empty.')
      const carrier = await tx.carrier.create({ data: { name: carrierName, legalName: carrierName, code: carrierCode, status: 'active', directSalesEnabled: false, defaultCurrencyCode: currencyCode, defaultTimezone: process.env.BOOTSTRAP_TIMEZONE || 'UTC' } })
      const role = await tx.role.create({ data: { carrierId: carrier.id, name: 'Platform Administrator', ...Object.fromEntries(permissionsList.map(permission => [permission, true])) } })
      await tx.user.create({ data: { carrierId: carrier.id, roleId: role.id, name: 'Platform Administrator', email, password: await bcrypt.hash(password, 12), onboardingStatus: 'in_progress' } })
    })
    console.log('Initial administrator created. Remove bootstrap secrets and complete guided onboarding.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
