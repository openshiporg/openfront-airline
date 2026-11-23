import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { BaggageListPage } from '@/features/platform/baggage/screens/BaggageListPage'

export default gatePlatformPage('baggage', BaggageListPage)

export async function generateMetadata() {
  return staffTitle('Baggage')
}
