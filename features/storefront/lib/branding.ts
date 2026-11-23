import type { Metadata } from 'next'

export type CarrierBrand = {
  name: string
  legalName: string
  code: string
  storefrontConfigured?: boolean
  storefrontHomepageTitle?: string | null
  storefrontHomepageDescription?: string | null
}

// The storefront's tab icon is the carrier's wing; the root layout's icon belongs to the staff dashboard.
const STOREFRONT_ICONS: Metadata['icons'] = { icon: [{ url: '/storefront/wing.svg', type: 'image/svg+xml' }] }

export function carrierMetadata(carrier: CarrierBrand | null): Metadata {
  if (!carrier || carrier.storefrontConfigured === false) return {
    title: 'Storefront not configured',
    description: 'This carrier storefront has not been configured by an authorized operator.',
    icons: STOREFRONT_ICONS,
  }
  return {
    title: { default: carrier.name, template: `%s · ${carrier.name}` },
    description: carrier.storefrontHomepageDescription || `${carrier.name} passenger services.`,
    icons: STOREFRONT_ICONS,
  }
}

// Numbers as words in storefront copy ("Four Iconic Cities", "one checked bag").
export const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'] as const
export function countWord(value: number) {
  return COUNT_WORDS[value] ?? String(value)
}

// "The Avante Experience": the name of the home section and of the header link that opens it.
export function experienceTitle(carrierName: string) {
  return `The ${carrierName.split(' ')[0]} Experience`
}

// The carrier's calendar date `days` from now: the default search date on the storefront pages.
export function carrierDateFromToday(days: number, timezone: string) {
  return carrierCalendarDate(new Date(Date.now() + days * 86_400_000), timezone)
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
