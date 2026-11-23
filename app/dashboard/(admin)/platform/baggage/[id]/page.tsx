import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { BagDetailPage } from '@/features/platform/baggage/screens/BagDetailPage'

export default gatePlatformPage('baggage', BagDetailPage)

export async function generateMetadata() {
  return staffTitle('Bag')
}
