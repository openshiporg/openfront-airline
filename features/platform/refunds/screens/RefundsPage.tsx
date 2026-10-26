import Link from 'next/link'
import { ChevronRight, Search } from 'lucide-react'

import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { formatMinorUnits } from '@/features/keystone/lib/money'
import { Code, DeskHeader, Field, FilterBar, Notice, Panel, Pill, TitleLine, Track, Well, deskInput } from '@/features/platform/components/desk'
import {
  REFUND_REASON_LABEL,
  REFUND_STATUSES,
  bookingDeskHref,
  formatInstant,
  refundStatusLabel,
  refundTone,
} from '@/features/platform/refunds/components/refundFormat'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const PATH = '/dashboard/platform/refunds'
const PAGE_SIZE = 100

type RefundRow = {
  id: string
  refundKey: string | null
  status: string | null
  reason: string | null
  amount: number | null
  currencyCode: string | null
  requestedAt: string | null
  processedAt: string | null
  booking: { id: string; recordLocator: string | null } | null
}

function hrefWith(current: { q: string; status: string; page: number }, patch: Partial<{ q: string; status: string; page: number }>) {
  const next = { ...current, ...patch }
  const query = new URLSearchParams()
  if (next.q) query.set('q', next.q)
  if (next.status) query.set('status', next.status)
  if (next.page > 1) query.set('page', String(next.page))
  const text = query.toString()
  return text ? `${PATH}?${text}` : PATH
}

