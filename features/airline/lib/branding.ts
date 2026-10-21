export const STOREFRONT_BRAND_COLORS = [
  { value: 'slate', label: 'Slate', hex: '#334155', hover: '#1e293b', soft: '#f1f5f9' },
  { value: 'blue', label: 'Blue', hex: '#1d4ed8', hover: '#1e40af', soft: '#eff6ff' },
  { value: 'indigo', label: 'Indigo', hex: '#4338ca', hover: '#3730a3', soft: '#eef2ff' },
  { value: 'violet', label: 'Violet', hex: '#6d28d9', hover: '#5b21b6', soft: '#f5f3ff' },
  { value: 'rose', label: 'Rose', hex: '#be123c', hover: '#9f1239', soft: '#fff1f2' },
  { value: 'emerald', label: 'Emerald', hex: '#047857', hover: '#065f46', soft: '#ecfdf5' },
  { value: 'amber', label: 'Amber', hex: '#92400e', hover: '#78350f', soft: '#fffbeb' },
] as const

export type StorefrontBrandColor = (typeof STOREFRONT_BRAND_COLORS)[number]['value']

export function normalizeStorefrontBrandColor(value: unknown): StorefrontBrandColor | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return STOREFRONT_BRAND_COLORS.some(option => option.value === normalized)
    ? normalized as StorefrontBrandColor
    : null
}

export function storefrontBrandPalette(value: unknown) {
  const normalized = normalizeStorefrontBrandColor(value)
  return STOREFRONT_BRAND_COLORS.find(option => option.value === normalized) ?? null
}

export function hasConfiguredStorefrontBrand(settings: {
  storefrontBrandColor?: unknown
  storefrontHomepageTitle?: unknown
  storefrontHomepageDescription?: unknown
} | null | undefined) {
  return Boolean(
    storefrontBrandPalette(settings?.storefrontBrandColor)
    && typeof settings?.storefrontHomepageTitle === 'string'
    && settings.storefrontHomepageTitle.trim()
    && typeof settings?.storefrontHomepageDescription === 'string'
    && settings.storefrontHomepageDescription.trim(),
  )
}
