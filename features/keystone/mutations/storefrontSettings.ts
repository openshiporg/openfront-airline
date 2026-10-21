import type { Context } from '.keystone/types'

import { requireFreshPermission } from '../access'
import { normalizeStorefrontBrandColor } from '../../airline/lib/branding'
import { DomainError } from '../lib/domain-error'

export type StorefrontSettingsInput = {
  name: string
  legalName: string
  storefrontBrandColor: string
  storefrontHomepageTitle: string
  storefrontHomepageDescription: string
}

function boundedText(value: unknown, label: string, max: number) {
  const normalized = String(value ?? '').trim()
  if (!normalized || normalized.length > max) throw new DomainError(`${label} is required and must be at most ${max} characters.`)
  return normalized
}

export function normalizeStorefrontSettingsInput(input: StorefrontSettingsInput) {
  const storefrontBrandColor = normalizeStorefrontBrandColor(input.storefrontBrandColor)
  if (!storefrontBrandColor) throw new DomainError('Choose one of the approved storefront colors.')
  return {
    name: boundedText(input.name, 'Carrier name', 120),
    legalName: boundedText(input.legalName, 'Legal name', 160),
    storefrontBrandColor,
    storefrontHomepageTitle: boundedText(input.storefrontHomepageTitle, 'Homepage title', 120),
    storefrontHomepageDescription: boundedText(input.storefrontHomepageDescription, 'Homepage description', 320),
  }
}

export async function updateCarrierStorefrontSettings(
  _root: unknown,
  args: StorefrontSettingsInput,
  context: Context,
) {
  const actor = await requireFreshPermission(context, 'canManageOnboarding')
  const data = normalizeStorefrontSettingsInput(args)
  // Public identity changes are audited with before/after values, like other privileged carrier changes.
  return (context.prisma as any).$transaction(async (tx: any) => {
    const before = await tx.carrier.findUniqueOrThrow({ where: { id: actor.carrierId }, select: { name: true, legalName: true, storefrontBrandColor: true, storefrontHomepageTitle: true, storefrontHomepageDescription: true } })
    const updated = await tx.carrier.update({ where: { id: actor.carrierId }, data })
    const now = new Date()
    await tx.auditEvent.create({ data: {
      carrierId: actor.carrierId, actorId: actor.itemId, eventKey: `carrier:${actor.carrierId}:storefront-settings:${now.getTime()}`,
      action: 'carrier.storefront.update', aggregateType: 'Carrier', aggregateId: actor.carrierId, source: 'platform',
      beforeSummary: before, afterSummary: data, metadata: {}, occurredAt: now,
    } })
    return updated
  })
}
