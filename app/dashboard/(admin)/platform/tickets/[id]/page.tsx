import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { TicketDetailPage } from '@/features/platform/tickets/screens/TicketDetailPage'

export default gatePlatformPage('tickets', TicketDetailPage)

export async function generateMetadata() {
  return staffTitle('Ticket')
}
