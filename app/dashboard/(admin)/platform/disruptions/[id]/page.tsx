import { PlatformRecordDetail } from '@/features/platform/screens/Canonical/PlatformRecordDetails'

export default async function DisruptionDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string,string|string[]|undefined>> }) { return <PlatformRecordDetail desk="disruptions" id={(await params).id} returnTo={(await searchParams).returnTo} /> }
