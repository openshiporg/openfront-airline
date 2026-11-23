import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { SignUpPage } from "@/features/dashboard/screens/SignUpPage";

export default SignUpPage;

export async function generateMetadata() {
  return staffTitle('Create account')
}
