import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { StorefrontSettingsForm } from './StorefrontSettingsForm'

export async function StorefrontSettingsPage() {
  const response = await keystoneClient<{ authenticatedItem?: { role?: { canManageOnboarding: boolean } | null; carrier?: { name: string; legalName: string; storefrontBrandColor?: string | null; storefrontHomepageTitle?: string | null; storefrontHomepageDescription?: string | null } | null } | null }>(`query StorefrontSettings { authenticatedItem { ... on User { role { canManageOnboarding } carrier { name legalName storefrontBrandColor storefrontHomepageTitle storefrontHomepageDescription } } } }`)
  const actor = response.success ? response.data.authenticatedItem : null

  return <PageContainer title="Storefront settings" breadcrumbs={[{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'page' as const, label: 'Platform' }, { type: 'page' as const, label: 'Storefront settings' }]}>
    <header className="border-b px-4 py-5 md:px-6"><p className="text-xs font-medium text-muted-foreground">Operator-owned public configuration</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Storefront settings</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Configure carrier identity, homepage content, and an allowlisted public theme. Provider readiness remains separate under Settings &amp; readiness.</p></header>
    <div className="max-w-4xl p-4 md:p-6">
      {!response.success ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Settings could not be loaded. Check your access and try again.</p>
        : !actor?.role?.canManageOnboarding ? <p role="alert" className="rounded-lg border p-4 text-sm text-muted-foreground">Storefront settings require carrier onboarding-management permission.</p>
        : !actor.carrier ? <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No carrier identity is configured. Complete carrier launch setup before publishing a storefront theme.</p>
        : <StorefrontSettingsForm initialSettings={actor.carrier} />}
    </div>
  </PageContainer>
}

export default StorefrontSettingsPage
