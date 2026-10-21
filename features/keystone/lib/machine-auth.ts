import crypto from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

export function hashMachineToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function issueMachineToken() {
  const keyId = crypto.randomBytes(12).toString('hex')
  const secret = crypto.randomBytes(32).toString('base64url')
  return { keyId, token: `ofm_${keyId}.${secret}`, tokenHash: hashMachineToken(`ofm_${keyId}.${secret}`) }
}

export async function authenticateMachineRequest(
  prisma: PrismaClient,
  authorization: string | undefined,
  audience: string,
  requiredScope: string,
) {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!/^ofm_[a-f0-9]{24}\.[A-Za-z0-9_-]{40,}$/.test(token)) throw new Error('Machine authentication failed.')
  const keyId = token.slice(4, token.indexOf('.'))
  const credential = await prisma.machineCredential.findUnique({ where: { keyId } })
  const suppliedHash = Buffer.from(hashMachineToken(token), 'hex')
  const storedHash = Buffer.from(credential?.tokenHash ?? '0'.repeat(64), 'hex')
  const hashMatches = suppliedHash.length === storedHash.length && crypto.timingSafeEqual(suppliedHash, storedHash)
  const scopes = Array.isArray(credential?.scopes) ? credential.scopes.filter((scope): scope is string => typeof scope === 'string') : []
  if (!credential || !hashMatches || credential.status !== 'active' || credential.expiresAt <= new Date() || credential.audience !== audience || !scopes.includes(requiredScope)) {
    throw new Error('Machine authentication failed.')
  }
  await prisma.machineCredential.update({ where: { id: credential.id }, data: { lastUsedAt: new Date() } })
  return { credentialId: credential.id, carrierId: credential.carrierId, scopes }
}
