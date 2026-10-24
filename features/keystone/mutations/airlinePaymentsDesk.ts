import crypto from 'node:crypto'
import type { Context } from '.keystone/types'

import { requireFreshCarrierPermission, requireFreshPermission } from '../access'
import { isEvidenceOnlyManualProvider } from '../lib/bounded-payment-policy'
import { DomainError } from '../lib/domain-error'
import { hashStorefrontToken } from '../lib/storefront-session'
import { normalizeIdempotencyKey } from './airlineOperations'
import { submitManualPaymentEvidence } from './airlineWorkflows'

const METHODS = ['bank_transfer', 'card_terminal', 'cash', 'other'] as const

// A payment operator records money the airline received outside the website (bank transfer, airport card
// terminal, cash): the settlement ledger entry and its evidence digest are created here instead of through the
// machine import API, then the usual maker step submits it. A different operator still approves it before the
// booking can be marked paid, so maker-checker is unchanged.
export async function recordReceivedPayment(
  root: unknown,
  args: { bookingId: string; purpose: string; method: string; externalReference: string; amount: number; receivedAt: string; idempotencyKey: string },
  context: Context,
) {
  await requireFreshPermission(context, 'canManagePayments')
  const prisma = context.prisma as any
  const booking = await prisma.booking.findUnique({ where: { id: args.bookingId }, select: { id: true, carrierId: true, currencyCode: true } })
  if (!booking) throw new DomainError('Resource not found or inaccessible.')
  const actor = await requireFreshCarrierPermission(context, 'canManagePayments', booking.carrierId)
  const purpose = args.purpose === 'refund' ? 'refund' : args.purpose === 'capture' ? 'capture' : null
  if (!purpose) throw new DomainError('Choose payment received or refund sent.')
  if (!(METHODS as readonly string[]).includes(args.method)) throw new DomainError('Choose how the money moved.')
  const externalReference = args.externalReference.trim()
  if (externalReference.length < 6 || externalReference.length > 200) throw new DomainError('Enter the bank, terminal or receipt reference (6 to 200 characters).')
  if (!Number.isSafeInteger(args.amount) || args.amount <= 0) throw new DomainError('Enter the amount.')
  const receivedAt = new Date(args.receivedAt)
  if (Number.isNaN(receivedAt.getTime()) || receivedAt > new Date(Date.now() + 5 * 60_000)) throw new DomainError('Enter when the money moved; it can’t be in the future.')
  const providers = await prisma.paymentProvider.findMany({ where: { carrierId: booking.carrierId, adapterType: 'manual', status: 'active' }, take: 5 })
  if (!providers.some((provider: any) => isEvidenceOnlyManualProvider(provider))) throw new DomainError('Activate a manual settlement provider on the Payment providers page first.')
  const key = normalizeIdempotencyKey(args.idempotencyKey)

  const ledgerSource = `operator:${args.method}`
  const currencyCode = booking.currencyCode
  const occurredAt = receivedAt.toISOString()
  // The digest fingerprints exactly what the operator recorded; the checker approves this same record.
  const evidenceDigest = crypto.createHash('sha256').update(JSON.stringify({ carrierId: booking.carrierId, bookingId: booking.id, purpose, ledgerSource, externalReference, amount: args.amount, currencyCode, occurredAt })).digest('hex')
  const ledgerKey = crypto.createHash('sha256').update(`${booking.carrierId}\u0000${ledgerSource}\u0000${externalReference}`).digest('hex')
  const retained = await prisma.settlementLedgerEntry.upsert({
    where: { ledgerKey },
    update: {},
    create: {
      carrierId: booking.carrierId, ledgerKey, externalReference, ledgerSource, evidenceDigest, amount: args.amount, currencyCode,
      occurredAt: receivedAt, importedByCredentialId: `user:${actor.itemId}`, sourceMetadata: { recordedBy: actor.itemId, method: args.method, bookingId: booking.id, purpose },
    },
  })
  if (retained.amount !== args.amount || retained.currencyCode !== currencyCode || retained.evidenceDigest !== evidenceDigest) throw new DomainError('That reference was already recorded with different details.')
  return submitManualPaymentEvidence(root, { bookingId: booking.id, purpose, externalReference, ledgerSource, evidenceDigest, amount: args.amount, currencyCode, idempotencyKey: `${key}:evidence` }, context)
}

// Issues a new booking access code for a customer who lost theirs (verified by the agent on the phone or at the
// desk). The old code stops working; the new one is shown to the agent once.
export async function reissueBookingAccessCode(
  _root: unknown,
  args: { bookingId: string },
  context: Context,
) {
  await requireFreshPermission(context, 'canManageBookings')
  const prisma = context.prisma as any
  const booking = await prisma.booking.findUnique({ where: { id: args.bookingId }, select: { id: true, carrierId: true, recordLocator: true, accessTokenVersion: true, status: true } })
  if (!booking) throw new DomainError('Resource not found or inaccessible.')
  const actor = await requireFreshCarrierPermission(context, 'canManageBookings', booking.carrierId)
  const token = crypto.randomBytes(32).toString('base64url')
  const now = new Date()
  await prisma.booking.update({ where: { id: booking.id }, data: { accessTokenHash: hashStorefrontToken(token), accessTokenExpiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60_000), accessTokenVersion: (booking.accessTokenVersion ?? 1) + 1 } })
  await prisma.auditEvent.create({ data: { carrierId: booking.carrierId, actorId: actor.itemId, eventKey: `booking-access-reissued:${booking.id}:${crypto.randomUUID()}`, action: 'booking.access-token.reissue', aggregateType: 'Booking', aggregateId: booking.id, source: 'platform', beforeSummary: {}, afterSummary: { accessRevoked: true }, metadata: {}, occurredAt: now } })
  return { recordLocator: booking.recordLocator, accessToken: token }
}
