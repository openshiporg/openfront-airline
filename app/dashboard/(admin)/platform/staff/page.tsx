import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { StaffPage } from '@/features/platform/staff/StaffPage'

export default gatePlatformPage('staff', StaffPage)

export async function generateMetadata() {
  return staffTitle('Staff')
}
