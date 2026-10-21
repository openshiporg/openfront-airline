import crypto from 'node:crypto'

export function signTimestampedWebhook(body: Buffer | string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex')}`
}

export function verifyTimestampedWebhook(body: Buffer, header: string, secret: string, now = Date.now(), toleranceMs = 5 * 60_000) {
  const entries = header.split(',').map(entry => entry.trim().split('=', 2))
  const timestamp = Number(entries.find(([key]) => key === 't')?.[1])
  const signatures = entries.filter(([key]) => key === 'v1').map(([, value]) => value)
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp * 1000) > toleranceMs || !signatures.length) return false
  const expected = Buffer.from(crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex'), 'hex')
  return signatures.some(signature => { const received = Buffer.from(signature, 'hex'); return received.length === expected.length && crypto.timingSafeEqual(received, expected) })
}

// Webhook secrets may only come from dedicated variables. A tenant-editable name such as NODE_ENV would make the
// "secret" a publicly known value and every signature forgeable.
export const WEBHOOK_SECRET_ENV_PATTERN = /^AIRLINE_WEBHOOK_SECRET_[A-Z0-9_]+$/

export const MIN_WEBHOOK_SECRET_LENGTH = 32

export function webhookSecretFromEnvironment(name: string, env: NodeJS.ProcessEnv = process.env) {
  if (!WEBHOOK_SECRET_ENV_PATTERN.test(name)) throw new Error('Webhook secret variable must be named AIRLINE_WEBHOOK_SECRET_<NAME>.')
  const secret = env[name]
  // Checked where the secret is used, not at boot: a short or placeholder value makes this webhook unavailable.
  if (secret !== undefined && secret.length < MIN_WEBHOOK_SECRET_LENGTH) throw new Error(`Webhook secret must be at least ${MIN_WEBHOOK_SECRET_LENGTH} characters.`)
  return secret
}
