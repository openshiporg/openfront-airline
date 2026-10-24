'use client'

// Client building blocks for the network and fares desks: the form sheet, inline errors, checkboxes and the
// status-transition pills.

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Notice, Pill, Track } from '@/features/platform/components/desk'
import { cn } from '@/lib/utils'
import type { ActionResult, Transition } from '@/features/platform/network/lib/desk-shared'

export function FormSheet({
  open,
  onOpenChange,
  title,
  submitLabel,
  pending,
  error,
  onSubmit,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  submitLabel: string
  pending: boolean
  error: string | null
  onSubmit: () => void
  children: React.ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={next => { if (!pending) onOpenChange(next) }}>
      <SheetContent side="right" className="flex w-full max-w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md" aria-describedby={undefined}>
        <SheetHeader className="border-b px-4 py-4 pr-12 text-left sm:px-6">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <form
          noValidate
          className="flex min-w-0 flex-1 flex-col gap-4 px-4 py-4 sm:px-6"
          onSubmit={event => { event.preventDefault(); if (!pending) onSubmit() }}
        >
          {children}
          {error && <Notice tone="bad">{error}</Notice>}
          <div className="mt-auto flex justify-end pt-2">
            <Track>
              <Pill onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Pill>
              <Pill type="submit" variant="primary" disabled={pending}>{pending ? 'Saving' : submitLabel}</Pill>
            </Track>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

/** Labelled field with an inline validation message. */
export function FormField({
  label,
  error,
  children,
  className,
  htmlFor,
}: {
  label: React.ReactNode
  error?: string | null
  children: React.ReactNode
  className?: string
  htmlFor?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

export function CheckField({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex min-w-0 items-center gap-2 text-sm text-foreground">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} className="size-4 rounded border accent-foreground" />
      {label}
    </label>
  )
}

/** Runs a server action, refreshes on success and keeps the error for inline display. */
export function useDeskAction() {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const run = React.useCallback((action: () => Promise<ActionResult>, onSuccess?: () => void) => {
    setError(null)
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) { setError(result.error); return }
        onSuccess?.()
        router.refresh()
      } catch {
        setError('The request failed. Try again.')
      }
    })
  }, [router])
  return { pending, error, setError, run }
}

/** Explicit lifecycle actions for one row. */
export function TransitionPills({
  transitions,
  onTransition,
  disabled,
  onEdit,
  children,
}: {
  transitions: readonly Transition[]
  onTransition: (to: string) => void
  disabled?: boolean
  onEdit?: () => void
  children?: React.ReactNode
}) {
  if (!transitions.length && !onEdit && !children) return null
  return (
    <Track aria-label="Actions">
      {onEdit && <Pill size="sm" onClick={onEdit} disabled={disabled}>Edit</Pill>}
      {transitions.map(transition => (
        <Pill
          key={transition.to}
          size="sm"
          disabled={disabled}
          onClick={() => onTransition(transition.to)}
          className={transition.variant === 'danger' ? 'text-red-600 dark:text-red-400' : undefined}
        >
          {transition.label}
        </Pill>
      ))}
      {children}
    </Track>
  )
}

/** One list row: title line and figures on the left, actions on the right, error below. */
export function DeskRow({ children, actions, error }: { children: React.ReactNode; actions?: React.ReactNode; error?: string | null }) {
  return (
    <li className="min-w-0 px-4 py-3">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">{children}</div>
        {actions && <div className="flex min-w-0 max-w-full shrink-0">{actions}</div>}
      </div>
      {error && <Notice tone="bad" className="mt-2">{error}</Notice>}
    </li>
  )
}
