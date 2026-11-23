import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { InitPage } from "@/features/dashboard/screens/InitPage";

export default InitPage;

export async function generateMetadata() {
  return staffTitle('Set up')
}
