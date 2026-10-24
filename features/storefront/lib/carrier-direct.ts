import 'server-only'

import { keystoneContext } from '@/features/keystone/context'
import { configuredPublicCarrierCode, lookupCarrierIdentity } from '@/features/keystone/mutations/storefront'
import { accessRecoveryEnabled } from '@/features/keystone/mutations/storefrontAccess'
import type { PublicCarrierIdentity } from './carrier'

// The storefront carrier read straight from the database. not-found renders outside a normal request, where the
// GraphQL self-call used by getStorefrontCarrierIdentity has no request to forward, so it uses this instead.
export async function getStorefrontCarrierIdentityDirect(): Promise<PublicCarrierIdentity | null> {
  try {
    const prisma = keystoneContext.prisma as any
    const identity = await lookupCarrierIdentity(prisma, await configuredPublicCarrierCode(prisma))
    return {
      id: identity.id, code: identity.code, name: identity.name, legalName: identity.legalName,
      defaultCurrencyCode: identity.defaultCurrencyCode, defaultTimezone: identity.defaultTimezone,
      salesEnabled: identity.salesEnabled, storefrontBrandColor: identity.storefrontBrandColor,
      storefrontHomepageTitle: identity.storefrontHomepageTitle, storefrontHomepageDescription: identity.storefrontHomepageDescription,
      storefrontConfigured: identity.storefrontConfigured, accessRecoveryEnabled: accessRecoveryEnabled(),
      storefrontContactEmail: (identity as any).storefrontContactEmail || null, storefrontContactPhone: (identity as any).storefrontContactPhone || null, storefrontServiceHours: (identity as any).storefrontServiceHours || null,
    }
  } catch {
    return null
  }
}
