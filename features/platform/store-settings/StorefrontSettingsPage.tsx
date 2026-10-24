import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { DeskHeader, Notice, Well } from '@/features/platform/components/desk'
import { StorefrontSettingsForm } from './StorefrontSettingsForm'

export async function StorefrontSettingsPage() {
  const response = await keystoneClient<{ authenticatedItem?: { role?: { canManageOnboarding: boolean } | null; carrier?: { name: string; legalName: string; storefrontBrandColor?: string | null; storefrontHomepageTitle?: string | null; storefrontHomepageDescription?: string | null; storefrontContactEmail?: string | null; storefrontContactPhone?: string | null; storefrontServiceHours?: string | null } | null } | null }>(`query StorefrontSettings { authenticatedItem { ... on User { role { canManageOnboarding } carrier { name legalName storefrontBrandColor storefrontHomepageTitle storefrontHomepageDescription storefrontContactEmail storefrontContactPhone storefrontServiceHours } } } }`)
  const actor = response.success ? response.data.authenticatedItem : null

  return <PageContainer title="Storefront settings" header={<DeskHeader eyebrow="Platform" title="Storefront settings" />} breadcrumbs={[{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'page' as const, label: 'Platform' }, { type: 'page' as const, label: 'Storefront settings' }]}>
    <div className="min-w-0 px-4 pb-6 md:px-6">
      {!response.success ? <Notice tone="bad">Settings could not be loaded. Check your access and try again.</Notice>
        : !actor?.role?.canManageOnboarding ? <Notice tone="warn" role="alert">Storefront settings require carrier onboarding-management permission.</Notice>
        : !actor.carrier ? <Well>No carrier identity is configured. Complete carrier launch setup first.</Well>
        : <StorefrontSettingsForm initialSettings={actor.carrier} />}
    </div>
  </PageContainer>
}

export default StorefrontSettingsPage
