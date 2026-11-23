import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { NoAccessPage } from '@/features/dashboard/screens/NoAccessPage';

export default NoAccessPage;

export async function generateMetadata() {
  return staffTitle('No access')
}
