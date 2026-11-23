import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { PlatformDisruptionsPage } from '@/features/platform/screens/Canonical/PlatformDeskPages'

export default gatePlatformPage('disruptions', PlatformDisruptionsPage)

export async function generateMetadata() {
  return staffTitle('Disruptions')
}
