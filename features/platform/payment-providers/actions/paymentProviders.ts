'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

type ActionResult = { ok: true } | { ok: false; error: string }

const PROVIDERS_PATH = '/dashboard/platform/payment-providers'

// The only configuration bounded-payment-policy accepts for an active provider.
function evidenceOnlyConfiguration() {
  return { providerExecution: false, requiresIndependentApproval: true }
}

export async function createManualPaymentProvider(input: { name: string; code: string }): Promise<ActionResult> {
  const name = String(input.name ?? '').trim()
  const code = String(input.code ?? '').trim().toLowerCase()
  if (!name) return { ok: false, error: 'Name is required.' }
  if (name.length > 120) return { ok: false, error: 'Name is too long.' }
  if (!/^[a-z0-9][a-z0-9_-]{1,31}$/.test(code)) return { ok: false, error: 'Code must be 2 to 32 letters, digits, hyphens or underscores.' }

  const identity = await keystoneClient<{ authenticatedItem: { carrier: { id: string; code: string | null } | null } | null }>(
    `query PaymentProviderCarrier { authenticatedItem { ... on User { carrier { id code } } } }`,
  )
  if (!identity.success) return { ok: false, error: identity.error }
  const carrier = identity.data.authenticatedItem?.carrier
  if (!carrier?.id || !carrier.code) return { ok: false, error: 'Your account is not linked to a carrier.' }

  const providerKey = `${carrier.code}:manual:${code}`.toLowerCase()
  const existing = await keystoneClient<{ paymentProvidersCount: number | null }>(
    `query PaymentProviderKeyTaken($key: String!) { paymentProvidersCount(where: { providerKey: { equals: $key } }) }`,
    { key: providerKey },
  )
  if (!existing.success) return { ok: false, error: existing.error }
  if ((existing.data.paymentProvidersCount ?? 0) > 0) return { ok: false, error: `A provider with code ${code} already exists.` }

  const response = await keystoneClient<{ createPaymentProvider: { id: string } | null }>(
    `mutation CreateManualPaymentProvider($data: PaymentProviderCreateInput!) { createPaymentProvider(data: $data) { id } }`,
    {
      data: {
        carrier: { connect: { id: carrier.id } },
        providerKey,
        name,
        code,
        adapterType: 'manual',
        status: 'inactive',
        configuration: evidenceOnlyConfiguration(),
      },
    },
  )
  if (!response.success) return { ok: false, error: response.error }
  if (!response.data.createPaymentProvider) return { ok: false, error: 'Provider could not be created.' }
  revalidatePath(PROVIDERS_PATH)
  return { ok: true }
}

export async function setPaymentProviderStatus(id: string, status: 'active' | 'inactive' | 'disabled'): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'Provider not found.' }
  if (!['active', 'inactive', 'disabled'].includes(status)) return { ok: false, error: 'Unsupported status.' }

  const current = await keystoneClient<{ paymentProvider: { id: string; status: string | null; adapterType: string | null } | null }>(
    `query PaymentProviderStatus($id: ID!) { paymentProvider(where: { id: $id }) { id status adapterType } }`,
    { id },
  )
  if (!current.success) return { ok: false, error: current.error }
  const provider = current.data.paymentProvider
  if (!provider) return { ok: false, error: 'Provider not found.' }
  if (provider.status === status) return { ok: true }
  if (status === 'active' && provider.adapterType !== 'manual') return { ok: false, error: 'Only manual settlement providers can be activated.' }

  const data: Record<string, unknown> = { status }
  // Activation pins the evidence-only configuration the policy requires; the operator never edits it.
  if (status === 'active') data.configuration = evidenceOnlyConfiguration()

  const response = await keystoneClient<{ updatePaymentProvider: { id: string } | null }>(
    `mutation SetPaymentProviderStatus($id: ID!, $data: PaymentProviderUpdateInput!) { updatePaymentProvider(where: { id: $id }, data: $data) { id } }`,
    { id, data },
  )
  if (!response.success) return { ok: false, error: response.error }
  if (!response.data.updatePaymentProvider) return { ok: false, error: 'Provider not found.' }
  revalidatePath(PROVIDERS_PATH)
  return { ok: true }
}
