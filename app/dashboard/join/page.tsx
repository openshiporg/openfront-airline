import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { JoinPage } from '@/features/dashboard/screens/JoinPage'

export default JoinPage

export async function generateMetadata() {
  return staffTitle('Join the team')
}
