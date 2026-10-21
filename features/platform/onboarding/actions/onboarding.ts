'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type OnboardingCarrier = { id: string; name: string; legalName: string; code: string; defaultCurrencyCode: string; defaultTimezone: string }

export type OnboardingCarrierResult = { success: true; carrier: OnboardingCarrier | null } | { success: false; error: string }

// The persisted carrier identity the launch form starts from, read the same way as the onboarding page
export async function getOnboardingCarrier(): Promise<OnboardingCarrierResult> {
  const response = await keystoneClient<{ authenticatedItem?: { carrier?: OnboardingCarrier | null } | null }>(`query OnboardingCarrier { authenticatedItem { ... on User { carrier { id name legalName code defaultCurrencyCode defaultTimezone } } } }`)
  if (!response.success) return { success: false, error: 'Carrier identity could not be loaded. Try again.' }
  return { success: true, carrier: response.data.authenticatedItem?.carrier ?? null }
}

// User.onboardingStatus is command-only here, so the sidebar card's "Skip for now" goes through the self-only
// dismissCarrierOnboarding command, which never overwrites a completed launch.
export async function dismissOnboarding(): Promise<{ success: true } | { success: false; error: string }> {
  const response = await keystoneClient<{ dismissCarrierOnboarding?: { id: string; onboardingStatus: string } | null }>(`mutation DismissCarrierOnboarding { dismissCarrierOnboarding { id onboardingStatus } }`)
  if (!response.success) return { success: false, error: response.error || 'Carrier launch setup could not be dismissed.' }
  const status = response.data.dismissCarrierOnboarding?.onboardingStatus
  if (status !== 'dismissed' && status !== 'completed') return { success: false, error: 'Carrier launch setup could not be dismissed.' }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/(admin)')
  return { success: true }
}
