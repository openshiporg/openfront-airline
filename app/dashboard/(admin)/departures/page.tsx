import { LegacyDeskRedirect } from '@/features/platform/screens/Canonical/LegacyDeskRedirect'

export default function LegacyPage(props: { searchParams: Promise<Record<string,string|string[]|undefined>> }) { return <LegacyDeskRedirect desk="departures" {...props} /> }
