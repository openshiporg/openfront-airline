import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { CarrierOnboardingForm } from '../components/CarrierOnboardingForm'

export async function OnboardingPage() {
  const response = await keystoneClient<{ authenticatedItem?: { carrier?: { name: string; legalName: string; code: string; defaultCurrencyCode: string; defaultTimezone: string } | null } | null }>(`query OnboardingCarrier { authenticatedItem { ... on User { carrier { name legalName code defaultCurrencyCode defaultTimezone } } } }`)
  const carrier = response.success ? response.data.authenticatedItem?.carrier : null
  const serviceDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
  return <PageContainer title="Carrier launch setup" breadcrumbs={[{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'page' as const, label: 'Platform' }, { type: 'page' as const, label: 'Carrier launch setup' }]}>
    <div className="space-y-6 p-4 md:p-6">
      <div><h1 className="text-2xl font-semibold">Carrier launch setup</h1><p className="text-muted-foreground">Set up your carrier identity and one sellable dated flight. Running setup again checks what already exists and never overwrites a live commercial service.</p></div>
      {!response.success ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{response.error || 'Carrier identity could not be loaded.'}</p>
        : !carrier ? <p role="alert" className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Your account is not assigned to a carrier, so launch setup is unavailable. Ask a carrier administrator to assign your operator account.</p>
        : <CarrierOnboardingForm initialCarrier={carrier} initialServiceDate={serviceDate} />}
    </div>
  </PageContainer>
}
