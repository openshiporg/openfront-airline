import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import BookingsPage from '@/features/platform/screens/Bookings/BookingsPage'

export default gatePlatformPage('bookings', BookingsPage)

export async function generateMetadata() {
  return staffTitle('Bookings')
}
