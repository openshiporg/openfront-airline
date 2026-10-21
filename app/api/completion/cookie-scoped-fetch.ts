type FetchImplementation = typeof fetch

function parseCookieHeader(header: string) {
  const jar = new Map<string, string>()
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator <= 0) continue
    const name = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (name) jar.set(name, value)
  }
  return jar
}

function requestUrl(input: RequestInfo | URL, base: URL) {
  if (input instanceof Request) return new URL(input.url)
  if (input instanceof URL) return input
  return new URL(input, base)
}

function isExactMcpRequest(candidate: URL, endpoint: URL) {
  return candidate.origin === endpoint.origin && candidate.pathname === endpoint.pathname
}

function updateCookieJar(jar: Map<string, string>, setCookie: string) {
  const [pair, ...attributes] = setCookie.split(';')
  const separator = pair.indexOf('=')
  if (separator <= 0) return
  const name = pair.slice(0, separator).trim()
  const value = pair.slice(separator + 1).trim()
  const deleted = !value || attributes.some(attribute => /^\s*max-age\s*=\s*0\s*$/i.test(attribute))
  if (deleted) jar.delete(name)
  else jar.set(name, value)
}

/**
 * Creates a request-local fetch for one MCP transport. Incoming cookies are
 * attached only to the configured origin + MCP pathname. No process-global
 * state is changed, so concurrent completion requests cannot exchange auth.
 */
export function createSameOriginMcpFetch(
  endpoint: URL,
  initialCookieHeader: string,
  baseFetch: FetchImplementation = fetch,
): FetchImplementation {
  const allowedEndpoint = new URL(endpoint.href)
  const cookieJar = parseCookieHeader(initialCookieHeader)

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input, allowedEndpoint)
    const allowed = isExactMcpRequest(url, allowedEndpoint)
    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value))

    if (allowed && cookieJar.size > 0) {
      headers.set('cookie', [...cookieJar].map(([name, value]) => `${name}=${value}`).join('; '))
    } else {
      headers.delete('cookie')
    }

    // Do not let the runtime automatically replay an authenticated MCP request
    // to a redirect target. The transport treats a redirect as a failed request.
    const response = await baseFetch(input, { ...init, headers, redirect: 'manual' })
    if (allowed) {
      const responseHeaders = response.headers as Headers & { getSetCookie?: () => string[] }
      const setCookies = responseHeaders.getSetCookie?.() ?? []
      if (setCookies.length > 0) {
        for (const setCookie of setCookies) updateCookieJar(cookieJar, setCookie)
      } else {
        const setCookie = response.headers.get('set-cookie')
        if (setCookie) updateCookieJar(cookieJar, setCookie)
      }
    }
    return response
  }) as FetchImplementation
}
