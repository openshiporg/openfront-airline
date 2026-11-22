import crypto from 'node:crypto'
import type { Context } from '.keystone/types'

import { DomainError } from '../lib/domain-error'
import { consumeDurableRateLimit } from '../lib/rate-limit'
import { durableRequestFingerprint } from '../lib/request-identity'
import { resolveSessionSecret } from '../lib/session'
import { signBookingPass } from '../lib/storefront-session'
import { sendCustomerAccountEmail } from '../lib/mail'
import { isConfiguredPublicCarrier } from './storefront'
import { formatAirportTime } from '../../airline/lib/time'

// Storefront traveler accounts. Sign up and sign in set an HttpOnly cookie that carries a signed account id and its
// session version; My trips lists every booking whose contact email is the account's (verified) email, each with a
// booking pass, so seats, check-in, payment and cancellation work through the same booking access as a guest.

const bcrypt = require('bcryptjs') as { hash(value: string, rounds: number): Promise<string>; compare(value: string, hash: string): Promise<boolean> }

let dummy: Promise<string> | null = null
const dummyHash = () => (dummy ??= bcrypt.hash(crypto.randomBytes(16).toString('hex'), 12))

const COOKIE = 'af_account'
const MAX_AGE_S = 60 * 60 * 24 * 60
const LINK_TTL_MS = 60 * 60_000

type Account = { id: string; accountKey: string; carrierCode: string; email: string; passwordHash: string; emailVerified: boolean; sessionVersion: number; givenName: string; familyName: string; dateOfBirth: string; phone: string }

const mac = (value: string) => crypto.createHmac('sha256', resolveSessionSecret()).update(value).digest('base64url')
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y) }
const normalizeEmail = (value: string) => String(value ?? '').trim().toLowerCase()
const accountKey = (carrierCode: string, email: string) => `${carrierCode.toUpperCase()}:${normalizeEmail(email)}`

function validEmail(value: string) {
  const email = normalizeEmail(value)
  if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError('Enter a valid email address.')
  return email
}
function validPassword(value: string) {
  const password = String(value ?? '')
  if (password.length < 10 || password.length > 200) throw new DomainError('Use a password of at least 10 characters.')
  return password
}

function signed(payload: string) { return `${payload}.${mac(`account:${payload}`)}` }
function verified(token: string) {
  const at = token.lastIndexOf('.')
  if (at <= 0) return null
  const payload = token.slice(0, at)
  return same(token.slice(at + 1), mac(`account:${payload}`)) ? payload : null
}

