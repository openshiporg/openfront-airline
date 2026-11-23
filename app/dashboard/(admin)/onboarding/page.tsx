import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { OnboardingPage } from '@/features/platform/onboarding/screens/OnboardingPage'

export default gatePlatformPage('onboarding', OnboardingPage)

export async function generateMetadata() {
  return staffTitle('Onboarding')
}
