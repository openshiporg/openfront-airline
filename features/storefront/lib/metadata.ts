import 'server-only'

import type { Metadata } from 'next'

import { carrierMetadata } from './branding'
import { getStorefrontCarrierIdentity, type PublicCarrierIdentity } from './carrier'

// Storefront tab titles. A failed carrier lookup falls back to the neutral metadata instead of failing the page head.
export async function storefrontPageMetadata(pageTitle?: string): Promise<Metadata> {
  let carrier: PublicCarrierIdentity | null
  try {
    carrier = await getStorefrontCarrierIdentity()
  } catch {
    return carrierMetadata(null)
  }
  const metadata = carrierMetadata(carrier)
  // Servicing pages render for an identified carrier even before its marketing branding is complete.
  if (!carrier || (!carrier.storefrontConfigured && !pageTitle)) return metadata
  return { ...metadata, title: pageTitle ? `${pageTitle} · ${carrier.name}` : carrier.name }
}
