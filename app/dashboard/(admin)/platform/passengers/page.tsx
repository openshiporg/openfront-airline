import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { PlatformPassengersPage } from '@/features/platform/screens/Canonical/PlatformDeskPages'

export default gatePlatformPage('passengers', PlatformPassengersPage)

export async function generateMetadata() {
  return staffTitle('Passengers')
}
