import type { Context } from '.keystone/types'

import { requireFreshPermission } from '../access'
import { issueMachineToken } from '../lib/machine-auth'
import { DomainError } from '../lib/domain-error'

export async function machineCredentialSummaries(
  _root: unknown,
  _args: Record<string, never>,
  context: Context,
) {
  const actor = await requireFreshPermission(context, 'canManageIntegrations')
  return (context.prisma as any).machineCredential.findMany({
    where: { carrierId: actor.carrierId },
    select: { id: true, name: true, tokenPreview: true, audience: true, scopes: true, status: true, expiresAt: true, lastUsedAt: true, revokedAt: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    take: 100,
  })
}

export async function issueMachineCredential(
  _root: unknown,
  args: { name: string; audience: string; scopes: string[]; expiresAt: string },
  context: Context,
) {
  const actor = await requireFreshPermission(context, 'canManageIntegrations')
  const expiresAt = new Date(args.expiresAt)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date() || expiresAt > new Date(Date.now() + 365 * 24 * 60 * 60_000)) throw new DomainError('Credential expiry must be within the next year.')
  const name = args.name.trim()
  const audience = args.audience.trim()
  const scopes = [...new Set(args.scopes.map(scope => scope.trim()).filter(Boolean))].sort()
  if (!name || name.length > 120 || !audience || audience.length > 120 || !scopes.length || scopes.some(scope => scope.length > 120)) throw new DomainError('Credential name, audience, and at least one bounded scope are required.')
  const issued = issueMachineToken()
  const credential = await (context.prisma as any).$transaction(async (tx: any) => {
    const created = await tx.machineCredential.create({ data: {
      carrierId: actor.carrierId, name, keyId: issued.keyId, tokenHash: issued.tokenHash,
      tokenPreview: `${issued.token.slice(0, 16)}…`, audience, scopes, status: 'active', expiresAt,
    } })
    const now = new Date()
    await tx.auditEvent.create({ data: { carrierId: actor.carrierId, actorId: actor.itemId, eventKey: `machine-credential:${created.id}:issued`, action: 'machine-credential.issue', aggregateType: 'MachineCredential', aggregateId: created.id, source: 'platform', beforeSummary: {}, afterSummary: { status: 'active', audience, scopes, expiresAt: expiresAt.toISOString() }, metadata: {}, occurredAt: now } })
    await tx.outboxEvent.create({ data: { carrierId: actor.carrierId, eventKey: `machine-credential:${created.id}:issued`, topic: 'machine-credential.issued', aggregateType: 'MachineCredential', aggregateId: created.id, payload: { audience, scopes, expiresAt: expiresAt.toISOString() }, status: 'pending', availableAt: now } })
    return created
  })
  return { credentialId: credential.id, keyId: issued.keyId, token: issued.token, expiresAt: expiresAt.toISOString() }
}

export async function revokeMachineCredential(
  _root: unknown,
  args: { credentialId: string },
  context: Context,
) {
  const actor = await requireFreshPermission(context, 'canManageIntegrations')
  return (context.prisma as any).$transaction(async (tx: any) => {
    const credential = await tx.machineCredential.findFirst({ where: { id: args.credentialId, carrierId: actor.carrierId, status: 'active' }, select: { id: true, audience: true, scopes: true } })
    if (!credential) throw new DomainError('Resource not found or inaccessible.')
    const now = new Date()
    const result = await tx.machineCredential.updateMany({ where: { id: credential.id, carrierId: actor.carrierId, status: 'active' }, data: { status: 'revoked', revokedAt: now } })
    if (result.count !== 1) throw new DomainError('Resource not found or inaccessible.')
    await tx.auditEvent.create({ data: { carrierId: actor.carrierId, actorId: actor.itemId, eventKey: `machine-credential:${credential.id}:revoked`, action: 'machine-credential.revoke', aggregateType: 'MachineCredential', aggregateId: credential.id, source: 'platform', beforeSummary: { status: 'active' }, afterSummary: { status: 'revoked' }, metadata: { audience: credential.audience, scopes: credential.scopes }, occurredAt: now } })
    await tx.outboxEvent.create({ data: { carrierId: actor.carrierId, eventKey: `machine-credential:${credential.id}:revoked`, topic: 'machine-credential.revoked', aggregateType: 'MachineCredential', aggregateId: credential.id, payload: { audience: credential.audience }, status: 'pending', availableAt: now } })
    return true
  })
}
