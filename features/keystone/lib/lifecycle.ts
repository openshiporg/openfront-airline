type LifecycleDefinition = {
  label: string
  initial: string
  terminal: readonly string[]
  transitions: Readonly<Record<string, readonly string[]>>
  actions: Readonly<Record<string, string>>
}

export const lifecycleMachines = {
  offer: {
    label: 'Offer',
    initial: 'draft',
    terminal: ['accepted', 'expired', 'withdrawn'],
    transitions: {
      draft: ['available', 'withdrawn'],
      available: ['held', 'accepted', 'expired', 'withdrawn'],
      held: ['available', 'accepted', 'expired', 'withdrawn'],
      accepted: [],
      expired: [],
      withdrawn: [],
    },
    actions: { publish: 'available', hold: 'held', release: 'available', accept: 'accepted', expire: 'expired', withdraw: 'withdrawn' },
  },
  flightInstance: {
    label: 'Flight instance',
    initial: 'scheduled',
    terminal: ['arrived', 'cancelled'],
    transitions: {
      scheduled: ['open_for_sale', 'closed_for_sale', 'delayed', 'cancelled'],
      open_for_sale: ['closed_for_sale', 'delayed', 'cancelled'],
      closed_for_sale: ['open_for_sale', 'delayed', 'departed', 'cancelled'],
      delayed: ['open_for_sale', 'closed_for_sale', 'departed', 'cancelled'],
      departed: ['arrived'],
      arrived: [],
      cancelled: [],
    },
    actions: { openSales: 'open_for_sale', closeSales: 'closed_for_sale', delay: 'delayed', depart: 'departed', arrive: 'arrived', cancel: 'cancelled' },
  },
  inventoryHold: {
    label: 'Inventory hold',
    initial: 'active',
    terminal: ['converted', 'released', 'expired'],
    transitions: { active: ['converted', 'released', 'expired'], converted: [], released: [], expired: [] },
    actions: { convert: 'converted', release: 'released', expire: 'expired' },
  },
  booking: {
    label: 'Booking',
    initial: 'pending',
    terminal: ['completed', 'cancelled'],
    transitions: {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['ticketed', 'in_progress', 'cancelled'],
      ticketed: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    },
    actions: { confirm: 'confirmed', ticket: 'ticketed', start: 'in_progress', complete: 'completed', cancel: 'cancelled' },
  },
  journey: {
    label: 'Journey',
    initial: 'planned',
    terminal: ['completed', 'cancelled'],
    transitions: {
      planned: ['in_progress', 'disrupted', 'cancelled'],
      in_progress: ['completed', 'disrupted', 'cancelled'],
      disrupted: ['planned', 'in_progress', 'cancelled'],
      completed: [],
      cancelled: [],
    },
    actions: { start: 'in_progress', disrupt: 'disrupted', recover: 'planned', complete: 'completed', cancel: 'cancelled' },
  },
  bookingSegment: {
    label: 'Booking segment',
    initial: 'confirmed',
    terminal: ['flown', 'cancelled', 'refunded'],
    transitions: {
      confirmed: ['checked_in', 'disrupted', 'reaccommodated', 'cancelled', 'refunded'],
      checked_in: ['boarded', 'offloaded', 'disrupted', 'reaccommodated', 'cancelled'],
      boarded: ['flown', 'offloaded', 'disrupted'],
      offloaded: ['checked_in', 'disrupted', 'reaccommodated', 'cancelled'],
      disrupted: ['reaccommodated', 'cancelled', 'refunded'],
      reaccommodated: ['confirmed', 'cancelled'],
      flown: [],
      cancelled: [],
      refunded: [],
    },
    actions: { checkIn: 'checked_in', board: 'boarded', fly: 'flown', offload: 'offloaded', disrupt: 'disrupted', reaccommodate: 'reaccommodated', cancel: 'cancelled', refund: 'refunded' },
  },
  seatMap: {
    label: 'Seat map',
    initial: 'draft',
    terminal: ['retired'],
    transitions: { draft: ['published', 'retired'], published: ['retired'], retired: [] },
    actions: { publish: 'published', retire: 'retired' },
  },
  seatAssignment: {
    label: 'Seat assignment',
    initial: 'held',
    terminal: ['boarded', 'released', 'cancelled'],
    transitions: {
      held: ['assigned', 'released', 'cancelled'],
      assigned: ['confirmed', 'released', 'cancelled'],
      confirmed: ['boarded', 'released', 'cancelled'],
      boarded: ['confirmed', 'released'],
      released: [],
      cancelled: [],
    },
    actions: { assign: 'assigned', confirm: 'confirmed', board: 'boarded', release: 'released', cancel: 'cancelled' },
  },
  serviceRequest: {
    label: 'Service request',
    initial: 'requested',
    terminal: ['fulfilled', 'unable', 'cancelled'],
    transitions: {
      requested: ['pending', 'confirmed', 'unable', 'cancelled'],
      pending: ['confirmed', 'unable', 'cancelled'],
      confirmed: ['fulfilled', 'unable', 'cancelled'],
      fulfilled: [],
      unable: [],
      cancelled: [],
    },
    actions: { pend: 'pending', confirm: 'confirmed', fulfill: 'fulfilled', unable: 'unable', cancel: 'cancelled' },
  },
  ticket: {
    label: 'Ticket',
    initial: 'pending',
    terminal: ['used', 'voided', 'refunded', 'exchanged'],
    transitions: {
      pending: ['issued', 'voided'],
      issued: ['partially_used', 'used', 'voided', 'refunded', 'exchanged', 'suspended'],
      partially_used: ['used', 'refunded', 'exchanged', 'suspended'],
      suspended: ['issued', 'partially_used', 'refunded', 'exchanged'],
      used: [],
      voided: [],
      refunded: [],
      exchanged: [],
    },
    actions: { issue: 'issued', partiallyUse: 'partially_used', use: 'used', suspend: 'suspended', void: 'voided', refund: 'refunded', exchange: 'exchanged' },
  },
  ticketCoupon: {
    label: 'Ticket coupon',
    initial: 'open',
    terminal: ['flown', 'voided', 'refunded', 'exchanged'],
    transitions: {
      open: ['checked_in', 'voided', 'refunded', 'exchanged', 'suspended'],
      checked_in: ['boarded', 'open', 'voided', 'refunded', 'exchanged', 'suspended'],
      boarded: ['flown', 'open', 'suspended'],
      suspended: ['open', 'refunded', 'exchanged', 'voided'],
      flown: [],
      voided: [],
      refunded: [],
      exchanged: [],
    },
    actions: { checkIn: 'checked_in', reopen: 'open', board: 'boarded', fly: 'flown', suspend: 'suspended', void: 'voided', refund: 'refunded', exchange: 'exchanged' },
  },
  electronicMiscDocument: {
    label: 'Electronic miscellaneous document',
    initial: 'pending',
    terminal: ['used', 'voided', 'refunded', 'exchanged'],
    transitions: {
      pending: ['issued', 'voided'],
      issued: ['partially_used', 'used', 'voided', 'refunded', 'exchanged'],
      partially_used: ['used', 'refunded', 'exchanged'],
      used: [],
      voided: [],
      refunded: [],
      exchanged: [],
    },
    actions: { issue: 'issued', partiallyUse: 'partially_used', use: 'used', void: 'voided', refund: 'refunded', exchange: 'exchanged' },
  },
  electronicMiscCoupon: {
    label: 'Electronic miscellaneous coupon',
    initial: 'open',
    terminal: ['used', 'voided', 'refunded', 'exchanged'],
    transitions: { open: ['used', 'voided', 'refunded', 'exchanged'], used: [], voided: [], refunded: [], exchanged: [] },
    actions: { use: 'used', void: 'voided', refund: 'refunded', exchange: 'exchanged' },
  },
  paymentSession: {
    label: 'Payment session',
    initial: 'created',
    terminal: ['captured', 'failed', 'cancelled', 'expired'],
    transitions: {
      created: ['pending', 'cancelled', 'expired'],
      pending: ['authorized', 'captured', 'failed', 'cancelled', 'expired'],
      authorized: ['captured', 'failed', 'cancelled'],
      captured: [],
      failed: [],
      cancelled: [],
      expired: [],
    },
    actions: { begin: 'pending', authorize: 'authorized', capture: 'captured', fail: 'failed', cancel: 'cancelled', expire: 'expired' },
  },
  payment: {
    label: 'Payment',
    initial: 'pending',
    terminal: ['failed', 'cancelled', 'refunded'],
    transitions: {
      pending: ['authorized', 'captured', 'failed', 'cancelled'],
      authorized: ['captured', 'failed', 'cancelled'],
      captured: ['partially_refunded', 'refunded'],
      partially_refunded: ['refunded'],
      failed: [],
      cancelled: [],
      refunded: [],
    },
    actions: { authorize: 'authorized', capture: 'captured', partiallyRefund: 'partially_refunded', refund: 'refunded', fail: 'failed', cancel: 'cancelled' },
  },
  refund: {
    label: 'Refund',
    initial: 'requested',
    terminal: ['succeeded', 'failed', 'cancelled'],
    transitions: {
      requested: ['approved', 'cancelled'],
      approved: ['processing', 'cancelled'],
      processing: ['succeeded', 'failed'],
      succeeded: [],
      failed: [],
      cancelled: [],
    },
    actions: { approve: 'approved', process: 'processing', succeed: 'succeeded', fail: 'failed', cancel: 'cancelled' },
  },
  exchange: {
    label: 'Exchange',
    initial: 'quoted',
    terminal: ['completed', 'failed', 'cancelled', 'expired'],
    transitions: {
      quoted: ['accepted', 'cancelled', 'expired'],
      accepted: ['processing', 'cancelled'],
      processing: ['completed', 'failed'],
      completed: [],
      failed: [],
      cancelled: [],
      expired: [],
    },
    actions: { accept: 'accepted', process: 'processing', complete: 'completed', fail: 'failed', cancel: 'cancelled', expire: 'expired' },
  },
  checkIn: {
    label: 'Check-in',
    initial: 'not_started',
    terminal: ['boarded', 'cancelled'],
    transitions: {
      not_started: ['eligible', 'blocked', 'cancelled'],
      eligible: ['checked_in', 'blocked', 'cancelled'],
      checked_in: ['boarded', 'offloaded', 'cancelled'],
      offloaded: ['eligible', 'checked_in', 'cancelled'],
      blocked: ['eligible', 'cancelled'],
      boarded: ['offloaded'],
      cancelled: [],
    },
    actions: { markEligible: 'eligible', checkIn: 'checked_in', board: 'boarded', block: 'blocked', offload: 'offloaded', cancel: 'cancelled' },
  },
  boardingPass: {
    label: 'Boarding pass',
    initial: 'issued',
    terminal: ['revoked'],
    transitions: { issued: ['boarded', 'revoked', 'reissued'], reissued: ['boarded', 'revoked'], boarded: ['revoked'], revoked: [] },
    actions: { board: 'boarded', revoke: 'revoked', reissue: 'reissued' },
  },
  bag: {
    label: 'Bag',
    initial: 'accepted',
    terminal: ['delivered', 'closed'],
    transitions: {
      accepted: ['loaded', 'in_transit', 'delayed', 'mishandled'],
      loaded: ['in_transit', 'arrived', 'delayed', 'mishandled'],
      in_transit: ['loaded', 'arrived', 'delayed', 'mishandled'],
      arrived: ['delivered', 'delayed', 'mishandled'],
      delayed: ['in_transit', 'arrived', 'delivered', 'mishandled', 'closed'],
      mishandled: ['in_transit', 'arrived', 'delivered', 'closed'],
      delivered: ['closed'],
      closed: [],
    },
    actions: { load: 'loaded', transfer: 'in_transit', arrive: 'arrived', deliver: 'delivered', delay: 'delayed', mishandle: 'mishandled', close: 'closed' },
  },
  disruption: {
    label: 'Disruption',
    initial: 'detected',
    terminal: ['resolved', 'cancelled'],
    transitions: { detected: ['published', 'recovering', 'resolved', 'cancelled'], published: ['recovering', 'resolved', 'cancelled'], recovering: ['resolved', 'cancelled'], resolved: [], cancelled: [] },
    actions: { publish: 'published', recover: 'recovering', resolve: 'resolved', cancel: 'cancelled' },
  },
  reaccommodation: {
    label: 'Reaccommodation',
    initial: 'proposed',
    terminal: ['confirmed', 'declined', 'failed', 'expired', 'cancelled'],
    transitions: { proposed: ['accepted', 'declined', 'expired', 'cancelled'], accepted: ['confirmed', 'failed', 'cancelled'], confirmed: [], declined: [], failed: [], expired: [], cancelled: [] },
    actions: { accept: 'accepted', confirm: 'confirmed', decline: 'declined', fail: 'failed', expire: 'expired', cancel: 'cancelled' },
  },
  providerConnection: {
    label: 'Provider connection',
    initial: 'pending',
    terminal: ['revoked'],
    transitions: { pending: ['active', 'failed', 'revoked'], active: ['paused', 'failed', 'revoked'], paused: ['active', 'revoked'], failed: ['pending', 'active', 'revoked'], revoked: [] },
    actions: { activate: 'active', pause: 'paused', fail: 'failed', retry: 'pending', revoke: 'revoked' },
  },
  webhookEvent: {
    label: 'Webhook event',
    initial: 'pending',
    terminal: ['succeeded', 'dead_lettered'],
    transitions: { pending: ['processing', 'failed', 'succeeded'], processing: ['succeeded', 'failed'], failed: ['pending', 'dead_lettered'], succeeded: [], dead_lettered: [] },
    actions: { process: 'processing', succeed: 'succeeded', fail: 'failed', retry: 'pending', deadLetter: 'dead_lettered' },
  },
} as const satisfies Record<string, LifecycleDefinition>

