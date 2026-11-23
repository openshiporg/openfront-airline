import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { PaymentProvidersPage } from '@/features/platform/payment-providers/screens/PaymentProvidersPage'

export default gatePlatformPage('payment-providers', PaymentProvidersPage)

export async function generateMetadata() {
  return staffTitle('Payment providers')
}
