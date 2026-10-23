import type { MetadataRoute } from 'next'

import { publicNavigation } from '@/features/storefront/lib/public-navigation'
import { publicOrigin } from '@/features/storefront/lib/public-origin'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await publicOrigin()
  return publicNavigation.map(item => ({
    url: `${origin}${item.href === '/' ? '' : item.href}`,
    changeFrequency: item.href === '/' || item.href === '/status' ? 'daily' : 'monthly',
    priority: item.href === '/' ? 1 : 0.6,
  }))
}
