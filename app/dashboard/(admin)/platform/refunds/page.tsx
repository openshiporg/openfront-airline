import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { RefundsPage } from '@/features/platform/refunds/screens/RefundsPage'

export default gatePlatformPage('refunds', RefundsPage)

export async function generateMetadata() {
  return staffTitle('Refunds')
}