export type LifecycleName = keyof typeof lifecycleMachines

export function canTransition(machineName: LifecycleName, from: string, to: string) {
  if (from === to) return true
  const machine = lifecycleMachines[machineName] as LifecycleDefinition
  return machine.transitions[from]?.includes(to) ?? false
}

export function assertLifecycleTransition(machineName: LifecycleName, from: string, to: string) {
  const machine = lifecycleMachines[machineName] as LifecycleDefinition
  if (!canTransition(machineName, from, to)) {
    throw new Error(`${machine.label} cannot transition from ${from} to ${to}.`)
  }
  return { changed: from !== to, from, to }
}

export function getLifecycleTarget(machineName: LifecycleName, action: string) {
  const machine = lifecycleMachines[machineName] as LifecycleDefinition
  const target = machine.actions[action]
  if (!target) throw new Error(`Unsupported ${machine.label} action: ${action}.`)
  return target
}

export function lifecycleHooks(machineName: LifecycleName, statusField = 'status') {
  return {
    validate({ operation, item, resolvedData, addValidationError }: any) {
      if (operation !== 'update') return
      const current = String(item?.[statusField] ?? '')
      const next = resolvedData?.[statusField]
      if (next === undefined || next === current) return
      try {
        assertLifecycleTransition(machineName, current, String(next))
      } catch (error) {
        addValidationError(error instanceof Error ? error.message : 'Invalid lifecycle transition.')
      }
    },
  }
}
