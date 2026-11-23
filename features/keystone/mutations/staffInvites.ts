import crypto from 'node:crypto'
import type { Context } from '.keystone/types'

import { requireFreshPermission, roleWithinGrantCeiling } from '../access'
import { DomainError } from '../lib/domain-error'
import { sendStaffInviteEmail } from '../lib/mail'
import { consumeDurableRateLimit } from '../lib/rate-limit'
import { durableRequestFingerprint } from '../lib/request-identity'
import { permissionsList } from '../models/fields'

// Staff invitations, the smallest working flow: an administrator enters an email and a role; the invitee gets an
// email, opens the link, chooses a name and password, and signs in with that role. The link is single-use and lasts
// seven days; only its SHA-256 is stored.

const INVITE_TTL_MS = 7 * 24 * 60 * 60_000
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')
const normalizeEmail = (value: string) => String(value ?? '').trim().toLowerCase()
const roleSelect = Object.fromEntries(['id', 'name', 'carrierId', ...permissionsList].map(name => [name, true]))

function validEmail(value: string) {
  const email = normalizeEmail(value)
  if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError('Enter a valid email address.')
  return email
}

async function inviter(context: Context) {
  const session = (context as any).session
  if (!session?.itemId) throw new DomainError('Resource not found or inaccessible.', 'NOT_FOUND')
  const user = await (context.prisma as any).user.findUnique({ where: { id: session.itemId }, select: { id: true, name: true, carrierId: true, carrier: { select: { name: true } }, role: { select: roleSelect } } })
  const role = user?.role
  if (!user?.carrierId || !role || (role.canManageUsers !== true && role.canManageCarriers !== true)) throw new DomainError('Resource not found or inaccessible.', 'NOT_FOUND')
  return user
}

export async function inviteStaffMember(_root: unknown, args: { email: string; roleId: string }, context: Context) {
  const actor = await inviter(context)
  await consumeDurableRateLimit(context.prisma as any, 'staff.invite', durableRequestFingerprint((context as any).req ?? {}, actor.id), 20, 60 * 60_000)
  const email = validEmail(args.email)
  const role = await (context.prisma as any).role.findUnique({ where: { id: String(args.roleId ?? '') }, select: roleSelect })
  if (!role || role.carrierId !== actor.carrierId) throw new DomainError('Choose one of your airline’s roles.')
  if (!roleWithinGrantCeiling(actor.role, role)) throw new DomainError('You can only invite someone to a role with no more access than your own.')
  if (await (context.prisma as any).user.findUnique({ where: { email }, select: { id: true } })) throw new DomainError('Someone with this email already has staff access.')
  const now = new Date()
  // A new invite to the same address replaces any earlier one that is still open.
  await (context.prisma as any).staffInvite.updateMany({ where: { email, carrierId: actor.carrierId, acceptedAt: null, revokedAt: null }, data: { revokedAt: now } })
  const token = crypto.randomBytes(32).toString('base64url')
  const invite = await (context.prisma as any).staffInvite.create({ data: {
    carrierId: actor.carrierId, roleId: role.id, email, tokenHash: hashToken(token), invitedById: actor.id,
    expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
  }, select: { id: true, expiresAt: true } })
  const messageId = await sendStaffInviteEmail({ to: email, token, roleName: role.name, carrierName: actor.carrier?.name, invitedBy: actor.name })
  if (!messageId) {
    await (context.prisma as any).staffInvite.update({ where: { id: invite.id }, data: { revokedAt: new Date() } })
    throw new DomainError('The invite email could not be sent. Nothing was saved; try again.')
  }
  return { id: invite.id, email, roleName: role.name, expiresAt: invite.expiresAt.toISOString() }
}

