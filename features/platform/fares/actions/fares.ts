'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'

import { operatorCarrier, operatorGraphql } from '@/features/platform/network/lib/operator-graphql'
import { allowedTransition, DATE_PATTERN, dateToTimestamp, MAX_MINOR_AMOUNT, PRODUCT_TRANSITIONS, type ActionResult } from '@/features/platform/network/lib/desk-shared'
import { ANCILLARY_TYPES, CABIN_CLASSES, FULFILLMENT_TYPES, type AncillaryInput, type CabinInput, type FareBrandInput, type FareRuleInput } from '@/features/platform/fares/lib/types'

const FARES_PATH = '/dashboard/platform/fares'
const CODE_PATTERN = /^[A-Z0-9_-]{1,32}$/

type Checked<T> = { ok: true; value: T } | { ok: false; error: string }

function code(value: unknown, label: string): Checked<string> {
  const text = String(value ?? '').trim().toUpperCase()
  return CODE_PATTERN.test(text) ? { ok: true, value: text } : { ok: false, error: `${label} must be 1 to 32 letters, digits, dashes or underscores.` }
}

function text(value: unknown, label: string, { required = false, max = 200 } = {}): Checked<string> {
  const result = String(value ?? '').trim()
  if (required && !result) return { ok: false, error: `${label} is required.` }
  if (result.length > max) return { ok: false, error: `${label} must be at most ${max} characters.` }
  return { ok: true, value: result }
}

function whole(value: unknown, label: string, { max = MAX_MINOR_AMOUNT, optional = false } = {}): Checked<number | null> {
  if (optional && (value === null || value === undefined)) return { ok: true, value: null }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) return { ok: false, error: `${label} must be a whole number from 0 to ${max}.` }
  return { ok: true, value }
}

function firstError(...checks: Array<Checked<unknown>>): string | null {
  for (const check of checks) if (!check.ok) return check.error
  return null
}

async function done(response: { ok: true } | { ok: false; error: string }): Promise<ActionResult> {
  if (!response.ok) return response
  revalidatePath(FARES_PATH)
  return { ok: true }
}

async function setStatus(list: 'fareBrand' | 'fareRule' | 'ancillaryProduct', id: string, to: string): Promise<ActionResult> {
  const names = {
    fareBrand: { label: 'Fare brand', mutation: 'updateFareBrand', enumType: 'FareBrandStatusType' },
    fareRule: { label: 'Fare rule', mutation: 'updateFareRule', enumType: 'FareRuleStatusType' },
    ancillaryProduct: { label: 'Product', mutation: 'updateAncillaryProduct', enumType: 'AncillaryProductStatusType' },
  }[list]
  const current = await operatorGraphql<Record<string, { status: string | null } | null>>(`query CurrentStatus($id:ID!){ item: ${list}(where:{ id:$id }){ status } }`, { id })
  if (!current.ok) return current
  const from = current.data.item?.status ?? (current.data.item ? 'draft' : null)
  if (!from) return { ok: false, error: `${names.label} not found.` }
  if (!allowedTransition(PRODUCT_TRANSITIONS, from, to)) return { ok: false, error: `${names.label} cannot move from ${from} to ${to}.` }
  return done(await operatorGraphql(`mutation SetStatus($id:ID!,$status:${names.enumType}!){ ${names.mutation}(where:{ id:$id }, data:{ status:$status }){ id } }`, { id, status: to }))
}

// Cabins

function cabinData(input: CabinInput): Checked<Record<string, unknown>> {
  const cabinCode = code(input?.code, 'Code')
  const name = text(input?.name, 'Name', { required: true, max: 80 })
  const order = whole(input?.displayOrder, 'Display order', { max: 999 })
  const error = firstError(cabinCode, name, order)
  if (error) return { ok: false, error }
  if (!CABIN_CLASSES.some(option => option.value === input.cabinClass)) return { ok: false, error: 'Choose a cabin class.' }
  return { ok: true, value: { code: (cabinCode as { value: string }).value, name: (name as { value: string }).value, cabinClass: input.cabinClass, displayOrder: (order as { value: number }).value } }
}

async function duplicateCode(list: 'cabins' | 'fareBrands', value: string, exceptId?: string) {
  const response = await operatorGraphql<{ items: Array<{ id: string }> }>(
    `query DuplicateCode($code:String!){ items: ${list}(where:{ code:{ equals:$code } }, take: 2){ id } }`,
    { code: value },
  )
  return response.ok && response.data.items.some(item => item.id !== exceptId)
}

export async function createCabinAction(input: CabinInput): Promise<ActionResult> {
  const data = cabinData(input)
  if (!data.ok) return data
  const carrier = await operatorCarrier()
  if (!carrier.ok) return carrier
  if (await duplicateCode('cabins', data.value.code as string)) return { ok: false, error: 'A cabin with this code already exists.' }
  return done(await operatorGraphql('mutation CreateCabin($data:CabinCreateInput!){ createCabin(data:$data){ id } }', { data: { ...data.value, carrier: { connect: { id: carrier.data.id } } } }))
}

