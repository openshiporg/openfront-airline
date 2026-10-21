import 'dotenv/config'
import { rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { PrismaClient } from '@prisma/client'

import { validateProductionRuntime } from '../features/keystone/lib/runtime-config'

const drainFile = process.env.DRAIN_FILE || '/tmp/openfront-airline-draining'
const prisma = new PrismaClient()
let child: ReturnType<typeof spawn> | undefined
let stopping = false

async function shutdown(signal: NodeJS.Signals) {
  if (stopping) return
  stopping = true
  await writeFile(drainFile, new Date().toISOString()).catch(() => undefined)
  const drainDelay = Number(process.env.SHUTDOWN_DRAIN_DELAY_MS ?? 1_000)
  setTimeout(() => child?.kill(signal), Number.isSafeInteger(drainDelay) && drainDelay >= 0 ? drainDelay : 1_000).unref()
  setTimeout(() => child?.kill('SIGKILL'), Number(process.env.SHUTDOWN_GRACE_MS ?? 25_000)).unref()
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

async function main() {
  await rm(drainFile, { force: true })
  await validateProductionRuntime(process.env, prisma)
  await prisma.$disconnect()
  // A shutdown signal during startup validation must not start a server that nothing will drain or stop.
  if (stopping) { await rm(drainFile, { force: true }); process.exit(0) }
  child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start'], { stdio: 'inherit', env: process.env })
  child.once('exit', async code => { await rm(drainFile, { force: true }); process.exit(code ?? 1) })
}
main().catch(async error => { console.error(error); await prisma.$disconnect(); process.exit(1) })
