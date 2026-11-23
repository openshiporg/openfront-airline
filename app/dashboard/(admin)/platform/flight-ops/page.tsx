import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { FlightOpsPage } from '@/features/platform/flight-ops/screens/FlightOpsPage'

export default gatePlatformPage('flight-ops', FlightOpsPage)

export async function generateMetadata() {
  return staffTitle('Flight operations')
}
