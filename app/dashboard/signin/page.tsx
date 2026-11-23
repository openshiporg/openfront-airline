import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { SignInPage } from "@/features/dashboard/screens/SignInPage";

export default SignInPage;

export async function generateMetadata() {
  return staffTitle('Sign in')
}
