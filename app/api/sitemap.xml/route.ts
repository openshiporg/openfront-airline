import { publicNavigation } from '@/features/storefront/lib/public-navigation'
import { publicOrigin } from '@/features/storefront/lib/public-origin'

export const dynamic = 'force-dynamic'

// Reached from /sitemap.xml by a next.config redirect; see app/api/robots.txt/route.ts.
export async function GET() {
  const origin = await publicOrigin()
  const urls = publicNavigation.map(item => {
    const priority = item.href === '/' ? '1.0' : '0.6'
    const frequency = item.href === '/' || item.href === '/status' ? 'daily' : 'monthly'
    return `  <url><loc>${origin}${item.href === '/' ? '/' : item.href}</loc><changefreq>${frequency}</changefreq><priority>${priority}</priority></url>`
  })
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } })
}
