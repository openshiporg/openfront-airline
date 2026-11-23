import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { PlatformManifestsPage } from '@/features/platform/screens/Canonical/PlatformDeskPages'

export default gatePlatformPage('manifests', PlatformManifestsPage)

export async function generateMetadata() {
  return staffTitle('Manifests')
}
