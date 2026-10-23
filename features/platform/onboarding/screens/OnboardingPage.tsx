import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { Code, DeskHeader, Notice, Well } from '@/features/platform/components/desk'
import { CarrierOnboardingForm } from '../components/CarrierOnboardingForm'

export async function OnboardingPage() {
  const response = await keystoneClient<{ authenticatedItem?: { carrier?: { name: string; legalName: string; code: string; defaultCurrencyCode: string; defaultTimezone: string } | null } | null }>(`query OnboardingCarrier { authenticatedItem { ... on User { carrier { name legalName code defaultCurrencyCode defaultTimezone } } } }`)
  const carrier = response.success ? response.data.authenticatedItem?.carrier : null
  const serviceDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
  return <PageContainer
    title="Carrier launch setup"
    header={<DeskHeader eyebrow="Platform" title="Carrier launch setup" meta={carrier ? <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><span>{carrier.name}</span><Code className="text-sm text-foreground">{carrier.code}</Code></span> : undefined} />}
    breadcrumbs={[{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'page' as const, label: 'Platform' }, { type: 'page' as const, label: 'Carrier launch setup' }]}
  >
    <div className="min-w-0 px-4 pb-6 md:px-6">
      {!response.success ? <Notice tone="bad">{response.error || 'Carrier identity could not be loaded.'}</Notice>
        : !carrier ? <Well role="alert">Your account is not assigned to a carrier, so launch setup is unavailable. Ask a carrier administrator to assign your operator account.</Well>
        : <CarrierOnboardingForm initialCarrier={carrier} initialServiceDate={serviceDate} />}
    </div>
  </PageContainer>
}
