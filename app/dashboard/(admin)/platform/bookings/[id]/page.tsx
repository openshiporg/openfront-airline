import { PlatformRecordDetail } from '@/features/platform/screens/Canonical/PlatformRecordDetails'

export default async function BookingDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string,string|string[]|undefined>> }) { return <PlatformRecordDetail desk="bookings" id={(await params).id} returnTo={(await searchParams).returnTo} /> }
