import 'dotenv/config'
import crypto from 'node:crypto'
import os from 'node:os'
import { PrismaClient } from '@prisma/client'

import { expireUnpaidBookings } from '../features/integrations/booking-expiry'
import { reapExpiredInventoryHolds } from '../features/integrations/hold-reaper'
import { runOutboxWorkerCycle } from '../features/integrations/outbox-worker'
import { sendOperationalAlert } from '../features/integrations/monitoring'
import { pruneExpiredRateLimitBuckets } from '../features/keystone/lib/rate-limit'
import { validateProductionRuntime } from '../features/keystone/lib/runtime-config'

const prisma = new PrismaClient()
// Web health checks REQUIRED_WORKER_ID, so a worker configured only from .env.example heartbeats under that same id.
const configuredWorkerId = process.env.OUTBOX_WORKER_ID?.trim() || process.env.REQUIRED_WORKER_ID?.trim()
const workerId = configuredWorkerId || `${os.hostname()}:${process.pid}`
// Outbox leases are owned by this process instance, not the shared logical name, so a stale attempt from an earlier
// process with the same name can never complete or fail work that a successor reclaimed.
const leaseOwner = `${workerId}#${os.hostname()}:${process.pid}:${crypto.randomUUID()}`
let stopping = false
let nextReapAt = 0
let lastAlertAt = 0
let alertedDeadLetters = 0

function stop() { stopping = true }
process.on('SIGTERM', stop)
process.on('SIGINT', stop)

async function main() {
  if (process.env.NODE_ENV === 'production' && !configuredWorkerId) throw new Error('OUTBOX_WORKER_ID or REQUIRED_WORKER_ID is required in production.')
  await validateProductionRuntime(process.env, prisma)
  console.log(JSON.stringify({ component: 'airline-runtime-worker', workerId, status: 'started' }))
  // Heartbeat on its own schedule, independent of slow deliveries or maintenance, with this process's identity.
  const writeHeartbeat = () => prisma.workerHeartbeat.upsert({ where: { workerKey: workerId }, update: { status: 'running', lastSeenAt: new Date(), metadata: { pid: process.pid, hostname: os.hostname(), leaseOwner } }, create: { workerKey: workerId, component: 'outbox-hold-and-booking-expiry-worker', status: 'running', lastSeenAt: new Date(), metadata: { pid: process.pid, hostname: os.hostname(), leaseOwner } } })
    .catch(error => console.error(JSON.stringify({ component: 'airline-runtime-worker', status: 'heartbeat_failed', error: error instanceof Error ? error.message : String(error) })))
  await writeHeartbeat()
  const heartbeat = setInterval(() => { if (!stopping) void writeHeartbeat() }, 10_000)
  while (!stopping) {
    try {
      const now = Date.now()
      if (now >= nextReapAt) {
        // Maintenance failures are logged and retried on the next tick; they never block outbox delivery or the
        // heartbeat that web health depends on.
        nextReapAt = now + 30_000
        try {
          const reaped = await reapExpiredInventoryHolds(prisma)
          const expiredBookings = await expireUnpaidBookings(prisma)
          await pruneExpiredRateLimitBuckets(prisma)
          if (reaped.expiredHolds) console.log(JSON.stringify({ component: 'hold-reaper', ...reaped }))
          if (expiredBookings.expiredBookings || expiredBookings.skippedBookings) console.log(JSON.stringify({ component: 'unpaid-booking-expiry', ...expiredBookings }))
        } catch (error) {
          console.error(JSON.stringify({ component: 'airline-runtime-worker', status: 'maintenance_failed', error: error instanceof Error ? error.message : String(error) }))
        }
      }
      const claimed = await runOutboxWorkerCycle(prisma, leaseOwner, 10, () => stopping)
      const deadLetters = await prisma.outboxEvent.count({ where: { status: 'dead_lettered' } })
      // Alert when new dead letters appear, not every minute for the same backlog.
      if (deadLetters < alertedDeadLetters) alertedDeadLetters = deadLetters
      if (deadLetters > alertedDeadLetters && process.env.ALERT_WEBHOOK_URL && Date.now() - lastAlertAt >= 60_000) {
        lastAlertAt = Date.now()
        try { await sendOperationalAlert(process.env.ALERT_WEBHOOK_URL, { service: 'openfront-airline-worker', severity: 'critical', deadLetters, workerId }); alertedDeadLetters = deadLetters }
        catch (error) { console.error(JSON.stringify({ component: 'monitoring', status: 'delivery_failed', error: error instanceof Error ? error.message : String(error) })) }
      }
      if (!claimed) await new Promise(resolve => setTimeout(resolve, 1_000))
    } catch (error) {
      console.error(JSON.stringify({ component: 'airline-runtime-worker', status: 'cycle_failed', error: error instanceof Error ? error.message : String(error) }))
      await new Promise(resolve => setTimeout(resolve, 2_000))
    }
  }
  clearInterval(heartbeat)
  await prisma.workerHeartbeat.updateMany({ where: { workerKey: workerId }, data: { status: 'draining', lastSeenAt: new Date() } })
  console.log(JSON.stringify({ component: 'airline-runtime-worker', workerId, status: 'draining' }))
}

main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
