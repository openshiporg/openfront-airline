import type { CapturePaymentInput, CapturePaymentResult, PaymentAdapter, PaymentProviderConfiguration, RefundPaymentInput, RefundPaymentResult } from './types'

// Stripe over its REST API (no SDK). The secret key lives in the carrier's PaymentProvider.credentials, which the
// GraphQL API never returns; it is set from the dashboard, so no environment variable is involved.
const STRIPE_API = 'https://api.stripe.com/v1'

export type StripeCheckoutSession = {
  id: string
  url: string | null
  status: string | null
  payment_status: string
  amount_total: number | null
  currency: string | null
  client_reference_id: string | null
  metadata: Record<string, string> | null
  payment_intent: null | string | { id: string; latest_charge?: null | string | { id: string; payment_method_details?: { card?: { brand?: string; last4?: string } } } }
}

export function stripeSecretKey(credentials: unknown) {
  const key = credentials && typeof credentials === 'object' && !Array.isArray(credentials) ? (credentials as Record<string, unknown>).secretKey : null
  return typeof key === 'string' && /^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/.test(key.trim()) ? key.trim() : null
}

function form(values: Record<string, string | number | undefined>) {
  const body = new URLSearchParams()
  for (const [name, value] of Object.entries(values)) if (value !== undefined) body.append(name, String(value))
  return body
}

async function stripeRequest<T>(secretKey: string, path: string, init: { method?: 'GET' | 'POST'; body?: URLSearchParams; idempotencyKey?: string } = {}): Promise<T> {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${secretKey}`,
      ...(init.body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      ...(init.idempotencyKey ? { 'idempotency-key': init.idempotencyKey } : {}),
    },
    body: init.body,
    signal: AbortSignal.timeout(20_000),
  })
  const payload = await response.json().catch(() => null) as any
  if (!response.ok) throw new Error(`Stripe request failed: ${payload?.error?.message ?? response.status}`)
  return payload as T
}

export function createStripeCheckoutSession(secretKey: string, input: {
  bookingId: string
  recordLocator: string
  description: string
  amount: number
  currencyCode: string
  customerEmail?: string | null
  successUrl: string
  cancelUrl: string
  idempotencyKey: string
}) {
  return stripeRequest<StripeCheckoutSession>(secretKey, '/checkout/sessions', {
    method: 'POST',
    idempotencyKey: input.idempotencyKey,
    body: form({
      mode: 'payment',
      client_reference_id: input.bookingId,
      'metadata[bookingId]': input.bookingId,
      'metadata[recordLocator]': input.recordLocator,
      'payment_intent_data[metadata][bookingId]': input.bookingId,
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': input.currencyCode.toLowerCase(),
      'line_items[0][price_data][unit_amount]': input.amount,
      'line_items[0][price_data][product_data][name]': input.description,
      customer_email: input.customerEmail || undefined,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    }),
  })
}

export function retrieveStripeCheckoutSession(secretKey: string, sessionId: string) {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) throw new Error('Checkout session is invalid.')
  return stripeRequest<StripeCheckoutSession>(secretKey, `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent.latest_charge`)
}

async function providerSecretKey(provider: PaymentProviderConfiguration) {
  // Loaded lazily: the adapter registry is imported by Keystone mutations, which the context itself imports.
  const { keystoneContext } = await import('../../keystone/context')
  const record = await (keystoneContext.prisma as any).paymentProvider.findUnique({ where: { providerKey: provider.providerKey }, select: { credentials: true } })
  const key = stripeSecretKey(record?.credentials)
  if (!key) throw new Error('Stripe secret key is not configured for this provider.')
  return key
}

export const stripeAdapter: PaymentAdapter = {
  async capture(_provider: PaymentProviderConfiguration, _input: CapturePaymentInput): Promise<CapturePaymentResult> {
    throw new Error('Stripe payments are captured at checkout.')
  },
  // The attempt key is the stored command identity, so a retried transaction repeats the same Stripe refund.
  async refund(provider: PaymentProviderConfiguration, input: RefundPaymentInput): Promise<RefundPaymentResult> {
    const refund = await stripeRequest<{ id: string; status: string }>(await providerSecretKey(provider), '/refunds', {
      method: 'POST',
      idempotencyKey: input.attemptKey,
      body: form({ payment_intent: input.paymentReference, amount: input.amount, 'metadata[reference]': input.refundReference }),
    })
    if (!['succeeded', 'pending'].includes(refund.status)) throw new Error(`Stripe refund ${refund.id} is ${refund.status}.`)
    return { providerRefundId: refund.id, providerData: { id: refund.id, status: refund.status } }
  },
}
