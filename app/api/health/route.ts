import { access } from 'node:fs/promises'
import { NextResponse } from 'next/server'

import { keystoneContext } from '../../../features/keystone/context'

export const dynamic = 'force-dynamic'

// Web readiness is this process (not draining) and PostgreSQL. Worker freshness is reported separately so a slow
// outbound receiver or a worker restart never stops the web app from serving recovery and operator pages.
export async function GET() {
  try {
    await access(process.env.DRAIN_FILE || '/tmp/openfront-airline-draining').then(() => { throw new Error('draining') }).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error })
    await keystoneContext.prisma.$queryRaw`SELECT 1`
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
  const workerKey = process.env.REQUIRED_WORKER_ID?.trim()
  let worker: 'fresh' | 'stale' | 'not_configured' | 'unknown' = 'not_configured'
  if (workerKey) {
    try {
      const heartbeat = await keystoneContext.prisma.workerHeartbeat.findUnique({ where: { workerKey } })
      worker = heartbeat?.status === 'running' && heartbeat.lastSeenAt >= new Date(Date.now() - 60_000) ? 'fresh' : 'stale'
    } catch {
      worker = 'unknown'
    }
  }
  return NextResponse.json({ status: 'ok', worker }, { status: 200, headers: { 'cache-control': 'no-store' } })
}
