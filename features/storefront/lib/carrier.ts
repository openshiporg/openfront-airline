import 'server-only'

import { cache } from 'react'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { initialOperatorSetupEnabled } from '@/features/keystone/lib/initial-operator-setup'

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
}

export function configuredStorefrontCarrierCode(env: NodeJS.ProcessEnv = process.env) {
  const code = env.STOREFRONT_CARRIER_CODE?.trim().toUpperCase() || (env.NODE_ENV === 'production' ? '' : 'AV')
  if (!/^[A-Z0-9]{2,3}$/.test(code)) {
    throw new Error('STOREFRONT_CARRIER_CODE must be a two or three character carrier designator.')
  }
  return code
}

export const getStorefrontCarrierIdentity = cache(async (): Promise<PublicCarrierIdentity | null> => {
  const response = await keystoneClient<{ publicCarrierIdentity: PublicCarrierIdentity | null }>(
    `query StorefrontCarrierIdentity($carrierCode: String!) {
      publicCarrierIdentity(carrierCode: $carrierCode) {
        id code name legalName defaultCurrencyCode defaultTimezone salesEnabled
        storefrontBrandColor storefrontHomepageTitle storefrontHomepageDescription storefrontConfigured
      }
    }`,
    { carrierCode: configuredStorefrontCarrierCode() },
    { cache: 'no-store' },
  )
  if (response.success) return response.data.publicCarrierIdentity ?? null
  // The only production exception is the explicit owner-approved empty runtime
  // window used by /dashboard/init. Retained runtimes still fail closed.
  if (process.env.NODE_ENV === 'production' && !initialOperatorSetupEnabled()) throw new Error('Persisted storefront carrier identity is unavailable.')
  return null
})
