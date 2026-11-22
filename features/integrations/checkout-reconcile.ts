import { keystoneContext } from '../keystone/context'
import { recordPaidStoredCheckouts } from '../keystone/mutations/storefrontPayments'

const EVERY_MS = 60_000

// One timer per process, never overlapping: records Stripe Checkout payments whose traveler closed the tab.
// The fleet's shared Stripe test account cannot take another webhook endpoint, so this replaces one.
export function startCheckoutReconcile() {
  const state = globalThis as { __airlineCheckoutReconcile?: ReturnType<typeof setInterval> }
  if (state.__airlineCheckoutReconcile) return
  let running = false
  const run = async () => {
    if (running) return
    running = true
    try { await recordPaidStoredCheckouts(keystoneContext.sudo()) }
    catch (error) { console.error('Checkout reconcile failed', error instanceof Error ? error.message : error) }
    finally { running = false }
  }
  state.__airlineCheckoutReconcile = setInterval(run, EVERY_MS)
  state.__airlineCheckoutReconcile.unref?.()
  setTimeout(run, 15_000).unref?.()
  console.log('Checkout reconcile started: every 60s')
}
