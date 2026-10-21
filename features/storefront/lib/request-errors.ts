// Customer-facing request failures. A transport failure or unreadable response means the server may or may not have
// applied a command, so callers keep the same command identity and retry it instead of starting a new one.
export class OutcomeUnknownError extends Error {}

const internalDetail = /prisma|invalid `|\bP\d{4}\b|SELECT |INSERT |UPDATE "|ECONN|ETIMEDOUT|stack|\bat [\w.]+ \(|graphql/i

/** Domain messages from our own commands pass through; anything that looks internal becomes a generic message. */
export function customerSafeMessage(message: string | undefined, fallback: string) {
  if (!message || message.length > 300 || internalDetail.test(message)) return fallback
  return message
}

export async function postGraphql<T>(query: string, variables: Record<string, unknown>) {
  let response: Response
  let payload: { data?: T; errors?: Array<{ message: string }> }
  try {
    response = await fetch('/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) })
    payload = await response.json()
  } catch {
    throw new OutcomeUnknownError('The connection was interrupted, so we don’t know whether this went through. Try again: the same request is never applied twice.')
  }
  if (payload.errors?.length) throw new Error(customerSafeMessage(payload.errors[0]?.message, 'This request could not be completed. Please try again.'))
  if (!response.ok || !payload.data) throw new OutcomeUnknownError('We didn’t get a clear answer from the airline. Try again: the same request is never applied twice.')
  return payload.data
}
