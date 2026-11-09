import { access } from 'node:fs/promises'
import { NextResponse } from 'next/server'

import { keystoneContext } from '../../../features/keystone/context'

export const dynamic = 'force-dynamic'

// Web readiness is this process (not draining) and PostgreSQL.
export async function GET() {
  try {
    await access(process.env.DRAIN_FILE || '/tmp/openfront-airline-draining').then(() => { throw new Error('draining') }).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error })
    await keystoneContext.prisma.$queryRaw`SELECT 1`
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
  return NextResponse.json({ status: 'ok' }, { status: 200, headers: { 'cache-control': 'no-store' } })
}
