import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { PlatformInventoryPage } from '@/features/platform/screens/Canonical/PlatformDeskPages'

export default gatePlatformPage('inventory', PlatformInventoryPage)

export async function generateMetadata() {
  return staffTitle('Seat inventory')
}
