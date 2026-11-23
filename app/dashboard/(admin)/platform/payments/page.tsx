import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { PlatformPaymentsPage } from '@/features/platform/screens/Canonical/PlatformDeskPages'

export default gatePlatformPage('payments', PlatformPaymentsPage)

export async function generateMetadata() {
  return staffTitle('Payments')
}
