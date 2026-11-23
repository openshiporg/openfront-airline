import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { PlatformSchedulesPage } from '@/features/platform/screens/Canonical/PlatformDeskPages'

export default gatePlatformPage('schedules', PlatformSchedulesPage)

export async function generateMetadata() {
  return staffTitle('Schedules')
}
