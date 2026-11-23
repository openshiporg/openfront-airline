import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { ResetPage } from "@/features/dashboard/screens/ResetPage";

export default ResetPage;

export async function generateMetadata() {
  return staffTitle('Reset password')
}