export async function staffInvites(_root: unknown, _args: unknown, context: Context) {
  const actor = await inviter(context)
  const rows = await (context.prisma as any).staffInvite.findMany({ where: { carrierId: actor.carrierId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, take: 50 })
  const roles = await (context.prisma as any).role.findMany({ where: { id: { in: rows.map((row: any) => row.roleId) } }, select: { id: true, name: true } })
  const roleName = new Map(roles.map((role: any) => [role.id, role.name]))
  return rows.map((row: any) => ({ id: row.id, email: row.email, roleName: roleName.get(row.roleId) ?? 'Role removed', expiresAt: row.expiresAt.toISOString() }))
}

export async function revokeStaffInvite(_root: unknown, args: { id: string }, context: Context) {
  const actor = await inviter(context)
  const result = await (context.prisma as any).staffInvite.updateMany({ where: { id: String(args.id ?? ''), carrierId: actor.carrierId, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } })
  if (!result.count) throw new DomainError('This invite is no longer open.')
  return true
}

async function openInvite(context: Context, token: string) {
  const value = String(token ?? '')
  if (value.length < 20 || value.length > 200) return null
  const invite = await (context.prisma as any).staffInvite.findUnique({ where: { tokenHash: hashToken(value) } })
  if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt <= new Date()) return null
  return invite
}

// Public: what the join page shows before the invitee sets a password.
export async function staffInvitePreview(_root: unknown, args: { token: string }, context: Context) {
  await consumeDurableRateLimit(context.prisma as any, 'staff.invite.preview', durableRequestFingerprint((context as any).req ?? {}), 60, 15 * 60_000)
  const invite = await openInvite(context, args.token)
  if (!invite) return null
  const [role, carrier] = await Promise.all([
    (context.prisma as any).role.findUnique({ where: { id: invite.roleId }, select: { name: true } }),
    (context.prisma as any).carrier.findUnique({ where: { id: invite.carrierId }, select: { name: true } }),
  ])
  return { email: invite.email, roleName: role?.name ?? '', carrierName: carrier?.name ?? '' }
}

// Public: the invitee chooses a name and password. Creates the User with the invited role, once.
export async function acceptStaffInvite(_root: unknown, args: { token: string; name: string; password: string }, context: Context) {
  await consumeDurableRateLimit(context.prisma as any, 'staff.invite.accept', durableRequestFingerprint((context as any).req ?? {}), 10, 15 * 60_000)
  const name = String(args.name ?? '').trim()
  const password = String(args.password ?? '')
  if (!name || name.length > 120) throw new DomainError('Enter your name.')
  if (password.length < 10 || password.length > 200) throw new DomainError('Use a password of at least 10 characters.')
  const invite = await openInvite(context, args.token)
  if (!invite) throw new DomainError('This invite link has expired or was already used. Ask your administrator for a new one.')
  const role = await (context.prisma as any).role.findUnique({ where: { id: invite.roleId }, select: { id: true, carrierId: true } })
  if (!role || role.carrierId !== invite.carrierId) throw new DomainError('The role on this invite no longer exists. Ask your administrator for a new one.')
  const claimed = await (context.prisma as any).staffInvite.updateMany({ where: { id: invite.id, acceptedAt: null, revokedAt: null }, data: { acceptedAt: new Date() } })
  if (!claimed.count) throw new DomainError('This invite link has expired or was already used. Ask your administrator for a new one.')
  try {
    // Keystone's own create runs the password field (hashing, common-password check) under the system context.
    await (context.sudo() as any).query.User.createOne({ data: {
      name, email: invite.email, password,
      carrier: { connect: { id: invite.carrierId } }, role: { connect: { id: role.id } },
    }, query: 'id' })
  } catch (error) {
    await (context.prisma as any).staffInvite.update({ where: { id: invite.id }, data: { acceptedAt: null } })
    const message = error instanceof Error ? error.message : ''
    if (/common|password/i.test(message)) throw new DomainError('Choose a less common password.')
    if (/unique|email/i.test(message)) throw new DomainError('Someone with this email already has staff access.')
    throw new DomainError('Your account could not be created. Try again.')
  }
  return { email: invite.email }
}