function readCookie(context: Context) {
  const header = String((context as any).req?.headers?.cookie ?? '')
  const match = header.split(/;\s*/).find(part => part.startsWith(`${COOKIE}=`))
  return match ? decodeURIComponent(match.slice(COOKIE.length + 1)) : ''
}
function setCookie(context: Context, value: string, maxAge: number) {
  const res = (context as any).res
  if (!res?.setHeader) throw new DomainError('Sign-in isn’t available right now.')
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`)
}
function startSession(context: Context, account: Account) {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_S
  setCookie(context, signed(`${account.id}:${account.sessionVersion}:${expires}`), MAX_AGE_S)
}

async function limit(context: Context, scope: string, signal = '', max = 10) {
  await consumeDurableRateLimit(context.prisma as any, `storefront.account.${scope}`, durableRequestFingerprint((context as any).req ?? {}, signal), max, 15 * 60_000)
}

async function assertCarrier(context: Context, carrierCode: string) {
  if (!await isConfiguredPublicCarrier((context as any).prisma, carrierCode)) throw new DomainError('Carrier is unavailable on this storefront.')
  return String(carrierCode).trim().toUpperCase()
}
async function carrierName(context: Context, code: string) {
  return ((await (context.prisma as any).carrier.findFirst({ where: { code }, select: { name: true } }))?.name as string | undefined) ?? null
}

export async function currentAccount(context: Context): Promise<Account | null> {
  const payload = verified(readCookie(context))
  if (!payload) return null
  const [id, version, expires] = payload.split(':')
  if (!id || !(Number(expires) > Date.now() / 1000)) return null
  const account = await (context.prisma as any).customerAccount.findUnique({ where: { id } }) as Account | null
  return account && String(account.sessionVersion) === version ? account : null
}

function publicAccount(account: Account) {
  return { email: account.email, emailVerified: account.emailVerified, givenName: account.givenName, familyName: account.familyName, dateOfBirth: account.dateOfBirth, phone: account.phone }
}

// One-hour links for "confirm your email" and "reset your password", bound to the session version so a used reset
// link (which bumps it) or a newer password stops older links.
function accountLink(account: Account, purpose: 'verify' | 'reset') {
  const expires = Date.now() + LINK_TTL_MS
  return signed(`${purpose}:${account.id}:${account.sessionVersion}:${expires}`)
}
async function accountFromLink(context: Context, token: string, purpose: 'verify' | 'reset') {
  const payload = verified(String(token ?? '').trim())
  const [kind, id, version, expires] = payload?.split(':') ?? []
  if (kind !== purpose || !id || !(Number(expires) > Date.now())) throw new DomainError('This link has expired. Ask for a new one.')
  const account = await (context.prisma as any).customerAccount.findUnique({ where: { id } }) as Account | null
  if (!account || String(account.sessionVersion) !== version) throw new DomainError('This link has expired. Ask for a new one.')
  return account
}

export async function signUpCustomer(_root: unknown, args: { carrierCode: string; email: string; password: string; givenName: string; familyName: string }, context: Context) {
  const carrierCode = await assertCarrier(context, args.carrierCode)
  const email = validEmail(args.email)
  const password = validPassword(args.password)
  const givenName = String(args.givenName ?? '').trim().slice(0, 80), familyName = String(args.familyName ?? '').trim().slice(0, 80)
  if (!givenName || !familyName) throw new DomainError('Enter your first and last name as on your passport or ID.')
  await limit(context, 'signup', '', 10)
  const prisma = context.prisma as any
  const key = accountKey(carrierCode, email)
  if (await prisma.customerAccount.findUnique({ where: { accountKey: key }, select: { id: true } })) throw new DomainError('There’s already an account with that email. Sign in, or reset your password.')
  const account = await prisma.customerAccount.create({ data: { accountKey: key, carrierCode, email, passwordHash: await bcrypt.hash(password, 12), givenName, familyName } }) as Account
  startSession(context, account)
  await sendCustomerAccountEmail({ to: email, kind: 'verify', token: accountLink(account, 'verify'), carrierName: await carrierName(context, carrierCode) }).catch(() => false)
  return publicAccount(account)
}

export async function signInCustomer(_root: unknown, args: { carrierCode: string; email: string; password: string }, context: Context) {
  const carrierCode = await assertCarrier(context, args.carrierCode)
  const email = normalizeEmail(args.email)
  await limit(context, 'signin', email, 8)
  const account = await (context.prisma as any).customerAccount.findUnique({ where: { accountKey: accountKey(carrierCode, email) } }) as Account | null
  // Compare against a fixed hash when there is no account, so the answer takes the same time either way.
  const ok = await bcrypt.compare(String(args.password ?? ''), account?.passwordHash ?? await dummyHash())
  if (!account || !ok) throw new DomainError('That email and password don’t match.')
  startSession(context, account)
  return publicAccount(account)
}

export async function signOutCustomer(_root: unknown, _args: unknown, context: Context) {
  setCookie(context, '', 0)
  return true
}

export async function customerAccount(_root: unknown, _args: unknown, context: Context) {
  const account = await currentAccount(context)
  return account ? publicAccount(account) : null
}

export async function updateCustomerTraveler(_root: unknown, args: { givenName: string; familyName: string; dateOfBirth: string; phone: string }, context: Context) {
  const account = await currentAccount(context)
  if (!account) throw new DomainError('Sign in first.')
  const dateOfBirth = String(args.dateOfBirth ?? '').trim()
  if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) throw new DomainError('Enter the date of birth as YYYY-MM-DD.')
  const givenName = String(args.givenName ?? '').trim().slice(0, 80), familyName = String(args.familyName ?? '').trim().slice(0, 80)
  if (!givenName || !familyName) throw new DomainError('Enter your first and last name.')
  const updated = await (context.prisma as any).customerAccount.update({ where: { id: account.id }, data: { givenName, familyName, dateOfBirth, phone: String(args.phone ?? '').trim().slice(0, 40) } })
  return publicAccount(updated)
}

export async function sendCustomerAccountLink(_root: unknown, args: { carrierCode: string; email: string; purpose: string }, context: Context) {
  const carrierCode = await assertCarrier(context, args.carrierCode)
  const purpose = args.purpose === 'reset' ? 'reset' : 'verify'
  const email = normalizeEmail(args.email)
  await limit(context, 'link', email, 5)
  const signedIn = purpose === 'verify' ? await currentAccount(context) : null
  const account = signedIn ?? await (context.prisma as any).customerAccount.findUnique({ where: { accountKey: accountKey(carrierCode, email) } }) as Account | null
  // Same answer whether or not the account exists.
  if (account) await sendCustomerAccountEmail({ to: account.email, kind: purpose, token: accountLink(account, purpose), carrierName: await carrierName(context, carrierCode) }).catch(() => false)
  return true
}

export async function confirmCustomerEmail(_root: unknown, args: { token: string }, context: Context) {
  const account = await accountFromLink(context, args.token, 'verify')
  const updated = await (context.prisma as any).customerAccount.update({ where: { id: account.id }, data: { emailVerified: true } })
  startSession(context, updated)
  return publicAccount(updated)
}

export async function resetCustomerPassword(_root: unknown, args: { token: string; password: string }, context: Context) {
  const account = await accountFromLink(context, args.token, 'reset')
  const password = validPassword(args.password)
  // Reading the reset email proves the address, so it is verified too; older sessions and links stop working.
  const updated = await (context.prisma as any).customerAccount.update({ where: { id: account.id }, data: { passwordHash: await bcrypt.hash(password, 12), emailVerified: true, sessionVersion: account.sessionVersion + 1 } })
  startSession(context, updated)
  return publicAccount(updated)
}

// My trips: bookings on this airline whose contact email is the account's. Shown only once the email is confirmed,
// so nobody can sign up with someone else's address and see their trips.
export async function customerTrips(_root: unknown, _args: unknown, context: Context) {
  const account = await currentAccount(context)
  if (!account) throw new DomainError('Sign in first.')
  if (!account.emailVerified) return []
  const bookings = await (context.prisma as any).booking.findMany({
    where: { carrier: { code: account.carrierCode }, contactEmail: { equals: account.email, mode: 'insensitive' }, accessTokenHash: { not: null }, accessTokenExpiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      recordLocator: true, status: true, paymentStatus: true, ticketingStatus: true, totalAmount: true, currencyCode: true, accessTokenHash: true,
      segments: { orderBy: [{ sequence: 'asc' }, { id: 'asc' }], select: { originCode: true, destinationCode: true, marketingFlightNumber: true, status: true, scheduledDepartureAt: true, origin: { select: { timezone: true } } } },
    },
  })
  return bookings.filter((booking: any) => /^[0-9a-f]{64}$/.test(booking.accessTokenHash ?? '')).map((booking: any) => ({
    recordLocator: booking.recordLocator,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    ticketingStatus: booking.ticketingStatus,
    totalAmount: booking.totalAmount,
    currencyCode: booking.currencyCode,
    pass: signBookingPass(booking.accessTokenHash),
    segments: booking.segments.filter((segment: any) => !['cancelled', 'reaccommodated'].includes(String(segment.status))).map((segment: any) => ({
      originCode: segment.originCode, destinationCode: segment.destinationCode, flightNumber: segment.marketingFlightNumber,
      departureAt: segment.scheduledDepartureAt ? new Date(segment.scheduledDepartureAt).toISOString() : null,
      departureLabel: segment.scheduledDepartureAt ? formatAirportTime(segment.scheduledDepartureAt, segment.origin?.timezone) ?? null : null,
    })),
  }))
}
