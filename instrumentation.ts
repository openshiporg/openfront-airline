// Runs airline maintenance inside the production web process, as Openfront Scheduling does, so a deploy without a
// separate worker service still releases expired fare holds, cancels unpaid bookings past their payment deadline
// (returning the seats to sale). Every step claims rows with row locks (FOR UPDATE SKIP LOCKED), so it runs safely on replicas.
const INTERVAL_MS = 30_000

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production') return
  const globalState = globalThis as unknown as { airlineMaintenanceLoop?: boolean }
  if (globalState.airlineMaintenanceLoop) return
  globalState.airlineMaintenanceLoop = true

  const [{ PrismaClient }, { pooledPrismaOptions }, { reapExpiredInventoryHolds }, { expireUnpaidBookings }] = await Promise.all([
    import('@prisma/client'),
    import('./features/keystone/database-url'),
    import('./features/integrations/hold-reaper'),
    import('./features/integrations/booking-expiry'),
  ])
  const prisma = new PrismaClient(pooledPrismaOptions('worker'))
  let running = false
  const pass = async () => {
    if (running) return
    running = true
    try {
      for (const [stage, run] of [
        ['hold-reaper', () => reapExpiredInventoryHolds(prisma)],
        ['unpaid-booking-expiry', () => expireUnpaidBookings(prisma)],
      ] as const) {
        try { await run() } catch (error) { console.error(JSON.stringify({ component: 'airline-web-maintenance', stage, status: 'failed', error: error instanceof Error ? error.message : String(error) })) }
      }
    } finally {
      running = false
    }
  }
  setInterval(() => { void pass() }, INTERVAL_MS).unref?.()
  setTimeout(() => { void pass() }, 10_000).unref?.()
}
