export async function sendOperationalAlert(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`Alert receiver returned HTTP ${response.status}.`)
}
