import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { TicketListPage } from '@/features/platform/tickets/screens/TicketListPage'

export default gatePlatformPage('tickets', TicketListPage)

export async function generateMetadata() {
  return staffTitle('Tickets')
}
