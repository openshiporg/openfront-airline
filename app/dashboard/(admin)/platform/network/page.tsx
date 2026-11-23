import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { NetworkPage } from '@/features/platform/network/screens/NetworkPage'

export default gatePlatformPage('network', NetworkPage)

export async function generateMetadata() {
  return staffTitle('Network')
}
