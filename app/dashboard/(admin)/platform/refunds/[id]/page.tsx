import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { RefundDetailPage } from '@/features/platform/refunds/screens/RefundDetailPage'

export default gatePlatformPage('refunds', RefundDetailPage)

export async function generateMetadata() {
  return staffTitle('Refund')
}
