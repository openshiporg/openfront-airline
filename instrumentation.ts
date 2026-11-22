// Server start-up: the one-minute Stripe Checkout reconcile (see features/integrations/checkout-reconcile.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  const { startCheckoutReconcile } = await import('./features/integrations/checkout-reconcile')
  startCheckoutReconcile()
}
