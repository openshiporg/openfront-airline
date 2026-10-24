import { lifecycleMachines } from '@/features/keystone/lib/lifecycle'
import type { BagAction } from '@/features/platform/baggage/lib/types'

export const BAG_ACTION_LABELS: ReadonlyArray<{ action: BagAction; label: string }> = [
  { action: 'load', label: 'Load' },
  { action: 'transfer', label: 'Transfer' },
  { action: 'arrive', label: 'Arrive' },
  { action: 'deliver', label: 'Deliver' },
  { action: 'delay', label: 'Delay' },
  { action: 'mishandle', label: 'Mishandled' },
  { action: 'close', label: 'Close' },
]

/** Bag actions the lifecycle accepts from the current status (never a no-op). */
export function allowedBagActions(status: string | null | undefined) {
  const machine = lifecycleMachines.bag
  const from = (status ?? '') as keyof typeof machine.transitions
  const targets: readonly string[] = machine.transitions[from] ?? []
  return BAG_ACTION_LABELS.filter(({ action }) => {
    const target = machine.actions[action]
    return target !== status && targets.includes(target)
  })
}

export const BAG_STATUSES = ['accepted', 'loaded', 'in_transit', 'arrived', 'delivered', 'delayed', 'mishandled', 'closed'] as const

export function formatKg(grams: number | null | undefined) {
  if (typeof grams !== 'number' || !Number.isFinite(grams)) return '--'
  return `${(grams / 1000).toFixed(1)} kg`
}
