import 'dotenv/config'
import crypto from 'node:crypto'
import { Prisma, PrismaClient } from '@prisma/client'

import { isEvidenceOnlyManualProvider } from '../features/keystone/lib/bounded-payment-policy'

const prisma = new PrismaClient()
const confirmation = 'disable-unsupported-active-providers'

// Every lock, selection, update and count is scoped to the one reviewed carrier; other carriers' providers are never
// read or changed. Without the confirmation the script is a dry run: it prints the exact rows it would disable.
class DryRun extends Error {
  constructor(readonly manifest: unknown) { super('dry run') }
}

async function main() {
  const confirmed = process.env.CONFIRM_BOUNDED_PAYMENT_RECONCILIATION === confirmation
  const carrierCode = process.env.STOREFRONT_CARRIER_CODE?.trim().toUpperCase()
  if (!carrierCode || !/^[A-Z0-9]{2,3}$/.test(carrierCode)) throw new Error('STOREFRONT_CARRIER_CODE must identify the reviewed bounded-launch carrier.')
  const storefrontCarrier = await prisma.carrier.findUnique({ where: { code: carrierCode }, select: { id: true, code: true, name: true } })
  if (!storefrontCarrier) throw new Error('The reviewed bounded-launch carrier is not persisted in this database.')

  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`openfront-airline:bounded-payment-reconciliation:${storefrontCarrier.id}`}))::text AS "lock"`)
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentProvider" WHERE "status" = 'active' AND "carrier" = ${storefrontCarrier.id} ORDER BY "id" FOR UPDATE`)
    const activeProviders = await tx.paymentProvider.findMany({
      where: { status: 'active', carrierId: storefrontCarrier.id },
      select: { id: true, carrierId: true, providerKey: true, adapterType: true, configuration: true, updatedAt: true },
      orderBy: { providerKey: 'asc' },
    })
    const preserved: string[] = []
    const disabled: Array<{ providerKey: string; paymentReferences: number; sessionReferences: number }> = []

    for (const provider of activeProviders) {
      if (isEvidenceOnlyManualProvider(provider)) {
        preserved.push(provider.providerKey)
        continue
      }
      if (provider.carrierId !== storefrontCarrier.id) throw new Error(`Payment provider ${provider.providerKey} is outside the reviewed carrier; reconciliation failed closed.`)
      const [paymentReferences, sessionReferences] = await Promise.all([
        tx.payment.count({ where: { providerId: provider.id } }),
        tx.paymentSession.count({ where: { providerId: provider.id } }),
      ])
      if (!confirmed) {
        disabled.push({ providerKey: provider.providerKey, paymentReferences, sessionReferences })
        continue
      }
      const updated = await tx.paymentProvider.updateMany({ where: { id: provider.id, carrierId: storefrontCarrier.id, status: 'active' }, data: { status: 'disabled' } })
      if (updated.count !== 1) throw new Error(`Active payment provider ${provider.providerKey} changed concurrently; reconciliation rolled back.`)
      const revision = crypto.createHash('sha256').update(`${provider.id}:${provider.updatedAt.toISOString()}:active`).digest('hex').slice(0, 20)
      await tx.auditEvent.create({
        data: {
          carrierId: provider.carrierId,
          eventKey: `payment-provider:${provider.id}:bounded-disable:${revision}`,
          action: 'payment-provider.disable-unsupported-bounded-launch',
          aggregateType: 'PaymentProvider',
          aggregateId: provider.id,
          source: 'system',
          beforeSummary: { status: 'active', adapterType: provider.adapterType },
          afterSummary: { status: 'disabled' },
          metadata: {
            reason: 'Provider was not configured as evidence-only manual settlement with independent approval.',
            paymentReferences,
            sessionReferences,
            retainedProviderRecord: true,
          },
          occurredAt: new Date(),
        },
      })
      const [paymentsAfter, sessionsAfter] = await Promise.all([
        tx.payment.count({ where: { providerId: provider.id } }),
        tx.paymentSession.count({ where: { providerId: provider.id } }),
      ])
      if (paymentsAfter !== paymentReferences || sessionsAfter !== sessionReferences) throw new Error(`Financial references changed while disabling ${provider.providerKey}; reconciliation rolled back.`)
      disabled.push({ providerKey: provider.providerKey, paymentReferences, sessionReferences })
    }

    // Nothing was written in a dry run; the manifest names exactly the rows a confirmed run would disable.
    if (!confirmed) throw new DryRun({ dryRun: true, storefrontCarrier, preserved, wouldDisable: disabled, confirmWith: `CONFIRM_BOUNDED_PAYMENT_RECONCILIATION=${confirmation}` })
    const launchProviderReady = await tx.paymentProvider.count({
      where: { carrierId: storefrontCarrier.id, status: 'active' },
    })
    if (!launchProviderReady) throw new Error(`Carrier ${storefrontCarrier.code} has no active provider after reconciliation; reconciliation rolled back.`)
    return { storefrontCarrier, preserved, disabled }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch(error => {
    if (!(error instanceof DryRun)) throw error
    console.log(JSON.stringify(error.manifest, null, 2))
    return null
  })
  if (!result) return

  console.log(JSON.stringify({
    policy: 'evidence-only manual settlement with independent approval; no provider success asserted',
    ...result,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
}).finally(() => prisma.$disconnect())
