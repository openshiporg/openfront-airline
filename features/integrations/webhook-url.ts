import { lookup } from 'node:dns/promises'
import net from 'node:net'

// Shared by the delivery worker and the WebhookEndpoint model, so a URL is rejected when it is saved, not only at dispatch.
export function assertExternalWebhookUrl(url: URL, env: NodeJS.ProcessEnv = process.env) {
  if (url.username || url.password || url.hash) throw new Error('Webhook endpoints cannot contain credentials or fragments.')
  if (env.NODE_ENV !== 'production') return
  if (url.protocol !== 'https:') throw new Error('Production webhook endpoints must use HTTPS.')
  // Admission is the exact origin authority: a non-default port must be allowlisted as host:port.
  const allowedHosts = new Set(String(env.OUTBOUND_WEBHOOK_HOSTS ?? '').split(',').map(host => host.trim().toLowerCase()).filter(Boolean))
  if (!allowedHosts.has(url.host.toLowerCase())) throw new Error('Production webhook endpoint host is not explicitly allowlisted.')
}

/** True for loopback, private, link-local, carrier-grade NAT, unique-local, multicast and unspecified addresses. */
export function isNonPublicAddress(address: string) {
  const version = net.isIP(address)
  if (version === 4) {
    const [a, b] = address.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  if (version === 6) {
    const normalized = address.toLowerCase()
    if (normalized.startsWith('::ffff:')) return isNonPublicAddress(normalized.slice(7))
    return normalized === '::' || normalized === '::1' || /^f[cd]/.test(normalized) || /^fe[89ab]/.test(normalized) || normalized.startsWith('ff')
  }
  return true
}

/** In production every resolved address of an admitted host must be public, so DNS cannot point a delivery inward. */
export async function assertPublicWebhookDestination(url: URL, env: NodeJS.ProcessEnv = process.env, resolve = lookup) {
  if (env.NODE_ENV !== 'production') return
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = net.isIP(host) ? [{ address: host }] : await resolve(host, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(entry => isNonPublicAddress(entry.address))) throw new Error('Production webhook endpoint resolves to a non-public address.')
}
