export type PendingBookingIntent = {
  version: 1
  offerId: string
  passengerIds: string[]
  shoppingSessionToken: string
  idempotencyKey: string
  totalAmount: number
  currencyCode: string
  expiresAt: string
}

export const CUSTOMER_BOOKING_COMMAND = `mutation CustomerBookingCommand($offer: ID!, $passengers: [ID!]!, $token: String!, $key: String!, $recover: Boolean) {
  createCustomerBooking(offerId: $offer, passengerIds: $passengers, shoppingSessionToken: $token, idempotencyKey: $key, recoverOnly: $recover) {
    bookingId recordLocator status bookingAccessToken bookingReceipt changed replayed
  }
}`

export const CUSTOMER_BOOKING_READ = `query CurrentCustomerBooking($record: String!, $token: String!) {
  customerBooking(recordLocator: $record, accessToken: $token) {
    id recordLocator status paymentStatus ticketingStatus totalAmount currencyCode passengers segments payments tickets checkIns reaccommodations carrier orderNumber bookingReceipt
  }
}`

export function parsePendingBookingIntent(value: string | null): PendingBookingIntent | null {
  if (value === null) return null
  if (value.length > 6000) throw new Error('Saved booking command is invalid; retain it for operator reconciliation.')
  let parsed: PendingBookingIntent
  try { parsed = JSON.parse(value) } catch { throw new Error('Saved booking command is unreadable; do not start a replacement reservation.') }
  if (!parsed || parsed.version !== 1 || typeof parsed.offerId !== 'string' || !parsed.offerId
    || !Array.isArray(parsed.passengerIds) || parsed.passengerIds.length < 1 || parsed.passengerIds.length > 9
    || parsed.passengerIds.some(id => typeof id !== 'string' || !id) || new Set(parsed.passengerIds).size !== parsed.passengerIds.length
    || typeof parsed.shoppingSessionToken !== 'string' || !/^[A-Za-z0-9_-]{32,200}$/.test(parsed.shoppingSessionToken)
    || typeof parsed.idempotencyKey !== 'string' || parsed.idempotencyKey.length < 12 || parsed.idempotencyKey.length > 200
    || !Number.isSafeInteger(parsed.totalAmount) || parsed.totalAmount < 0 || !/^[A-Z]{3}$/.test(parsed.currencyCode)
    || typeof parsed.expiresAt !== 'string' || !Number.isFinite(Date.parse(parsed.expiresAt))) throw new Error('Saved booking command is incomplete; do not start a replacement reservation.')
  return parsed
}

export function bookingIntentVariables(intent: PendingBookingIntent, recoverOnly: boolean) {
  return { offer: intent.offerId, passengers: [...intent.passengerIds], token: intent.shoppingSessionToken, key: intent.idempotencyKey, recover: recoverOnly }
}

export type { BookingReceipt } from '@/features/airline/lib/booking-receipt'
