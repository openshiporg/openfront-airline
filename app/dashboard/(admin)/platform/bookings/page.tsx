import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { PlatformBookingsPage } from '@/features/platform/screens/Canonical/PlatformDeskPages'

export default gatePlatformPage('bookings', PlatformBookingsPage)

export async function generateMetadata() {
  return staffTitle('Bookings')
}
