import type { PrismaClient } from '@prisma/client'

import { isEvidenceOnlyManualProvider } from './bounded-payment-policy'
import { initialOperatorSetupEnabled } from './initial-operator-setup'

const requiredProductionValues = ['DATABASE_URL', 'SESSION_SECRET', 'APP_BASE_URL', 'PUBLIC_APP_URL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'SMTP_STORE_LINK', 'S3_BUCKET_NAME', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_ENDPOINT', 'TRUSTED_PROXY_IPS', 'ALERT_WEBHOOK_URL', 'REQUIRED_WORKER_ID', 'BACKUP_RETENTION_DAYS', 'BACKUP_POLICY_VERIFICATION_ID', 'STOREFRONT_CARRIER_CODE', 'TRAVEL_DOCUMENT_TOKENIZATION_KEY'] as const
const requiredOnboardingSteps = ['carrier_profile', 'network_catalog', 'dated_service', 'station_scope', 'settlement_boundary', 'launch_review'] as const

export async function validateProductionRuntime(env: NodeJS.ProcessEnv, prisma?: PrismaClient) {
  if (env.NODE_ENV !== 'production') return
  const missing = requiredProductionValues.filter(name => !env[name]?.trim())
  if (missing.length) throw new Error(`Missing production configuration: ${missing.join(', ')}`)
  const secureUrls = Object.fromEntries((['APP_BASE_URL', 'PUBLIC_APP_URL', 'SMTP_STORE_LINK', 'S3_ENDPOINT', 'ALERT_WEBHOOK_URL'] as const).map(name => {
    const url = new URL(env[name] as string)
    if (url.protocol !== 'https:') throw new Error(`${name} must use HTTPS in production.`)
    if (url.username || url.password || url.hash) throw new Error(`${name} cannot contain credentials or a fragment.`)
    return [name, url]
  })) as Record<'APP_BASE_URL' | 'PUBLIC_APP_URL' | 'SMTP_STORE_LINK' | 'S3_ENDPOINT' | 'ALERT_WEBHOOK_URL', URL>
  if (secureUrls.APP_BASE_URL.origin !== secureUrls.PUBLIC_APP_URL.origin || secureUrls.SMTP_STORE_LINK.origin !== secureUrls.PUBLIC_APP_URL.origin) throw new Error('APP_BASE_URL, PUBLIC_APP_URL, and SMTP_STORE_LINK must share the public application origin.')
  if ((env.TRAVEL_DOCUMENT_TOKENIZATION_KEY?.trim().length ?? 0) < 32) throw new Error('TRAVEL_DOCUMENT_TOKENIZATION_KEY must contain at least 32 characters.')
  const smtpPort = Number(env.SMTP_PORT)
  if (!Number.isSafeInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) throw new Error('SMTP_PORT is invalid.')
  const retentionDays = Number(env.BACKUP_RETENTION_DAYS)
  if (!Number.isSafeInteger(retentionDays) || retentionDays < 30) throw new Error('BACKUP_RETENTION_DAYS must be at least 30.')
  if (!prisma) return
  if (initialOperatorSetupEnabled(env)) {
    if (env.ALLOW_INCOMPLETE_LAUNCH_SETUP !== 'true') {
      throw new Error('Initial operator setup requires ALLOW_INCOMPLETE_LAUNCH_SETUP=true so every public sales command stays closed.')
    }
    const [users, carriers, roles] = await Promise.all([
      prisma.user.count(),
      prisma.carrier.count(),
      prisma.role.count(),
    ])
    if (users !== 0 || carriers !== 0 || roles !== 0) {
      throw new Error('Initial operator setup is allowed only after an owner-approved reset leaves user, carrier, and role tables empty. Remove ALLOW_INITIAL_OPERATOR_SETUP for retained-account recovery.')
    }
    return
  }
  const storefrontCarrierCode = String(env.STOREFRONT_CARRIER_CODE).trim().toUpperCase()
  if (!/^[A-Z0-9]{2,3}$/.test(storefrontCarrierCode)) throw new Error('STOREFRONT_CARRIER_CODE must be a two or three character carrier designator.')
  const storefrontCarrier = await prisma.carrier.findUnique({ where: { code: storefrontCarrierCode }, select: { id: true, status: true, directSalesEnabled: true, storefrontBrandColor: true, storefrontHomepageTitle: true, storefrontHomepageDescription: true } })
  if (!storefrontCarrier) throw new Error('STOREFRONT_CARRIER_CODE must identify a persisted carrier.')
  const maintenanceSetup = env.ALLOW_INCOMPLETE_LAUNCH_SETUP === 'true'
  if (!maintenanceSetup && (storefrontCarrier.status !== 'active' || !storefrontCarrier.directSalesEnabled)) throw new Error('STOREFRONT_CARRIER_CODE must identify an active direct-sales carrier.')
  const approvedBrandColors = new Set(['slate', 'blue', 'indigo', 'violet', 'rose', 'emerald', 'amber'])
  if (!maintenanceSetup && (!storefrontCarrier.storefrontBrandColor || !approvedBrandColors.has(storefrontCarrier.storefrontBrandColor) || !storefrontCarrier.storefrontHomepageTitle?.trim() || !storefrontCarrier.storefrontHomepageDescription?.trim())) throw new Error('The storefront carrier requires persisted homepage content and an approved brand color.')
  const providers = await prisma.paymentProvider.findMany({ where: { status: 'active' } })
  for (const provider of providers) {
    if (provider.adapterType !== 'manual') throw new Error(`Active payment provider ${provider.providerKey} uses unsupported adapter ${provider.adapterType}; this bounded release activates only externally evidenced manual settlement.`)
    if (!isEvidenceOnlyManualProvider(provider)) throw new Error(`Manual payment provider ${provider.providerKey} must be explicitly configured for external evidence and independent approval.`)
  }
  if (maintenanceSetup) return
  const carrierProviders = providers.filter(provider => provider.carrierId === storefrontCarrier.id)
  if (!carrierProviders.length) throw new Error('The storefront carrier requires an active evidence-only manual payment provider.')
  const [paymentOperatorCount, onboardingSteps, settlementCredentials, settlementConnection] = await Promise.all([
    (prisma as any).user.count({ where: { carrierId: storefrontCarrier.id, role: { canManagePayments: true } } }),
    (prisma as any).onboardingStep.findMany({ where: { carrierId: storefrontCarrier.id, status: 'completed', step: { in: [...requiredOnboardingSteps] } }, select: { step: true, userId: true, inputDigest: true }, take: 600 }),
    (prisma as any).machineCredential.findMany({ where: { carrierId: storefrontCarrier.id, audience: 'settlement-import', status: 'active', expiresAt: { gt: new Date() } }, select: { scopes: true }, take: 100 }),
    (prisma as any).providerConnection.findFirst({ where: { carrierId: storefrontCarrier.id, status: 'active', capabilities: { array_contains: ['settlement_import'] } }, include: { provider: true } }),
  ])
  const completedStepGroups = new Map<string, Set<string>>()
  for (const step of onboardingSteps) {
    if (!step.userId || !step.inputDigest) continue
    const key = `${step.userId}:${step.inputDigest}`
    const group = completedStepGroups.get(key) ?? new Set<string>()
    group.add(step.step)
    completedStepGroups.set(key, group)
  }
  const onboardingComplete = [...completedStepGroups.values()].some(group => requiredOnboardingSteps.every(step => group.has(step)))
  if (paymentOperatorCount < 2 || !onboardingComplete) throw new Error('The storefront carrier requires one command-owned completed launch review with every dependency and two current payment operators for independent approval.')
  if (!settlementCredentials.some((credential: any) => Array.isArray(credential.scopes) && credential.scopes.includes('settlements:write'))) throw new Error('The storefront carrier requires an active settlement-import machine credential.')
  const connectionConfiguration = settlementConnection?.configuration as Record<string, unknown> | null
  const providerCapabilities = Array.isArray(settlementConnection?.provider?.capabilities) ? settlementConnection.provider.capabilities : []
  if (!settlementConnection || connectionConfiguration?.providerExecution !== false || settlementConnection.provider?.status !== 'active' || settlementConnection.provider.adapterModule !== 'settlement-ledger-import' || !providerCapabilities.includes('settlement_import')) throw new Error('The storefront carrier requires an active fail-closed settlement-import connection.')
}
