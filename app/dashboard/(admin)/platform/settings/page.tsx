import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { PlatformSettingsPage } from '@/features/platform/screens/Canonical/PlatformDeskPages'

export default gatePlatformPage('settings', PlatformSettingsPage)

export async function generateMetadata() {
  return staffTitle('Settings')
}