export async function updateCabinAction(id: string, input: CabinInput): Promise<ActionResult> {
  const data = cabinData(input)
  if (!data.ok) return data
  if (await duplicateCode('cabins', data.value.code as string, id)) return { ok: false, error: 'A cabin with this code already exists.' }
  return done(await operatorGraphql('mutation UpdateCabin($id:ID!,$data:CabinUpdateInput!){ updateCabin(where:{ id:$id }, data:$data){ id } }', { id, data: data.value }))
}

// Fare brands

function brandData(input: FareBrandInput): Checked<Record<string, unknown>> {
  const brandCode = code(input?.code, 'Code')
  const name = text(input?.name, 'Name', { required: true, max: 80 })
  const description = text(input?.description, 'Description', { max: 1000 })
  const order = whole(input?.displayOrder, 'Display order', { max: 999 })
  const pieces = whole(input?.baggagePieces, 'Included bags', { max: 10 })
  const weight = whole(input?.baggageMaxWeightGrams, 'Bag weight', { max: 100_000 })
  const error = firstError(brandCode, name, description, order, pieces, weight)
  if (error) return { ok: false, error }
  if (!input.cabinId) return { ok: false, error: 'Choose a cabin.' }
  return {
    ok: true,
    value: {
      code: (brandCode as { value: string }).value,
      name: (name as { value: string }).value,
      description: (description as { value: string }).value,
      displayOrder: (order as { value: number }).value,
      includedBaggage: { pieces: input.baggagePieces, maxWeightGrams: input.baggageMaxWeightGrams },
    },
  }
}

export async function createFareBrandAction(input: FareBrandInput): Promise<ActionResult> {
  const data = brandData(input)
  if (!data.ok) return data
  const carrier = await operatorCarrier()
  if (!carrier.ok) return carrier
  if (await duplicateCode('fareBrands', data.value.code as string)) return { ok: false, error: 'A fare brand with this code already exists.' }
  return done(await operatorGraphql('mutation CreateFareBrand($data:FareBrandCreateInput!){ createFareBrand(data:$data){ id } }', {
    data: { ...data.value, status: 'draft', carrier: { connect: { id: carrier.data.id } }, cabin: { connect: { id: input.cabinId } } },
  }))
}

export async function updateFareBrandAction(id: string, input: FareBrandInput): Promise<ActionResult> {
  const data = brandData(input)
  if (!data.ok) return data
  if (await duplicateCode('fareBrands', data.value.code as string, id)) return { ok: false, error: 'A fare brand with this code already exists.' }
  return done(await operatorGraphql('mutation UpdateFareBrand($id:ID!,$data:FareBrandUpdateInput!){ updateFareBrand(where:{ id:$id }, data:$data){ id } }', {
    id,
    data: { ...data.value, cabin: { connect: { id: input.cabinId } } },
  }))
}

export async function setFareBrandStatusAction(id: string, to: string): Promise<ActionResult> {
  return setStatus('fareBrand', id, to)
}

// Fare rules

function ruleData(input: FareRuleInput): Checked<Record<string, unknown>> {
  const basis = text(input?.fareBasisPattern, 'Fare basis pattern', { max: 32 })
  const change = whole(input?.changeFeeAmount, 'Change fee')
  const cancel = whole(input?.cancellationFeeAmount, 'Cancellation fee')
  const noShow = whole(input?.noShowFeeAmount, 'No-show fee')
  const advance = whole(input?.minimumAdvancePurchaseHours, 'Advance purchase', { max: 8_760, optional: true })
  const minStay = whole(input?.minimumStayDays, 'Minimum stay', { max: 365, optional: true })
  const maxStay = whole(input?.maximumStayDays, 'Maximum stay', { max: 365, optional: true })
  const error = firstError(basis, change, cancel, noShow, advance, minStay, maxStay)
  if (error) return { ok: false, error }
  if (!input.fareBrandId) return { ok: false, error: 'Choose a fare brand.' }
  if (input.minimumStayDays != null && input.maximumStayDays != null && input.maximumStayDays < input.minimumStayDays) return { ok: false, error: 'Maximum stay must be at least the minimum stay.' }
  const from = String(input.effectiveFrom ?? '')
  const to = String(input.effectiveTo ?? '')
  if ((from && !DATE_PATTERN.test(from)) || (to && !DATE_PATTERN.test(to))) return { ok: false, error: 'Effective dates must be dates.' }
  if (from && to && to < from) return { ok: false, error: 'Effective to must be on or after effective from.' }
  const pattern = (basis as { value: string }).value.toUpperCase()
  if (pattern && !/^[A-Z0-9*?]+$/.test(pattern)) return { ok: false, error: 'Fare basis pattern may use letters, digits, * and ?.' }
  return {
    ok: true,
    value: {
      fareBasisPattern: pattern,
      isRefundable: Boolean(input.isRefundable),
      isChangeable: Boolean(input.isChangeable),
      changeFeeAmount: input.changeFeeAmount,
      cancellationFeeAmount: input.cancellationFeeAmount,
      noShowFeeAmount: input.noShowFeeAmount,
      minimumAdvancePurchaseHours: input.minimumAdvancePurchaseHours,
      minimumStayDays: input.minimumStayDays,
      maximumStayDays: input.maximumStayDays,
      effectiveFrom: dateToTimestamp(from),
      effectiveTo: dateToTimestamp(to),
    },
  }
}

