import crypto from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'

import { DomainError } from './domain-error'

function rateLimitKey(scope: string, signal: string) {
  return crypto.createHash('sha256').update(`${scope}\u0000${signal}`).digest('hex')
}

/** Read-only: true when the current window has no allowance left, so a caller can refuse before doing more work. */
export async function isDurableRateLimitExhausted(prisma: PrismaClient, scope: string, signal: string, limit: number) {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT "count" FROM "RateLimitBucket" WHERE "key" = ${rateLimitKey(scope, signal)} AND "expiresAt" > ${new Date()}
  `)
  return (rows[0]?.count ?? 0) >= limit
}

export async function consumeDurableRateLimit(prisma: PrismaClient, scope: string, signal: string, limit: number, windowMs: number) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + windowMs)
  const key = rateLimitKey(scope, signal)
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    INSERT INTO "RateLimitBucket" ("id", "key", "scope", "count", "windowStartedAt", "expiresAt", "createdAt", "updatedAt")
    VALUES (${crypto.randomUUID()}, ${key}, ${scope}, 1, ${now}, ${expiresAt}, ${now}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "windowStartedAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${now} ELSE "RateLimitBucket"."windowStartedAt" END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "RateLimitBucket"."expiresAt" END,
      "updatedAt" = ${now}
    RETURNING "count"
  `)
  if (!rows[0] || rows[0].count > limit) throw new DomainError('This request cannot be completed right now.', 'RATE_LIMITED')
}

/** Delete windows that ended more than an hour ago, at most `limit` per call, using the expiresAt index. */
export async function pruneExpiredRateLimitBuckets(prisma: PrismaClient, limit = 1000) {
  return prisma.$executeRaw(Prisma.sql`
    DELETE FROM "RateLimitBucket" WHERE "id" IN (
      SELECT "id" FROM "RateLimitBucket" WHERE "expiresAt" < NOW() - INTERVAL '1 hour' ORDER BY "expiresAt" LIMIT ${limit}
    )
  `)
}
