export type PaymentProviderLaunchPolicyInput = {
  adapterType: string | null
  configuration: unknown
}

/**
 * The bounded launch can record only independently approved evidence from an
 * external settlement ledger. This describes configuration, not provider or
 * settlement success.
 */
export function isEvidenceOnlyManualProvider(provider: PaymentProviderLaunchPolicyInput) {
  if (provider.adapterType !== 'manual') return false
  if (!provider.configuration || typeof provider.configuration !== 'object' || Array.isArray(provider.configuration)) return false
  const configuration = provider.configuration as Record<string, unknown>
  return configuration.providerExecution === false && configuration.requiresIndependentApproval === true
}