export async function createFareRuleAction(input: FareRuleInput): Promise<ActionResult> {
  const data = ruleData(input)
  if (!data.ok) return data
  const carrier = await operatorCarrier()
  if (!carrier.ok) return carrier
  const brand = await operatorGraphql<{ fareBrand: { code: string } | null }>('query RuleBrand($id:ID!){ fareBrand(where:{ id:$id }){ code } }', { id: input.fareBrandId })
  if (!brand.ok) return brand
  if (!brand.data.fareBrand) return { ok: false, error: 'Choose a fare brand.' }
  const ruleKey = `${carrier.data.code}:${brand.data.fareBrand.code}:${randomUUID().slice(0, 8).toUpperCase()}`
  return done(await operatorGraphql('mutation CreateFareRule($data:FareRuleCreateInput!){ createFareRule(data:$data){ id } }', {
    data: {
      ...data.value,
      ruleKey,
      status: 'draft',
      currencyCode: carrier.data.defaultCurrencyCode || 'USD',
      carrier: { connect: { id: carrier.data.id } },
      fareBrand: { connect: { id: input.fareBrandId } },
      ...(input.routeId ? { route: { connect: { id: input.routeId } } } : {}),
    },
  }))
}

export async function updateFareRuleAction(id: string, input: FareRuleInput): Promise<ActionResult> {
  const data = ruleData(input)
  if (!data.ok) return data
  const current = await operatorGraphql<{ fareRule: { route: { id: string } | null } | null }>('query RuleRoute($id:ID!){ fareRule(where:{ id:$id }){ route { id } } }', { id })
  if (!current.ok) return current
  if (!current.data.fareRule) return { ok: false, error: 'Fare rule not found.' }
  const currentRouteId = current.data.fareRule.route?.id ?? ''
  const route = currentRouteId === input.routeId ? {} : { route: input.routeId ? { connect: { id: input.routeId } } : { disconnect: true } }
  return done(await operatorGraphql('mutation UpdateFareRule($id:ID!,$data:FareRuleUpdateInput!){ updateFareRule(where:{ id:$id }, data:$data){ id } }', {
    id,
    data: { ...data.value, ...route, fareBrand: { connect: { id: input.fareBrandId } } },
  }))
}

export async function setFareRuleStatusAction(id: string, to: string): Promise<ActionResult> {
  return setStatus('fareRule', id, to)
}

// Ancillary products

function ancillaryData(input: AncillaryInput): Checked<Record<string, unknown>> {
  const productCode = code(input?.code, 'Code')
  const name = text(input?.name, 'Name', { required: true, max: 120 })
  const description = text(input?.description, 'Description', { max: 1000 })
  const price = whole(input?.defaultPriceAmount, 'Price')
  const tax = whole(input?.taxAmount, 'Tax')
  const error = firstError(productCode, name, description, price, tax)
  if (error) return { ok: false, error }
  if (!ANCILLARY_TYPES.some(option => option.value === input.type)) return { ok: false, error: 'Choose a product type.' }
  if (!FULFILLMENT_TYPES.some(option => option.value === input.fulfillmentType)) return { ok: false, error: 'Choose a fulfillment type.' }
  return {
    ok: true,
    value: {
      code: (productCode as { value: string }).value,
      name: (name as { value: string }).value,
      description: (description as { value: string }).value,
      type: input.type,
      fulfillmentType: input.fulfillmentType,
      defaultPriceAmount: input.defaultPriceAmount,
      taxAmount: input.taxAmount,
      requiresInventory: Boolean(input.requiresInventory),
    },
  }
}

export async function createAncillaryAction(input: AncillaryInput): Promise<ActionResult> {
  const data = ancillaryData(input)
  if (!data.ok) return data
  const carrier = await operatorCarrier()
  if (!carrier.ok) return carrier
  return done(await operatorGraphql('mutation CreateAncillaryProduct($data:AncillaryProductCreateInput!){ createAncillaryProduct(data:$data){ id } }', {
    data: {
      ...data.value,
      productKey: `${carrier.data.code}:${data.value.code}`,
      status: 'draft',
      currencyCode: carrier.data.defaultCurrencyCode || 'USD',
      carrier: { connect: { id: carrier.data.id } },
    },
  }))
}

export async function updateAncillaryAction(id: string, input: AncillaryInput): Promise<ActionResult> {
  const data = ancillaryData(input)
  if (!data.ok) return data
  return done(await operatorGraphql('mutation UpdateAncillaryProduct($id:ID!,$data:AncillaryProductUpdateInput!){ updateAncillaryProduct(where:{ id:$id }, data:$data){ id } }', { id, data: data.value }))
}

export async function setAncillaryStatusAction(id: string, to: string): Promise<ActionResult> {
  return setStatus('ancillaryProduct', id, to)
}
