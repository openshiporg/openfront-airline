import { staffTitle } from '@/features/dashboard/lib/staffTitle'
export { default } from '@/features/platform/screens/Operations/OperationsPage'

export async function generateMetadata() {
  return staffTitle('Overview')
}
