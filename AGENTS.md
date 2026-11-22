
## Notifications
NEVER build outbox/texting/email notification machinery or cron/worker services. External events = Openfront Commerce webhooks (features/webhooks) only.

## No timers
NEVER add setInterval/setTimeout loops, `instrumentation.ts` maintenance, cron or worker services. One exception (apprentice, 2026-11-22): the shared Stripe test account has no room for a webhook, so `instrumentation.ts` runs the one-minute Checkout reconcile in `features/integrations/checkout-reconcile.ts`; nothing else. Expired fare holds and unpaid bookings past their payment deadline advance idempotently on the request that touches them (storefront booking read / checkout) or via the staff "Refresh" button on Bookings (`refreshAirlineClocks`); seat availability already ignores expired holds on read.
