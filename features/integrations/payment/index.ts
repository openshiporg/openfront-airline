import { manualReconciliationAdapter } from './manual'
import { stripeAdapter } from './stripe'
import type { PaymentAdapter, PaymentProviderConfiguration } from './types'

const adapters: Record<string, PaymentAdapter> = {
  manual: manualReconciliationAdapter,
  stripe: stripeAdapter,
}

export function getPaymentAdapter(provider: PaymentProviderConfiguration) {
  const adapter = adapters[provider.adapterType]
  if (!adapter) {
    throw new Error(`Payment adapter "${provider.adapterType}" is not installed.`)
  }
  return adapter
}

export type { CapturePaymentInput, CapturePaymentResult, PaymentAdapter, RefundPaymentInput, RefundPaymentResult } from './types'
