import Link from 'next/link'

import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { formatMinorUnits } from '@/features/keystone/lib/money'
import { DeskHeader, DeskSection, Facts, Notice, Panel, Pill, StatusLabel, Track } from '@/features/platform/components/desk'
import {
  REFUND_REASON_LABEL,
  bookingDeskHref,
  formatInstant,
  refundStatusLabel,
  refundTone,
} from '@/features/platform/refunds/components/refundFormat'

const PATH = '/dashboard/platform/refunds'

type RefundDetail = {
  id: string
  refundKey: string | null
  status: string | null
  reason: string | null
  amount: number | null
  currencyCode: string | null
  providerRefundId: string | null
  note: string | null
  errorMessage: string | null
  requestedAt: string | null
  approvedAt: string | null
  processedAt: string | null
  booking: { id: string; recordLocator: string | null; status: string | null; paymentStatus: string | null } | null
  payment: {
    id: string
    paymentKey: string | null
    status: string | null
    amount: number | null
    capturedAmount: number | null
    refundedAmount: number | null
    currencyCode: string | null
    provider: { name: string | null } | null
  } | null
}

export async function RefundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const response = await keystoneClient<{ refund: RefundDetail | null }>(
    `query RefundDetail($id: ID!) {
      refund(where: { id: $id }) {
        id refundKey status reason amount currencyCode providerRefundId note errorMessage requestedAt approvedAt processedAt
        booking { id recordLocator status paymentStatus }
        payment { id paymentKey status amount capturedAmount refundedAmount currencyCode provider { name } }
      }
    }`,
    { id },
  )
  const refund = response.success ? response.data.refund : null
  const title = refund?.refundKey ?? 'Refund'
  const payment = refund?.payment ?? null
  const currency = payment?.currencyCode ?? refund?.currencyCode ?? null
  const remaining = payment ? Math.max(0, (payment.capturedAmount ?? 0) - (payment.refundedAmount ?? 0)) : null
  const locator = refund?.booking?.recordLocator ?? null

  return (
    <PageContainer
      title={title}
      header={
        <DeskHeader
          eyebrow="Refund"
          title={<span className="tabular-nums tracking-tight">{title}</span>}
          tone={refund ? refundTone(refund.status) : undefined}
          status={refund ? refundStatusLabel(refund.status) : undefined}
          meta={refund ? <span><span className="tabular-nums ">{formatMinorUnits(refund.amount, refund.currencyCode)}</span> <span className="ml-1">{refundStatusLabel(refund.status)}</span></span> : undefined}
          actions={refund ? (
            <Track>
              <Pill asChild variant="primary"><Link href={bookingDeskHref(locator)}>Open booking</Link></Pill>
              <Pill asChild><Link href={PATH}>Refunds</Link></Pill>
            </Track>
          ) : undefined}
        />
      }
      breadcrumbs={[
        { type: 'link', label: 'Dashboard', href: '/dashboard' },
        { type: 'page', label: 'Platform' },
        { type: 'link', label: 'Refunds', href: PATH },
        { type: 'page', label: title },
      ]}
    >
      <div className="min-w-0 space-y-6 p-4 [overflow-wrap:anywhere] md:p-6">
        {!response.success ? (
          <Notice tone="warn" role="alert">
            <span>This refund is unavailable under your current access.</span>
            <Link href={`${PATH}/${encodeURIComponent(id)}`} className="ml-2 font-medium underline underline-offset-4">Retry</Link>
          </Notice>
        ) : !refund ? (
          <Notice tone="warn" role="alert">
            <span>Refund not found or inaccessible.</span>
            <Link href={PATH} className="ml-2 font-medium underline underline-offset-4">Refunds</Link>
          </Notice>
        ) : (
          <>
            {refund.status === 'failed' && refund.errorMessage && <Notice tone="bad">{refund.errorMessage}</Notice>}
            <div className="grid min-w-0 gap-6 lg:grid-cols-2">
              <DeskSection title="Refund">
                <Panel className="px-4">
                  <Facts
                    items={[
                      { label: 'Refund key', value: refund.refundKey ?? '---', mono: true },
                      { label: 'Status', value: <StatusLabel status={refund.status} /> },
                      { label: 'Reason', value: REFUND_REASON_LABEL[refund.reason ?? ''] ?? refund.reason ?? '---' },
                      { label: 'Amount', value: formatMinorUnits(refund.amount, refund.currencyCode), mono: true },
                      { label: 'Requested', value: formatInstant(refund.requestedAt) ?? '---', mono: true },
                      refund.approvedAt ? { label: 'Approved', value: formatInstant(refund.approvedAt) ?? '---', mono: true } : null,
                      { label: 'Processed', value: formatInstant(refund.processedAt) ?? '---', mono: true },
                      refund.providerRefundId ? { label: 'Provider reference', value: refund.providerRefundId, mono: true } : null,
                      refund.note ? { label: 'Note', value: refund.note } : null,
                    ]}
                  />
                </Panel>
              </DeskSection>
              <DeskSection title="Payment">
                {payment ? (
                  <Panel className="px-4">
                    <Facts
                      items={[
                        { label: 'Payment', value: <Link href={`/dashboard/platform/payments/${payment.id}`} className="underline-offset-4 hover:underline">{payment.paymentKey ?? payment.id}</Link>, mono: true },
                        { label: 'Status', value: <StatusLabel status={payment.status} /> },
                        { label: 'Provider', value: payment.provider?.name ?? '---' },
                        { label: 'Amount', value: formatMinorUnits(payment.amount, currency), mono: true },
                        { label: 'Captured', value: formatMinorUnits(payment.capturedAmount ?? 0, currency), mono: true },
                        { label: 'Refunded', value: formatMinorUnits(payment.refundedAmount ?? 0, currency), mono: true },
                        { label: 'Remaining', value: <span className="font-semibold">{formatMinorUnits(remaining, currency)}</span>, mono: true },
                      ]}
                    />
                  </Panel>
                ) : (
                  <Notice tone="warn">Payment unavailable.</Notice>
                )}
              </DeskSection>
            </div>
            <DeskSection title="Booking">
              {refund.booking ? (
                <Panel className="px-4">
                  <Facts
                    items={[
                      { label: 'Record locator', value: <Link href={bookingDeskHref(locator)} className="font-semibold tracking-wider underline-offset-4 hover:underline">{locator ?? '---'}</Link>, mono: true },
                      { label: 'Booking status', value: <StatusLabel status={refund.booking.status} /> },
                      { label: 'Payment status', value: <StatusLabel status={refund.booking.paymentStatus} /> },
                    ]}
                  />
                </Panel>
              ) : (
                <Notice tone="warn">Booking unavailable.</Notice>
              )}
            </DeskSection>
          </>
        )}
      </div>
    </PageContainer>
  )
}
