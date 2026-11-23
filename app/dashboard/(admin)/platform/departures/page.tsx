import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { PlatformDeparturesPage } from '@/features/platform/screens/Canonical/PlatformDeskPages'

export default gatePlatformPage('departures', PlatformDeparturesPage)

export async function generateMetadata() {
  return staffTitle('Departures')
}
