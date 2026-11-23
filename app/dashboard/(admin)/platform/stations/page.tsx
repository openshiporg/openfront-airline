import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { StationsPage } from '@/features/platform/stations/screens/StationsPage'

export default gatePlatformPage('stations', StationsPage)

export async function generateMetadata() {
  return staffTitle('Stations')
}
