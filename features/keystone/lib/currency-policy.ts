import onboardingContract from '../../platform/onboarding/seed.json'
import { DomainError } from './domain-error'

// The launch admits only the contract's two-decimal currencies, so every amount stored in minor units is hundredths.
// Carrier changes, provisioning, settlement import and bootstrap share this one check (not a three-letter regex).
export const ONBOARDING_CURRENCIES: readonly string[] = onboardingContract.supportedCurrencies

export function supportedCurrencyCode(value: unknown) {
  const currency = String(value ?? '').trim().toUpperCase()
  if (!ONBOARDING_CURRENCIES.includes(currency)) throw new DomainError(`Currency must be one of ${ONBOARDING_CURRENCIES.join(', ')}.`)
  return currency
}
