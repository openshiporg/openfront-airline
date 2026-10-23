import 'server-only'

import { headers } from 'next/headers'

// Absolute origin of the current request, for robots.txt and sitemap.xml links.
export async function publicOrigin() {
  const list = await headers()
  const host = list.get('x-forwarded-host') || list.get('host') || 'localhost'
  const protocol = list.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')
  return `${protocol.split(',')[0].trim()}://${host.split(',')[0].trim()}`
}
