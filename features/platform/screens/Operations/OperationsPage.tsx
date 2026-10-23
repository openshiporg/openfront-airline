import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { Code, DeskHeader, DeskSection, Notice, Readout, ReadoutStrip, RowLink } from '@/features/platform/components/desk'
import { OnboardingLaunchCard } from '@/features/platform/onboarding/components/OnboardingLaunchCard'

const workspaces = [
  { href: '/dashboard/platform/schedules', title: 'Schedules' },
  { href: '/dashboard/platform/inventory', title: 'Inventory & fares' },
  { href: '/dashboard/platform/offers', title: 'Offers' },
  { href: '/dashboard/platform/bookings', title: 'Bookings' },
  { href: '/dashboard/platform/passengers', title: 'Passengers' },
  { href: '/dashboard/platform/departures', title: 'Departures' },
  { href: '/dashboard/platform/disruptions', title: 'Disruptions' },
  { href: '/dashboard/platform/payments', title: 'Payments & refunds' },
  { href: '/dashboard/platform/manifests', title: 'Manifest entry & audit' },
  { href: '/dashboard/platform/store-settings', title: 'Storefront settings' },
  { href: '/dashboard/platform/settings', title: 'Readiness & settings' },
] as const

export default async function OperationsPage() {
  const identity = await keystoneClient<{ authenticatedItem: { onboardingStatus: string; carrier?: { name: string; legalName: string; code: string; defaultCurrencyCode: string; defaultTimezone: string } | null; role?: { canManageOnboarding: boolean } | null } | null }>(`query OperatorOperationsIdentity { authenticatedItem { ... on User { onboardingStatus carrier { name legalName code defaultCurrencyCode defaultTimezone } role { canManageOnboarding } } } }`)
  const operator = identity.success ? identity.data.authenticatedItem : null
  const carrier = operator?.carrier
  const launchStatus = operator?.onboardingStatus
  const launchTone = launchStatus === 'completed' ? 'ok' as const : launchStatus ? 'warn' as const : 'idle' as const
  return <PageContainer
    title="Carrier operations"
    breadcrumbs={[{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'page' as const, label: 'Platform' }, { type: 'page' as const, label: 'Carrier operations' }]}
    header={<DeskHeader
      eyebrow="Carrier operations"
      title={carrier?.name ?? 'Carrier unavailable'}
      tone={carrier ? launchTone : 'idle'}
      status={carrier ? `Launch setup ${(launchStatus ?? 'unknown').replaceAll('_', ' ')}` : 'Unavailable'}
      meta={carrier ? <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><Code className="text-sm font-semibold text-foreground">{carrier.code}</Code><span>{carrier.legalName}</span></span> : undefined}
    />}
  >
    <div className="min-w-0 space-y-6 px-4 pb-6 md:px-6">
      {!identity.success && <Notice tone="bad">Operator identity could not be loaded.</Notice>}
      {carrier && <ReadoutStrip>
        <Readout label="Code" value={<span className="font-mono">{carrier.code}</span>} />
        <Readout label="Currency" value={<span className="font-mono">{carrier.defaultCurrencyCode}</span>} />
        <Readout label="Timezone" value={<span className="font-mono text-base md:text-lg">{carrier.defaultTimezone}</span>} />
        <Readout label="Launch setup" tone={launchTone} value={<span className="capitalize">{(launchStatus ?? 'unknown').replaceAll('_', ' ')}</span>} />
      </ReadoutStrip>}
      {carrier && launchStatus !== 'completed' && operator?.role?.canManageOnboarding && <OnboardingLaunchCard initialCarrier={carrier} initialServiceDate={new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)} />}
      <DeskSection title="Workspaces" count={workspaces.length}>
        <nav aria-label="Workspaces" className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3 sm:[&>*:last-child]:col-span-2">
          {workspaces.map(item => <RowLink key={item.href} href={item.href} className="bg-card"><span className="text-sm font-medium text-foreground">{item.title}</span></RowLink>)}
        </nav>
      </DeskSection>
    </div>
  </PageContainer>
}
