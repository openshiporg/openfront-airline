import { publicOrigin } from '@/features/storefront/lib/public-origin'

export const dynamic = 'force-dynamic'

// Served under /api (which the shared proxy never redirects) and reached from /robots.txt by a next.config
// redirect, so crawlers get it even while first-run setup sends every page to /dashboard/init.
export async function GET() {
  const origin = await publicOrigin()
  const body = ['User-agent: *', 'Allow: /', 'Allow: /api/sitemap.xml', 'Disallow: /dashboard', 'Disallow: /api', '', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n')
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } })
}
