import { Prisma, type PrismaClient } from '@prisma/client'

export function assertAuthoritativeCheckoutSettlement(object: any) {
  if (object?.payment_status !== 'paid') throw new Error('Checkout completion is not authoritative paid settlement.')
  const paymentIntent = String(object?.payment_intent ?? '').trim()
  if (!paymentIntent || paymentIntent === 'null' || paymentIntent === 'undefined') throw new Error('Checkout settlement has no provider payment reference.')
  return paymentIntent
}

// signingProviderId is the provider whose secret verified the delivery (set at ingress); body metadata alone is
// never authority for which session or carrier the money belongs to.
export async function processPaymentWebhookEvent(prisma: PrismaClient, webhookEventId: string, signingProviderId: string | null) {
  return prisma.$transaction(async tx => {
    const webhook = await tx.webhookEvent.findUnique({ where: { id: webhookEventId } })
    // Settlement and inbox success commit together; a retry after a crash before outbox acknowledgement is done.
    if (webhook?.status === 'succeeded') return
    if (!webhook || !webhook.signatureVerified || !webhook.status || !['pending', 'failed', 'processing'].includes(webhook.status)) throw new Error('Payment webhook is not processable.')
    if (!signingProviderId) throw new Error('Payment webhook has no verified signing provider; retained for reconciliation.')
    const event = webhook.payload as any
    if (event?.type !== 'checkout.session.completed') throw new Error('No payment domain adapter is installed for this retained event type.')
    const object = event.data?.object
    const providerPaymentId = assertAuthoritativeCheckoutSettlement(object)
    const sessionKey = String(object?.metadata?.payment_session_key ?? '')
    let paymentSession = await tx.paymentSession.findUnique({ where: { sessionKey }, include: { booking: { include: { passengers: true } }, provider: true } })
    if (!paymentSession || !paymentSession.provider || !paymentSession.booking || !paymentSession.bookingId || !paymentSession.providerId || !paymentSession.carrierId || paymentSession.provider.adapterType !== 'stripe' || paymentSession.providerSessionId !== object?.id || paymentSession.amount !== object?.amount_total || paymentSession.currencyCode.toLowerCase() !== String(object?.currency).toLowerCase()) throw new Error('Payment event does not match its checkout session.')
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${paymentSession.bookingId} FOR UPDATE`)
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentSession" WHERE "id" = ${paymentSession.id} FOR UPDATE`)
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentProvider" WHERE "id" = ${paymentSession.providerId} FOR UPDATE`)
    paymentSession = await tx.paymentSession.findUnique({ where: { id: paymentSession.id }, include: { booking: { include: { passengers: true } }, provider: true } })
    if (!paymentSession?.booking || !paymentSession.provider || !paymentSession.bookingId || !paymentSession.providerId || !paymentSession.carrierId || paymentSession.provider.adapterType !== 'stripe' || paymentSession.providerSessionId !== object?.id || paymentSession.amount !== object?.amount_total || paymentSession.currencyCode.toLowerCase() !== String(object?.currency).toLowerCase()) throw new Error('Payment session changed while applying the event.')
    if (paymentSession.providerId !== signingProviderId || paymentSession.carrierId !== webhook.carrierId || paymentSession.booking.carrierId !== webhook.carrierId) {
      throw new Error('Payment event was signed by a different provider installation or carrier than its session; retained for reconciliation.')
    }
    if (paymentSession.status !== 'captured') {
      const now = new Date()
      // A late paid observation for a closed session is money evidence for reconciliation, not a new sale.
      if (['failed', 'cancelled', 'expired'].includes(String(paymentSession.status)) || (paymentSession.expiresAt && paymentSession.expiresAt <= now)) {
        throw new Error('Provider reported payment for a closed or expired session; retained for reconciliation without issuing entitlements.')
      }
      const purchase = paymentSession.providerData as any
      if (purchase?.kind !== 'seat') {
        if (!['pending', 'confirmed'].includes(paymentSession.booking.status) || paymentSession.booking.paymentStatus !== 'unpaid' || paymentSession.amount !== paymentSession.booking.totalAmount || paymentSession.currencyCode !== paymentSession.booking.currencyCode) throw new Error('Booking is no longer eligible for this airfare settlement.')
        const priorFarePayments = await tx.payment.findMany({ where: { bookingId: paymentSession.bookingId, status: { in: ['captured', 'partially_refunded', 'refunded'] } }, select: { id: true, metadata: true } })
        if (priorFarePayments.some(payment => (payment.metadata as any)?.purchaseKind !== 'seat')) throw new Error('Booking already has an authoritative airfare capture.')
      }
      const duplicateProviderPayment = await tx.payment.findFirst({ where: { providerId: paymentSession.providerId, providerPaymentId }, select: { id: true } })
      if (duplicateProviderPayment) throw new Error('Provider payment reference was already applied.')
      const payment = await tx.payment.create({ data: {
        carrierId: paymentSession.carrierId, paymentKey: `stripe:${event.id}`, idempotencyKey: webhook.dedupeKey,
        bookingId: paymentSession.bookingId, providerId: paymentSession.providerId, sessionId: paymentSession.id,
        status: 'captured', amount: paymentSession.amount, authorizedAmount: paymentSession.amount, capturedAmount: paymentSession.amount,
        currencyCode: paymentSession.currencyCode, providerPaymentId, providerCaptureId: providerPaymentId, authorizedAt: now, capturedAt: now,
        metadata: { source: 'signed_stripe_webhook', purchaseKind: purchase?.kind ?? 'booking' },
      } })
      if (purchase?.kind === 'seat') {
        const bookingPassenger = paymentSession.booking.passengers.find(entry => entry.id === purchase.bookingPassengerId)
        if (!bookingPassenger) throw new Error('Seat purchase passenger does not belong to the booking.')
        const seatSegment = await tx.bookingSegment.findUnique({ where: { id: String(purchase.bookingSegmentId ?? '') }, select: { bookingId: true, status: true } })
        if (['cancelled', 'completed'].includes(String(paymentSession.booking.status)) || seatSegment?.bookingId !== paymentSession.bookingId || ['cancelled', 'refunded', 'reaccommodated', 'flown'].includes(String(seatSegment?.status))) {
          throw new Error('Seat payment arrived for a booking or segment that is no longer active; retained for reconciliation without issuing an entitlement.')
        }
        const document = await tx.electronicMiscDocument.create({ data: {
          carrierId: paymentSession.carrierId, documentNumber: `EMD-${event.id}`, bookingId: paymentSession.bookingId,
          bookingPassengerId: bookingPassenger.id, passengerId: bookingPassenger.passengerId, documentType: 'associated', reasonForIssuanceCode: 'A', serviceCode: 'SEAT', ancillaryProductId: purchase.ancillaryProductId,
          status: 'issued', totalAmount: paymentSession.amount, currencyCode: paymentSession.currencyCode, issuedAt: now, providerReference: providerPaymentId, metadata: { paymentId: payment.id, seatId: purchase.seatId },
        } })
        await tx.electronicMiscCoupon.create({ data: {
          carrierId: paymentSession.carrierId, couponKey: `${document.id}:${purchase.bookingSegmentId}`, documentId: document.id, couponNumber: 1,
          bookingSegmentId: purchase.bookingSegmentId, ancillaryProductId: purchase.ancillaryProductId, status: 'open', amount: paymentSession.amount, currencyCode: paymentSession.currencyCode,
          entitlementSnapshot: { seatId: purchase.seatId, paymentSessionId: paymentSession.id },
        } })
      } else {
        await tx.booking.update({ where: { id: paymentSession.bookingId }, data: { paymentStatus: 'paid', ...(paymentSession.booking.status === 'pending' ? { status: 'confirmed', confirmedAt: now } : {}) } })
      }
      await tx.paymentSession.update({ where: { id: paymentSession.id }, data: { status: 'captured', authorizedAt: now, completedAt: now } })
      await tx.auditEvent.upsert({ where: { eventKey: `provider-payment:${webhook.dedupeKey}` }, update: {}, create: { carrierId: paymentSession.carrierId, eventKey: `provider-payment:${webhook.dedupeKey}`, action: purchase?.kind === 'seat' ? 'seat.payment.captured' : 'payment.captured', aggregateType: 'Payment', aggregateId: payment.id, source: 'provider', idempotencyKey: webhook.dedupeKey, beforeSummary: {}, afterSummary: { status: 'captured', amount: paymentSession.amount, currencyCode: paymentSession.currencyCode }, metadata: { bookingId: paymentSession.bookingId, paymentSessionId: paymentSession.id }, occurredAt: now } })
      await tx.outboxEvent.upsert({ where: { eventKey: `payment:${webhook.dedupeKey}` }, update: {}, create: { carrierId: paymentSession.carrierId, eventKey: `payment:${webhook.dedupeKey}`, topic: purchase?.kind === 'seat' ? 'seat.entitlement.issued' : 'payment.captured', aggregateType: 'Payment', aggregateId: payment.id, payload: { bookingId: paymentSession.bookingId, paymentSessionId: paymentSession.id }, status: 'pending', availableAt: now } })
    }
    await tx.webhookEvent.update({ where: { id: webhook.id }, data: { status: 'succeeded', completedAt: new Date(), lastAttemptedAt: new Date(), attemptCount: { increment: 1 }, errorMessage: '' } })
  })
}
