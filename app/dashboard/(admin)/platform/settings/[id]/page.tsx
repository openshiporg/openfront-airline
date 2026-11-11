import { gatePlatformPage } from '@/features/dashboard/lib/platformGate'
import { PlatformRecordDetail } from '@/features/platform/screens/Canonical/PlatformRecordDetails'

export default gatePlatformPage('settings', async function ProviderConnectionDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string,string|string[]|undefined>> }) { return <PlatformRecordDetail desk="settings" id={(await params).id} returnTo={(await searchParams).returnTo} /> })
