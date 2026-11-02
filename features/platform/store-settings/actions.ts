'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { sanitizeStoreLogoSvg } from '@/features/keystone/utils/storeLogo'
import { normalizeStoreLogoColor } from './lib/store-logo'
import type { StorefrontSettingsInput } from '@/features/keystone/mutations/storefrontSettings'

export async function updateStorefrontSettings(input: StorefrontSettingsInput) {
  // Sanitize, then normalize, then mutate, then revalidate. A logo field that was not sent is left alone.
  const logoIcon = input.logoIcon ? sanitizeStoreLogoSvg(input.logoIcon) : undefined
  if (input.logoIcon && !logoIcon) throw new Error('Invalid SVG format')
  const logoColor = input.logoColor === undefined || input.logoColor === null ? undefined : normalizeStoreLogoColor(input.logoColor)
  const sanitizedData = { ...input, logoIcon, logoColor }
  const response = await keystoneClient<{ updateCarrierStorefrontSettings: { id: string; name: string; legalName: string; logoIcon: string; logoColor: string; storefrontBrandColor: string; storefrontHomepageTitle: string; storefrontHomepageDescription: string; storefrontContactEmail: string; storefrontContactPhone: string; storefrontServiceHours: string } }>(`mutation UpdateCarrierStorefrontSettings($name:String!,$legalName:String!,$storefrontBrandColor:String!,$storefrontHomepageTitle:String!,$storefrontHomepageDescription:String!,$storefrontContactEmail:String,$storefrontContactPhone:String,$storefrontServiceHours:String,$logoIcon:String,$logoColor:String){updateCarrierStorefrontSettings(name:$name,legalName:$legalName,storefrontBrandColor:$storefrontBrandColor,storefrontHomepageTitle:$storefrontHomepageTitle,storefrontHomepageDescription:$storefrontHomepageDescription,storefrontContactEmail:$storefrontContactEmail,storefrontContactPhone:$storefrontContactPhone,storefrontServiceHours:$storefrontServiceHours,logoIcon:$logoIcon,logoColor:$logoColor){id name legalName logoIcon logoColor storefrontBrandColor storefrontHomepageTitle storefrontHomepageDescription storefrontContactEmail storefrontContactPhone storefrontServiceHours}}`, sanitizedData)
  if (!response.success) throw new Error(response.error)

  for (const path of ['/', '/help', '/contact', '/check-in', '/manage-booking', '/status', '/dashboard/platform/store-settings']) revalidatePath(path)
  return response.data.updateCarrierStorefrontSettings
}
