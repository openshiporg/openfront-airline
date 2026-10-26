import Link from 'next/link'

import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { isEvidenceOnlyManualProvider } from '@/features/keystone/lib/bounded-payment-policy'
import { Code, DeskHeader, type DeskTone, Notice, Panel, Pill, TitleLine, Track, Well } from '@/features/platform/components/desk'
import { NewManualProvider, NewStripeProvider, PaymentProviderActions } from '@/features/platform/payment-providers/components/PaymentProviderControls'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const PATH = '/dashboard/platform/payment-providers'
const STATUSES = ['active', 'inactive', 'degraded', 'disabled'] as const

type Provider = {
  id: string
  name: string | null
  code: string | null
  providerKey: string | null
  adapterType: string | null
  status: string | null
  configuration: unknown
  paymentsCount: number | null
  createdAt: string | null
}

const ADAPTER_LABEL: Record<string, string> = { manual: 'Manual', stripe: 'Stripe', paypal: 'PayPal', custom: 'Custom' }

function providerTone(status: string | null): DeskTone {
  if (status === 'active') return 'ok'
  if (status === 'degraded') return 'warn'
  if (status === 'disabled') return 'bad'
  return 'idle'
}

export async function PaymentProvidersPage({ searchParams }: { searchParams?: SearchParams } = {}) {
  const params = searchParams ? await searchParams : {}
  const statusParam = typeof params.status === 'string' ? params.status : ''
  const status = (STATUSES as readonly string[]).includes(statusParam) ? statusParam : ''

  const response = await keystoneClient<{
    authenticatedItem: { carrier: { id: string; code: string | null } | null } | null
    paymentProviders: Provider[] | null
  }>(
    `query PaymentProvidersDesk {
      authenticatedItem { ... on User { carrier { id code } } }
      paymentProviders(orderBy: [{ name: asc }], take: 200) {
        id name code providerKey adapterType status configuration paymentsCount createdAt
      }
    }`,
  )

  const providers = response.success ? response.data.paymentProviders : null
  const carrierCode = response.success ? response.data.authenticatedItem?.carrier?.code ?? null : null
  const counts = Object.fromEntries(STATUSES.map(value => [value, (providers ?? []).filter(provider => (provider.status ?? 'inactive') === value).length])) as Record<string, number>
  const visible = (providers ?? []).filter(provider => !status || (provider.status ?? 'inactive') === status)
  const activeCount = counts.active ?? 0

  const tabs = [
    { value: '', label: 'All', count: providers?.length },
    ...STATUSES.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1), count: providers ? counts[value] : undefined })),
  ]

  return (
    <PageContainer
      title="Payment providers"
      header={
        <DeskHeader
          eyebrow="Settlement"
          title="Payment providers"
          tone={providers ? (activeCount > 0 ? 'ok' : 'warn') : undefined}
          status={providers ? (activeCount > 0 ? 'Active provider' : 'No active provider') : undefined}
          meta={providers ? <span className="tabular-nums ">{activeCount} active</span> : undefined}
        />
      }
      breadcrumbs={[
        { type: 'link', label: 'Dashboard', href: '/dashboard' },
        { type: 'page', label: 'Platform' },
        { type: 'page', label: 'Payment providers' },
      ]}
    >
      <div className="min-w-0 space-y-6 p-4 [overflow-wrap:anywhere] md:p-6">
        {!response.success || providers === null ? (
          <Notice tone="warn" role="alert">
            <span>Payment providers are unavailable under your current access.</span>
            <Link href={PATH} className="ml-2 font-medium underline underline-offset-4">Retry</Link>
          </Notice>
        ) : (
          <>
            {carrierCode ? <div className="flex flex-wrap items-start gap-3"><NewManualProvider carrierCode={carrierCode} /><NewStripeProvider /></div> : <Notice tone="warn">Carrier unavailable for your account.</Notice>}

            <Track aria-label="Provider status" className="max-w-full">
              {tabs.map(tab => (
                <Pill key={tab.value || 'all'} asChild size="sm" active={status === tab.value}>
                  <Link href={tab.value ? `${PATH}?status=${tab.value}` : PATH} aria-current={status === tab.value ? 'page' : undefined}>
                    {tab.label}
                    {tab.count != null && <span className="tabular-nums text-[11px]  text-muted-foreground">{tab.count}</span>}
                  </Link>
                </Pill>
              ))}
            </Track>

            {visible.length === 0 ? (
              <Well>No payment providers.</Well>
            ) : (
              <Panel className="divide-y">
                {visible.map(provider => {
                  const evidenceOnly = isEvidenceOnlyManualProvider({ adapterType: provider.adapterType, configuration: provider.configuration })
                  const adapter = ADAPTER_LABEL[provider.adapterType ?? ''] ?? provider.adapterType ?? 'Unknown'
                  return (
                    <div key={provider.id} className="flex min-w-0 flex-col gap-3 px-4 py-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 space-y-1">
                        <TitleLine as="h3" tone={providerTone(provider.status)} status={provider.status ?? 'inactive'} className="text-sm font-medium text-foreground">
                          {provider.name || 'Unnamed provider'}
                          <span className="ml-2 text-xs font-normal capitalize text-muted-foreground">{provider.status ?? 'inactive'}</span>
                        </TitleLine>
                        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 pl-4 text-xs text-muted-foreground">
                          <Code className="text-foreground">{provider.code}</Code>
                          <span>{adapter}</span>
                          <span>{evidenceOnly ? 'Evidence only' : provider.adapterType === 'manual' ? 'Configuration not evidence-only' : provider.adapterType === 'stripe' ? 'Card payments online' : 'Not installed'}</span>
                          <span className="tabular-nums ">{provider.paymentsCount ?? 0} payments</span>
                        </p>
                        <p className="pl-4"><Code className="break-all">{provider.providerKey}</Code></p>
                      </div>
                      <div className="min-w-0 pl-4 md:pl-0">
                        <PaymentProviderActions id={provider.id} status={provider.status} adapterType={provider.adapterType} />
                      </div>
                    </div>
                  )
                })}
              </Panel>
            )}
          </>
        )}
      </div>
    </PageContainer>
  )
}
