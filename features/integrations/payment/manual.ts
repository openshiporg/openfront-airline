import type { PaymentAdapter } from './types'

function requiredReference(value: string, label: string) {
  const normalized = value?.trim()
  if (!normalized || normalized.length < 6 || normalized.length > 200) {
    throw new Error(`${label} must be a 6-to-200 character reference from the settlement system.`)
  }
  return normalized
}

function requiredAttemptKey(value: string) {
  const normalized = value?.trim()
  if (!normalized || normalized.length > 300) throw new Error('A payment attempt identity is required.')
  return normalized
}

export const manualReconciliationAdapter: PaymentAdapter = {
  async capture(_provider, input) {
    const attemptKey = requiredAttemptKey(input.attemptKey)
    const reference = requiredReference(input.providerReference, 'Payment reference')
    if (input.instrumentLast4 && !/^\d{4}$/.test(input.instrumentLast4)) {
      throw new Error('Instrument last four must contain exactly four digits.')
    }
    return {
      providerPaymentId: reference,
      providerCaptureId: reference,
      ...(input.instrumentBrand?.trim() ? { instrumentBrand: input.instrumentBrand.trim().slice(0, 40) } : {}),
      ...(input.instrumentLast4 ? { instrumentLast4: input.instrumentLast4 } : {}),
      providerData: { settlementMode: 'manual_reconciliation', attemptKey },
    }
  },
  async refund(_provider, input) {
    const attemptKey = requiredAttemptKey(input.attemptKey)
    requiredReference(input.paymentReference, 'Payment reference')
    const refundReference = requiredReference(input.refundReference, 'Refund reference')
    return {
      providerRefundId: refundReference,
      providerData: { settlementMode: 'manual_reconciliation', attemptKey },
    }
  },
}
