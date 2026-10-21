type Params = Record<string, string | string[] | undefined>

export function worklistSearch(params: Params, statuses: readonly string[] = []) {
  const q = typeof params.q === 'string' ? params.q.trim().slice(0,120) : ''
  const status = typeof params.status === 'string' && statuses.includes(params.status) ? params.status : ''
  return { q, status }
}

/** Preserve only the search controls owned by the current desk. A new form submission omits every cursor. */
export function withWorklistSearch(href: string, filters: { q: string; status: string }) {
  const [path, query] = href.split('?')
  const params = new URLSearchParams(query)
  if (filters.q) params.set('q', filters.q)
  if (filters.status) params.set('status', filters.status)
  return params.size ? `${path}?${params}` : path
}

export function textSearch(value: string) { return { contains: value, mode: 'insensitive' as const } }
