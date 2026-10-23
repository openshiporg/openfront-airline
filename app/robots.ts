import type { MetadataRoute } from 'next'

import { publicOrigin } from '@/features/storefront/lib/public-origin'

export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await publicOrigin()
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard', '/api'] }],
    sitemap: `${origin}/sitemap.xml`,
  }
}
