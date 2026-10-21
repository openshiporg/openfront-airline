import type { Context } from '.keystone/types'

import { DomainError } from './domain-error'

export const SERIALIZABLE_TRANSACTION_OPTIONS = {
  isolationLevel: 'Serializable',
  maxWait: 5_000,
  timeout: 20_000,
} as const

export function sortUniqueIds(ids: readonly string[]) {
  return [...new Set(ids.map(id => id.trim()).filter(Boolean))].sort()
}

export function throwIfKeystonePrismaError(value: unknown): void {
  if (!value || typeof value !== 'object') return
  const candidate = value as {
    message?: unknown
    extensions?: {
      code?: unknown
      prisma?: Record<string, unknown>
    }
  }
  if (candidate.extensions?.code !== 'KS_PRISMA_ERROR') return
  const prisma = candidate.extensions.prisma ?? {}
  const message = typeof prisma.message === 'string'
    ? prisma.message
    : typeof candidate.message === 'string' ? candidate.message : 'Prisma error'
  throw Object.assign(new Error(message), prisma)
}

function isSerializableWriteConflict(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as {
    code?: unknown
    meta?: { code?: unknown; message?: unknown }
    message?: unknown
  }
  const prismaCode = candidate.meta?.code
    ?? (candidate as any).extensions?.prisma?.code
    ?? (candidate as any).extensions?.prisma?.meta?.code
  const message = [
    candidate.message,
    (candidate as any).extensions?.prisma?.message,
    (candidate as any).extensions?.message,
  ].filter((value): value is string => typeof value === 'string').join(' ')
  return candidate.code === 'P2034'
    || prismaCode === 'P2034'
    || (candidate.code === 'P2010' && candidate.meta?.code === '40001')
    || prismaCode === '40001'
    || /serialization failure|could not serialize access|transaction failed due to a write conflict|deadlock/i.test(message)
}

/**
 * Runs database-only aggregate work in a short serializable transaction.
 * P2034 means PostgreSQL/Prisma aborted a conflicting serializable write, so
 * replaying the idempotent callback is safe. No network/provider work belongs
 * inside this boundary.
 */
export async function runSerializableTransaction<T>(
  context: Pick<Context, 'transaction'>,
  work: (transactionContext: Context) => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await context.transaction(
        work,
        SERIALIZABLE_TRANSACTION_OPTIONS as any,
      )
    } catch (error) {
      if (!isSerializableWriteConflict(error)) throw error
      if (attempt === maxAttempts) {
        throw new DomainError('The record changed concurrently; retry the request.', 'CONFLICT')
      }
    }
  }
  throw new DomainError('The record changed concurrently; retry the request.', 'CONFLICT')
}
