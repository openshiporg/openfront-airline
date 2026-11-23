import 'server-only'

import type { Metadata } from 'next'
import { connection } from 'next/server'

import { getStorefrontCarrierIdentityDirect } from '@/features/storefront/lib/carrier-direct'

// Staff tab titles read "<Page> · <Carrier>", the same as the storefront, so a desk agent with several tabs can tell them apart.
export async function staffTitle(page: string): Promise<Metadata> {
  await connection()
  const carrier = await getStorefrontCarrierIdentityDirect().catch(() => null)
  return { title: carrier?.name ? `${page} · ${carrier.name}` : page }
}

// "/platform/flight-ops" → "Flight ops" fallback when a route has no nav title; "payment-providers" → "Payment providers".
export function titleFromSlug(slug: string) {
  const words = slug.replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim().toLowerCase()
  return words ? words[0].toUpperCase() + words.slice(1) : 'Dashboard'
}
