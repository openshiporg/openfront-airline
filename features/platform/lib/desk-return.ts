const deskKeys = ['date','origin','destination','locator','q','status','passengerCursor','offerCursor','bookingCursor','paymentCursor','evidenceCursor','auditEventCursor','providerConnectionCursor','serviceCursor','disruptionCursor','recoveryFrom','scheduleCursor','scheduleId','flightCursor','flightFrom','cleanupCursor'] as const

export function safeDeskReturn(desk: string, raw: unknown): string {
  const base = `/dashboard/platform/${desk}`
  if (typeof raw !== 'string' || raw.length > 2400 || /[\\\u0000-\u001f\u007f]/.test(raw)) return base
  try {
    const url = new URL(raw, 'https://desk.invalid')
    if (url.origin !== 'https://desk.invalid' || url.pathname !== base || !raw.startsWith(base)) return base
    const params = new URLSearchParams()
    for (const key of deskKeys) {
      const values = url.searchParams.getAll(key)
      if (values.length === 1 && values[0].length <= 128 && !/[\\\u0000-\u001f\u007f]/.test(values[0])) params.set(key,values[0])
    }
    return params.size ? `${base}?${params}` : base
  } catch { return base }
}

export function detailWithReturn(path: string, params: Record<string,string|string[]|undefined>) {
  const desk = path.split('/')[3]
  const query = new URLSearchParams()
  for (const key of deskKeys) if (typeof params[key] === 'string') query.set(key,params[key])
  const returnTo = safeDeskReturn(desk, `/dashboard/platform/${desk}?${query}`)
  return `${path}?${new URLSearchParams({ returnTo })}`
}