export async function RefundsPage({ searchParams }: { searchParams?: SearchParams } = {}) {
  const params = searchParams ? await searchParams : {}
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 80) : ''
  const statusParam = typeof params.status === 'string' ? params.status : ''
  const status = (REFUND_STATUSES as readonly string[]).includes(statusParam) ? statusParam : ''
  const pageParam = typeof params.page === 'string' ? Number.parseInt(params.page, 10) : 1
  const page = Number.isFinite(pageParam) && pageParam > 0 && pageParam <= 1000 ? pageParam : 1
  const filters = { q, status, page }

  const search = q
    ? [{ OR: [
      { refundKey: { contains: q, mode: 'insensitive' } },
      { booking: { recordLocator: { contains: q.toUpperCase() } } },
    ] }]
    : []
  const withStatus = (value: string) => ({ AND: [...search, { status: { equals: value } }] })
  const countVariables = Object.fromEntries(REFUND_STATUSES.map(value => [`${value}Where`, withStatus(value)]))

  const response = await keystoneClient<{
    refunds: RefundRow[] | null
    all: number | null
  } & Partial<Record<(typeof REFUND_STATUSES)[number], number | null>>>(
    `query RefundsDesk($where: RefundWhereInput!, $base: RefundWhereInput!, $take: Int!, $skip: Int!, ${REFUND_STATUSES.map(value => `$${value}Where: RefundWhereInput!`).join(', ')}) {
      refunds(where: $where, orderBy: [{ requestedAt: desc }], take: $take, skip: $skip) {
        id refundKey status reason amount currencyCode requestedAt processedAt
        booking { id recordLocator }
      }
      all: refundsCount(where: $base)
      ${REFUND_STATUSES.map(value => `${value}: refundsCount(where: $${value}Where)`).join('\n      ')}
    }`,
    {
      where: status ? withStatus(status) : { AND: search },
      base: { AND: search },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      ...countVariables,
    },
  )

  const rows = response.success ? response.data.refunds : null
  const data = response.success ? response.data : null
  const total = data ? (status ? data[status as (typeof REFUND_STATUSES)[number]] : data.all) ?? 0 : 0
  const hasNext = rows ? page * PAGE_SIZE < total : false
  const awaiting = (data?.requested ?? 0) + (data?.approved ?? 0) + (data?.processing ?? 0)

  const tabs = [
    { value: '', label: 'All', count: data?.all },
    ...REFUND_STATUSES.map(value => ({ value, label: refundStatusLabel(value), count: data?.[value] })),
  ]

  return (
    <PageContainer
      title="Refunds"
      header={
        <DeskHeader
          eyebrow="Settlement"
          title="Refunds"
          tone={data ? (awaiting > 0 ? 'warn' : undefined) : undefined}
          status={awaiting > 0 ? 'Open refunds' : undefined}
          meta={data ? <span className="tabular-nums ">{awaiting} open</span> : undefined}
        />
      }
      breadcrumbs={[
        { type: 'link', label: 'Dashboard', href: '/dashboard' },
        { type: 'page', label: 'Platform' },
        { type: 'page', label: 'Refunds' },
      ]}
    >
      <div className="min-w-0 space-y-6 p-4 [overflow-wrap:anywhere] md:p-6">
        <Track aria-label="Refund status" className="max-w-full">
          {tabs.map(tab => (
            <Pill key={tab.value || 'all'} asChild size="sm" active={status === tab.value}>
              <Link href={hrefWith(filters, { status: tab.value, page: 1 })} aria-current={status === tab.value ? 'page' : undefined}>
                {tab.label}
                {tab.count != null && <span className="tabular-nums text-[11px]  text-muted-foreground">{tab.count}</span>}
              </Link>
            </Pill>
          ))}
        </Track>

        <FilterBar action={PATH}>
          {status && <input type="hidden" name="status" value={status} />}
          <Field label="Record locator or refund key" className="sm:flex-1">
            <span className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="search" name="q" defaultValue={q} maxLength={80} className={`${deskInput} pl-9 tabular-nums`} />
            </span>
          </Field>
          <Track>
            <Pill type="submit" variant="primary">Search</Pill>
            <Pill asChild><Link href={status ? `${PATH}?status=${status}` : PATH}>Clear</Link></Pill>
          </Track>
        </FilterBar>

        {!response.success || rows === null ? (
          <Notice tone="warn" role="alert">
            <span>Refunds are unavailable under your current access.</span>
            <Link href={hrefWith(filters, {})} className="ml-2 font-medium underline underline-offset-4">Retry</Link>
          </Notice>
        ) : rows.length === 0 ? (
          page > 1 ? (
            <Notice tone="warn">
              <span>This page is out of date.</span>
              <Link href={hrefWith(filters, { page: 1 })} className="ml-2 font-medium underline underline-offset-4">First page</Link>
            </Notice>
          ) : <Well>{q ? 'No matching refunds.' : 'No refunds.'}</Well>
        ) : (
          <div className="space-y-3">
            <Panel className="divide-y">
              {rows.map(refund => {
                const requested = formatInstant(refund.requestedAt)
                const processed = formatInstant(refund.processedAt)
                return (
                  <div key={refund.id} className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3">
                    <div className="min-w-0 space-y-1">
                      <TitleLine as="h3" tone={refundTone(refund.status)} status={refundStatusLabel(refund.status)} className="text-sm font-medium">
                        <Link href={`${PATH}/${refund.id}`} className="tabular-nums font-semibold tracking-tight text-foreground hover:underline hover:underline-offset-4">{refund.refundKey ?? refund.id}</Link>
                        <span className="ml-2 text-xs font-normal text-muted-foreground">{refundStatusLabel(refund.status)}</span>
                      </TitleLine>
                      <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 pl-4 text-xs text-muted-foreground">
                        {refund.booking?.recordLocator ? (
                          <Link href={bookingDeskHref(refund.booking.recordLocator)} className="tabular-nums font-semibold tracking-wider text-foreground underline-offset-4 hover:underline">{refund.booking.recordLocator}</Link>
                        ) : <span>Booking unavailable</span>}
                        <span>{REFUND_REASON_LABEL[refund.reason ?? ''] ?? refund.reason ?? 'No reason'}</span>
                      </p>
                      <p className="pl-4 tabular-nums text-[12px]  text-muted-foreground">
                        <span className="font-sans">Requested</span> {requested ?? '---'}
                        {processed && <><span className="ml-2 font-sans">Processed</span> {processed}</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pl-4 sm:pl-0">
                      <span className="tabular-nums text-sm font-semibold  text-foreground">{formatMinorUnits(refund.amount, refund.currencyCode)}</span>
                      <Link href={`${PATH}/${refund.id}`} aria-label={`Refund ${refund.refundKey ?? refund.id}`} className="text-muted-foreground hover:text-foreground">
                        <ChevronRight aria-hidden="true" className="size-4" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </Panel>
            {(page > 1 || hasNext) && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Code>{(page - 1) * PAGE_SIZE + 1}-{(page - 1) * PAGE_SIZE + rows.length} of {total}</Code>
                <Track aria-label="Pages">
                  {page > 1 && <Pill asChild size="sm"><Link href={hrefWith(filters, { page: page - 1 })}>Previous</Link></Pill>}
                  {hasNext && <Pill asChild size="sm"><Link href={hrefWith(filters, { page: page + 1 })}>Next {PAGE_SIZE}</Link></Pill>}
                </Track>
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  )
}
