import 'server-only'

import { cache } from 'react'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { keystoneContext } from '@/features/keystone/context'
import { initialOperatorSetupEnabled } from '@/features/keystone/lib/initial-operator-setup'
import { configuredPublicCarrierCode } from '@/features/keystone/mutations/storefront'

export type PublicCarrierIdentity = {
  id: string
  code: string
  name: string
  legalName: string
  defaultCurrencyCode: string
  defaultTimezone: string
  salesEnabled: boolean
  storefrontBrandColor: string | null
  storefrontHomepageTitle: string | null
  storefrontHomepageDescription: string | null
  storefrontConfigured: boolean
  accessRecoveryEnabled: boolean
}

export const getStorefrontCarrierIdentity = cache(async (): Promise<PublicCarrierIdentity | null> => {
  // An empty database has no carrier yet: the storefront shows its unconfigured state until onboarding creates one.
  const carrierCode = await configuredPublicCarrierCode(keystoneContext.prisma).catch(() => null)
  if (!carrierCode) return null
  const response = await keystoneClient<{ publicCarrierIdentity: PublicCarrierIdentity | null }>(
    `query StorefrontCarrierIdentity($carrierCode: String!) {
      publicCarrierIdentity(carrierCode: $carrierCode) {
        id code name legalName defaultCurrencyCode defaultTimezone salesEnabled
        storefrontBrandColor storefrontHomepageTitle storefrontHomepageDescription storefrontConfigured accessRecoveryEnabled
      }
    }`,
    { carrierCode },
    { cache: 'no-store' },
  )
  if (response.success) return response.data.publicCarrierIdentity ?? null
  // The only production exception is the explicit owner-approved empty runtime
  // window used by /dashboard/init. Retained runtimes still fail closed.
  if (process.env.NODE_ENV === 'production' && !initialOperatorSetupEnabled()) throw new Error('Persisted storefront carrier identity is unavailable.')
  return null
})
