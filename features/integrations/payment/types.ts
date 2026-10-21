export type PaymentProviderConfiguration = {
  adapterType: string
  providerKey: string
  configuration?: Record<string, unknown> | null
}

// attemptKey is the carrier/provider/operation-bound idempotency identity of the command that asked for this money
// movement (its stored idempotency key). Adapters echo it, and an external executor must use it as the provider's
// idempotency key. Adapters are called inside a retried serializable transaction, which is only safe for the local
// evidence-only manual adapter: before any external executor is admitted, the call must move to a durable claim ->
// external call outside the DB retry -> fenced finalization, with an ambiguous outcome retained for reconciliation.
export type CapturePaymentInput = {
  attemptKey: string
  amount: number
  currencyCode: string
  providerReference: string
  instrumentBrand?: string | null
  instrumentLast4?: string | null
}

export type CapturePaymentResult = {
  providerPaymentId: string
  providerCaptureId: string
  instrumentBrand?: string
  instrumentLast4?: string
  providerData: Record<string, unknown>
}

export type RefundPaymentInput = {
  attemptKey: string
  amount: number
  currencyCode: string
  paymentReference: string
  refundReference: string
}

export type RefundPaymentResult = {
  providerRefundId: string
  providerData: Record<string, unknown>
}

export interface PaymentAdapter {
  capture(provider: PaymentProviderConfiguration, input: CapturePaymentInput): Promise<CapturePaymentResult>
  refund(provider: PaymentProviderConfiguration, input: RefundPaymentInput): Promise<RefundPaymentResult>
}
