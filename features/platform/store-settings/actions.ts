'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import type { StorefrontSettingsInput } from '@/features/keystone/mutations/storefrontSettings'

export async function updateStorefrontSettings(input: StorefrontSettingsInput) {
  const response = await keystoneClient<{ updateCarrierStorefrontSettings: { id: string; name: string; legalName: string; storefrontBrandColor: string; storefrontHomepageTitle: string; storefrontHomepageDescription: string; storefrontContactEmail: string; storefrontContactPhone: string; storefrontServiceHours: string } }>(`mutation UpdateCarrierStorefrontSettings($name:String!,$legalName:String!,$storefrontBrandColor:String!,$storefrontHomepageTitle:String!,$storefrontHomepageDescription:String!,$storefrontContactEmail:String,$storefrontContactPhone:String,$storefrontServiceHours:String){updateCarrierStorefrontSettings(name:$name,legalName:$legalName,storefrontBrandColor:$storefrontBrandColor,storefrontHomepageTitle:$storefrontHomepageTitle,storefrontHomepageDescription:$storefrontHomepageDescription,storefrontContactEmail:$storefrontContactEmail,storefrontContactPhone:$storefrontContactPhone,storefrontServiceHours:$storefrontServiceHours){id name legalName storefrontBrandColor storefrontHomepageTitle storefrontHomepageDescription storefrontContactEmail storefrontContactPhone storefrontServiceHours}}`, input)
  if (!response.success) throw new Error(response.error)

  for (const path of ['/', '/help', '/contact', '/check-in', '/manage-booking', '/status', '/dashboard/platform/store-settings']) revalidatePath(path)
  return response.data.updateCarrierStorefrontSettings
}
