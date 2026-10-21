import type { Metadata } from 'next'

export type CarrierBrand = {
  name: string
  legalName: string
  code: string
  storefrontConfigured?: boolean
  storefrontHomepageTitle?: string | null
  storefrontHomepageDescription?: string | null
}

export function carrierMetadata(carrier: CarrierBrand | null): Metadata {
  if (!carrier || carrier.storefrontConfigured === false) return {
    title: 'Storefront not configured',
    description: 'This carrier storefront has not been configured by an authorized operator.',
  }
  return {
    title: { default: carrier.name, template: `%s · ${carrier.name}` },
    description: carrier.storefrontHomepageDescription || `${carrier.name} passenger services.`,
  }
}

export function carrierCalendarDate(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value)
  const part = (type: 'year' | 'month' | 'day') => parts.find(entry => entry.type === type)?.value ?? ''
  const result = `${part('year')}-${part('month')}-${part('day')}`
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error('Carrier calendar date is unavailable.')
  return result
}

export function operatorCarrierMetadata(carrier: Pick<CarrierBrand, 'name'> | null): Metadata {
  return {
    title: carrier?.name ? `${carrier.name} operations` : 'Carrier operations',
    description: carrier?.name ? `${carrier.name} commercial and passenger-service workspace.` : 'Carrier operations workspace.',
  }
}
