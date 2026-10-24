export const TICKET_STATUSES = ['issued', 'partially_used', 'used', 'suspended', 'voided', 'refunded', 'exchanged'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKETING_ACTOR_QUERY = `query PlatformTicketingActor { authenticatedItem { ... on User { carrier { id } role { canReadTicketing canManageTicketing canManageCarriers } } } }`

export type TicketingActor = {
  carrier?: { id: string } | null
  role?: { canReadTicketing: boolean | null; canManageTicketing: boolean | null; canManageCarriers: boolean | null } | null
} | null

export function canReadTickets(actor: TicketingActor) {
  const role = actor?.role
  return Boolean((role?.canReadTicketing || role?.canManageTicketing) && (role?.canManageCarriers || actor?.carrier?.id))
}

export function statusText(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase())
}
