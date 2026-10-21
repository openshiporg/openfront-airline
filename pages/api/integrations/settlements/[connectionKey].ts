import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'
import type { NextApiRequest, NextApiResponse } from 'next'

import { keystoneContext } from '../../../../features/keystone/context'
import { ONBOARDING_CURRENCIES } from '../../../../features/keystone/lib/currency-policy'
import { authenticateMachineRequest } from '../../../../features/keystone/lib/machine-auth'

function integer(value: unknown) { const parsed = Number(value); if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error('Amount must be a positive minor-unit integer.'); return parsed }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  try {
    // Authenticate before any connection lookup, and answer every failure with the same 404, so unauthenticated
    // callers cannot learn which connection keys exist.
    let machine: Awaited<ReturnType<typeof authenticateMachineRequest>>
    try {
      machine = await authenticateMachineRequest(keystoneContext.prisma, String(req.headers.authorization ?? ''), 'settlement-import', 'settlements:write')
    } catch {
      return res.status(404).json({ error: 'Endpoint not found.' })
    }
    const connection = await (keystoneContext.prisma as any).providerConnection.findUnique({ where: { connectionKey: String(req.query.connectionKey ?? '') }, include: { provider: true } })
    const connectionCapabilities = Array.isArray(connection?.capabilities) ? connection.capabilities : []
    const providerCapabilities = Array.isArray(connection?.provider?.capabilities) ? connection.provider.capabilities : []
    if (!connection || connection.status !== 'active' || connection.configuration?.providerExecution !== false || !connectionCapabilities.includes('settlement_import') || connection.provider?.status !== 'active' || connection.provider.adapterModule !== 'settlement-ledger-import' || !providerCapabilities.includes('settlement_import')) return res.status(404).json({ error: 'Endpoint not found.' })
    const paymentBoundary = await (keystoneContext.prisma as any).paymentProvider.findFirst({ where: { carrierId: connection.carrierId, adapterType: 'manual', status: 'active' } })
    if (!paymentBoundary || paymentBoundary.configuration?.providerExecution !== false || paymentBoundary.configuration?.requiresIndependentApproval !== true) return res.status(404).json({ error: 'Endpoint not found.' })
    if (machine.carrierId !== connection.carrierId) return res.status(404).json({ error: 'Endpoint not found.' })
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}
    const externalReference = String(body.externalReference ?? '').trim(); const evidenceDigest = String(body.evidenceDigest ?? '').toLowerCase(); const currencyCode = String(body.currencyCode ?? '').toUpperCase()
    const occurredAt = new Date(String(body.occurredAt ?? '')); const amount = integer(body.amount)
    if (!externalReference || externalReference.length > 200 || !/^[a-f0-9]{64}$/.test(evidenceDigest) || !ONBOARDING_CURRENCIES.includes(currencyCode) || Number.isNaN(occurredAt.getTime()) || occurredAt > new Date()) throw new Error('Settlement ledger entry is invalid.')
    const ledgerSource = `provider:${connection.provider.providerKey}`
    const ledgerKey = crypto.createHash('sha256').update(`${connection.carrierId}\u0000${ledgerSource}\u0000${externalReference}`).digest('hex')
    const entry = await (keystoneContext.prisma as any).$transaction(async (tx: any) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "MachineCredential" WHERE "id" = ${machine.credentialId} FOR UPDATE`)
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "ProviderConnection" WHERE "id" = ${connection.id} FOR UPDATE`)
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "IntegrationProvider" WHERE "id" = ${connection.provider.id} FOR UPDATE`)
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentProvider" WHERE "id" = ${paymentBoundary.id} FOR UPDATE`)
      const currentCredential = await tx.machineCredential.findUnique({ where: { id: machine.credentialId } })
      const currentConnection = await tx.providerConnection.findUnique({ where: { id: connection.id }, include: { provider: true } })
      const currentPaymentBoundary = await tx.paymentProvider.findUnique({ where: { id: paymentBoundary.id } })
      const currentCredentialScopes = Array.isArray(currentCredential?.scopes) ? currentCredential.scopes : []
      const currentConnectionCapabilities = Array.isArray(currentConnection?.capabilities) ? currentConnection.capabilities : []
      const currentProviderCapabilities = Array.isArray(currentConnection?.provider?.capabilities) ? currentConnection.provider.capabilities : []
      if (!currentCredential || currentCredential.carrierId !== connection.carrierId || currentCredential.status !== 'active' || currentCredential.audience !== 'settlement-import' || !currentCredentialScopes.includes('settlements:write') || currentCredential.expiresAt <= new Date() || !currentConnection || currentConnection.status !== 'active' || currentConnection.configuration?.providerExecution !== false || !currentConnectionCapabilities.includes('settlement_import') || currentConnection.provider?.status !== 'active' || currentConnection.provider.adapterModule !== 'settlement-ledger-import' || !currentProviderCapabilities.includes('settlement_import') || !currentPaymentBoundary || currentPaymentBoundary.carrierId !== connection.carrierId || currentPaymentBoundary.adapterType !== 'manual' || currentPaymentBoundary.status !== 'active' || currentPaymentBoundary.configuration?.providerExecution !== false || currentPaymentBoundary.configuration?.requiresIndependentApproval !== true) throw new Error('Settlement import authorization changed before acceptance.')
      const retained = await tx.settlementLedgerEntry.upsert({
        where: { ledgerKey },
        update: {},
        create: { carrierId: connection.carrierId, connectionId: connection.id, ledgerKey, externalReference, ledgerSource, evidenceDigest, amount, currencyCode, occurredAt, importedByCredentialId: machine.credentialId, sourceMetadata: { providerKey: connection.provider.providerKey } },
      })
      if (retained.amount !== amount || retained.currencyCode !== currencyCode || retained.evidenceDigest !== evidenceDigest || retained.connectionId !== connection.id) throw new Error('Settlement reference was already imported with different evidence.')
      await tx.auditEvent.upsert({
        where: { eventKey: `settlement-import:${ledgerKey}` }, update: {},
        create: { carrierId: connection.carrierId, eventKey: `settlement-import:${ledgerKey}`, action: 'settlement.ledger-entry.import', aggregateType: 'SettlementLedgerEntry', aggregateId: retained.id, source: 'provider', afterSummary: { externalReference, amount, currencyCode }, metadata: { credentialId: machine.credentialId, connectionId: connection.id } },
      })
      await tx.outboxEvent.upsert({
        where: { eventKey: `settlement-imported:${ledgerKey}` }, update: {},
        create: { carrierId: connection.carrierId, eventKey: `settlement-imported:${ledgerKey}`, topic: 'settlement.ledger-entry.imported', aggregateType: 'SettlementLedgerEntry', aggregateId: retained.id, payload: { externalReference, amount, currencyCode, credentialId: machine.credentialId }, status: 'pending', availableAt: new Date() },
      })
      return retained
    })
    return res.status(202).json({ accepted: true, ledgerEntryId: entry.id, ledgerSource })
  } catch (error) {
    console.error('Settlement import failed', error)
    return res.status(400).json({ error: 'Settlement entry could not be accepted.' })
  }
}
