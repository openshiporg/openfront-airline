import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { GraphQLError } from 'graphql'

import { CONSTRAINT_MESSAGES, constraintRefusal } from './constraint-errors'
import { maskGraphqlError } from './graphql-error-mask'
import { unsafeMigrationStatements } from './migration-safety'

const migration = readFileSync(join(process.cwd(), 'migrations/20261107140000_airline_invariants/migration.sql'), 'utf8')

test('every rule in the invariants migration has a readable message', () => {
  const names = [...migration.matchAll(/(?:INDEX|CONSTRAINT|TRIGGER) "([A-Za-z_]+)"/g)].map(match => match[1])
  assert.ok(names.length >= 25)
  for (const name of names) assert.ok(CONSTRAINT_MESSAGES[name], `${name} has no message`)
})

test('the invariants migration passes the retained-rule safety check', () => {
  assert.deepEqual(unsafeMigrationStatements(migration), [])
})

test('generated migrations may not drop the new rules', () => {
  assert.equal(unsafeMigrationStatements('DROP INDEX "Booking_carrier_recordLocator_key";').length, 1)
  assert.equal(unsafeMigrationStatements('ALTER TABLE "InventoryBucket" DROP CONSTRAINT "InventoryBucket_counts_valid";').length, 1)
})

test('a CHECK violation maps to its rule', () => {
  const prismaError = Object.assign(new Error('new row for relation "InventoryBucket" violates check constraint "InventoryBucket_counts_valid"'), { code: 'P2004' })
  assert.equal(constraintRefusal(prismaError)?.code, 'AIRLINE_INVENTORY_EXCEEDED')
})

test('a trigger refusal maps by the rule name in its message', () => {
  assert.equal(constraintRefusal(new Error('ERROR: Refund_within_payment: refunds 200 exceed captured 100'))?.code, 'AIRLINE_REFUND_EXCEEDS_PAYMENT')
})

test('a P2002 reported by fields maps to the rule', () => {
  const error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta: { target: ['recordLocator', 'carrier'] } })
  assert.equal(constraintRefusal(error)?.code, 'AIRLINE_DUPLICATE_RECORD_LOCATOR')
  const codes = Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta: { target: ['carrier', 'code'] } })
  assert.equal(constraintRefusal(codes)?.code, 'AIRLINE_DUPLICATE_CODE')
})

test('the GraphQL mask returns the readable refusal and still hides unknown errors', () => {
  const wrapped = new GraphQLError('Prisma error', { originalError: new Error('violates check constraint "Route_distinct_endpoints"') })
  const shown = maskGraphqlError(wrapped, 'Unexpected error.') as GraphQLError
  assert.equal(shown.message, 'Origin and destination must differ.')
  assert.equal(shown.extensions.code, 'AIRLINE_INVALID_ROUTE')
  const hidden = maskGraphqlError(new Error('secret detail'), 'Unexpected error.') as GraphQLError
  assert.equal(hidden.message, 'Unexpected error.')
  assert.equal(hidden.extensions.code, 'INTERNAL_SERVER_ERROR')
})

test('a raw SQL unique violation maps by its key columns', () => {
  const error = Object.assign(new Error('Raw query failed. Code: `23505`. Message: `Key ("user", airport)=(u1, a1) already exists.`'), { code: 'P2010' })
  assert.equal(constraintRefusal(error)?.code, 'AIRLINE_DUPLICATE_STATION_ASSIGNMENT')
})

test('a duplicate code is named by the mutation that failed', () => {
  const unique = Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta: { target: ['carrier', 'code'] } })
  const cabin = maskGraphqlError(new GraphQLError('Prisma error', { path: ['createCabin'], originalError: unique }), 'Unexpected error.') as GraphQLError
  assert.equal(cabin.extensions.code, 'AIRLINE_DUPLICATE_CABIN')
  const brand = maskGraphqlError(new GraphQLError('Prisma error', { path: ['updateFareBrand'], originalError: unique }), 'Unexpected error.') as GraphQLError
  assert.equal(brand.extensions.code, 'AIRLINE_DUPLICATE_FARE_BRAND')
})

test('a CHECK violation Keystone reports as "Prisma error" maps by its debug text', () => {
  const keystone = new GraphQLError('Prisma error', { extensions: { code: 'KS_PRISMA_ERROR', debug: { message: 'new row for relation "Route" violates check constraint "Route_distinct_endpoints"' } } })
  const shown = maskGraphqlError(new GraphQLError('Prisma error', { path: ['createRoute'], originalError: keystone }), 'Unexpected error.') as GraphQLError
  assert.equal(shown.extensions.code, 'AIRLINE_INVALID_ROUTE')
  assert.equal(shown.extensions.debug, undefined)
})
