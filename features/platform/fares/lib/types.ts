// Row and form shapes for the fares and products desk.

export const CABIN_CLASSES = [
  { value: 'economy', label: 'Economy' },
  { value: 'premium_economy', label: 'Premium economy' },
  { value: 'business', label: 'Business' },
  { value: 'first', label: 'First' },
] as const

export const ANCILLARY_TYPES = [
  { value: 'seat', label: 'Seat' },
  { value: 'checked_bag', label: 'Checked bag' },
  { value: 'cabin_bag', label: 'Cabin bag' },
  { value: 'priority', label: 'Priority' },
  { value: 'lounge', label: 'Lounge' },
  { value: 'meal', label: 'Meal' },
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'assistance', label: 'Assistance' },
  { value: 'other', label: 'Other' },
] as const

export const FULFILLMENT_TYPES = [
  { value: 'associated', label: 'Associated to flight' },
  { value: 'standalone', label: 'Standalone' },
] as const

export type CabinRow = { id: string; code: string; name: string; cabinClass: string | null; displayOrder: number | null; fareBrandsCount: number | null }

export type CabinOption = { id: string; code: string; name: string }

export type FareBrandRow = {
  id: string
  code: string
  name: string
  description: string | null
  status: string
  displayOrder: number | null
  includedBaggage: unknown
  cabin: CabinOption | null
  rulesCount: number | null
}

export type FareBrandOption = { id: string; code: string; name: string; status: string }

export type FareRouteOption = { id: string; routeKey: string; status: string; origin: { iataCode: string } | null; destination: { iataCode: string } | null }

export type FareRuleRow = {
  id: string
  ruleKey: string
  fareBasisPattern: string | null
  status: string
  isRefundable: boolean
  isChangeable: boolean
  changeFeeAmount: number | null
  cancellationFeeAmount: number | null
  noShowFeeAmount: number | null
  currencyCode: string
  minimumAdvancePurchaseHours: number | null
  minimumStayDays: number | null
  maximumStayDays: number | null
  effectiveFrom: string | null
  effectiveTo: string | null
  fareBrand: FareBrandOption | null
  route: FareRouteOption | null
}

export type AncillaryRow = {
  id: string
  productKey: string
  code: string
  name: string
  description: string | null
  type: string
  status: string
  fulfillmentType: string | null
  defaultPriceAmount: number | null
  taxAmount: number | null
  currencyCode: string
  requiresInventory: boolean
}

export type CabinInput = { code: string; name: string; cabinClass: string; displayOrder: number }

export type FareBrandInput = {
  code: string
  name: string
  description: string
  cabinId: string
  displayOrder: number
  baggagePieces: number
  baggageMaxWeightGrams: number
}

export type FareRuleInput = {
  fareBrandId: string
  routeId: string
  fareBasisPattern: string
  isRefundable: boolean
  isChangeable: boolean
  changeFeeAmount: number
  cancellationFeeAmount: number
  noShowFeeAmount: number
  minimumAdvancePurchaseHours: number | null
  minimumStayDays: number | null
  maximumStayDays: number | null
  effectiveFrom: string
  effectiveTo: string
}

export type AncillaryInput = {
  code: string
  name: string
  description: string
  type: string
  fulfillmentType: string
  defaultPriceAmount: number
  taxAmount: number
  requiresInventory: boolean
}

export function baggageOf(value: unknown): { pieces: number; maxWeightGrams: number } {
  const policy = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const pieces = Number.isInteger(policy.pieces) ? policy.pieces as number : 0
  const maxWeightGrams = Number.isInteger(policy.maxWeightGrams) ? policy.maxWeightGrams as number : 0
  return { pieces, maxWeightGrams }
}
