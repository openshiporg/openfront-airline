import { staffTitle } from '@/features/dashboard/lib/staffTitle'
import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { StorefrontSettingsPage } from '@/features/platform/store-settings/StorefrontSettingsPage'

export default gatePlatformPage('store-settings', StorefrontSettingsPage)

export async function generateMetadata() {
  return staffTitle('Storefront settings')
}
