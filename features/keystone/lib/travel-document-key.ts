import crypto from 'node:crypto'

import { resolveSessionSecret } from './session'

// TRAVEL_DOCUMENT_TOKENIZATION_KEY when set; otherwise a key derived from SESSION_SECRET with its own label, so
// stations can register documents on the standard deployment settings. Changing either secret changes new tokens.
export function travelDocumentTokenizationKey(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.TRAVEL_DOCUMENT_TOKENIZATION_KEY?.trim()
  if (configured) return configured
  return crypto.createHmac('sha256', resolveSessionSecret(env)).update('openfront-airline:travel-document-tokenization:v1').digest('hex')
}
