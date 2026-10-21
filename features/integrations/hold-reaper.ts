import { Prisma, type PrismaClient } from '@prisma/client'

/** Atomically expire bounded hold batches and restore authoritative held counts. */
export async function reapExpiredInventoryHolds(prisma: PrismaClient, limit = 250) {
  const boundedLimit = Math.max(1, Math.min(limit, 1_000))
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{ id: string; inventoryBucketId: string; offerId: string; quantity: number }>>(Prisma.sql`
      SELECT "id", "inventoryBucket" AS "inventoryBucketId", "offer" AS "offerId", "quantity"
      FROM "InventoryHold"
      WHERE "status" = 'active' AND "expiresAt" <= NOW()
      ORDER BY "expiresAt", "id"
      LIMIT ${boundedLimit}
      FOR UPDATE SKIP LOCKED
    `)
    if (!rows.length) return { expiredHolds: 0, restoredSeats: 0 }
    const holdIds = rows.map(row => row.id)
    const bucketIds = [...new Set(rows.map(row => row.inventoryBucketId))].sort()
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "InventoryBucket" WHERE "id" IN (${Prisma.join(bucketIds)}) ORDER BY "id" FOR UPDATE`)
    await tx.inventoryHold.updateMany({ where: { id: { in: holdIds }, status: 'active' }, data: { status: 'expired' } })
    const totals = new Map<string, number>()
    for (const row of rows) totals.set(row.inventoryBucketId, (totals.get(row.inventoryBucketId) ?? 0) + row.quantity)
    for (const [id, quantity] of totals) {
      await tx.$executeRaw(Prisma.sql`UPDATE "InventoryBucket" SET "held" = GREATEST(0, "held" - ${quantity}), "updatedAt" = NOW() WHERE "id" = ${id}`)
    }
    const offerIds = [...new Set(rows.map(row => row.offerId))]
    await tx.offer.updateMany({ where: { id: { in: offerIds }, status: { in: ['held', 'available'] }, expiresAt: { lte: new Date() } }, data: { status: 'expired' } })
    return { expiredHolds: rows.length, restoredSeats: rows.reduce((sum, row) => sum + row.quantity, 0) }
  })
}
