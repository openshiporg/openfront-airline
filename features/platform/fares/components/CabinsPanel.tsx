'use client'

import * as React from 'react'

import { Code, DeskSection, Panel, Pill, TitleLine, Track, Well, deskInput } from '@/features/platform/components/desk'
import { createCabinAction, updateCabinAction } from '@/features/platform/fares/actions/fares'
import { CABIN_CLASSES, type CabinRow } from '@/features/platform/fares/lib/types'
import { DeskRow, FormField, FormSheet, TransitionPills, useDeskAction } from '@/features/platform/network/components/DeskForm'
import { wholeNumber } from '@/features/platform/network/lib/desk-shared'

type Values = { code: string; name: string; cabinClass: string; displayOrder: string }
type Errors = Partial<Record<keyof Values, string>>

const classLabel = (value: string | null) => CABIN_CLASSES.find(option => option.value === value)?.label ?? 'No class'

export function CabinsPanel({ cabins, total, pager }: { cabins: CabinRow[]; total: number; pager: React.ReactNode }) {
  const [editing, setEditing] = React.useState<CabinRow | 'new' | null>(null)
  const [values, setValues] = React.useState<Values>({ code: '', name: '', cabinClass: 'economy', displayOrder: '0' })
  const [errors, setErrors] = React.useState<Errors>({})
  const action = useDeskAction()

  function open(cabin: CabinRow | 'new') {
    setErrors({})
    action.setError(null)
    setValues(cabin === 'new'
      ? { code: '', name: '', cabinClass: 'economy', displayOrder: String(total) }
      : { code: cabin.code, name: cabin.name, cabinClass: cabin.cabinClass ?? 'economy', displayOrder: String(cabin.displayOrder ?? 0) })
    setEditing(cabin)
  }

  function submit() {
    const nextErrors: Errors = {}
    if (!/^[A-Z0-9_-]{1,32}$/i.test(values.code.trim())) nextErrors.code = 'Letters, digits, dashes or underscores.'
    if (!values.name.trim()) nextErrors.name = 'Required.'
    const order = wholeNumber(values.displayOrder, { max: 999 })
    if (!order.ok) nextErrors.displayOrder = order.error
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length || !order.ok) return
    const input = { code: values.code, name: values.name, cabinClass: values.cabinClass, displayOrder: order.value ?? 0 }
    const target = editing
    action.run(() => target && target !== 'new' ? updateCabinAction(target.id, input) : createCabinAction(input), () => setEditing(null))
  }

  return (
    <DeskSection title="Cabins" count={total} actions={<Track><Pill variant="primary" size="sm" onClick={() => open('new')}>New cabin</Pill></Track>}>
      <div className="space-y-3">
        {cabins.length === 0 ? <Well>No cabins</Well> : (
          <Panel>
            <ul className="divide-y">
              {cabins.map(cabin => (
                <DeskRow key={cabin.id} actions={<TransitionPills transitions={[]} onTransition={() => undefined} onEdit={() => open(cabin)} />}>
                  <TitleLine className="text-sm font-medium text-foreground">
                    <span className="font-mono font-semibold tabular-nums">{cabin.code}</span>
                    <span className="ml-2">{cabin.name}</span>
                  </TitleLine>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{classLabel(cabin.cabinClass)}</span>
                    <Code>Order {cabin.displayOrder ?? 0}</Code>
                    <span className="font-mono tabular-nums">{cabin.fareBrandsCount ?? 0} fare brands</span>
                  </div>
                </DeskRow>
              ))}
            </ul>
          </Panel>
        )}
        {pager}
      </div>

      <FormSheet
        open={editing !== null}
        onOpenChange={next => { if (!next) setEditing(null) }}
        title={editing === 'new' ? 'New cabin' : 'Edit cabin'}
        submitLabel={editing === 'new' ? 'Create cabin' : 'Save cabin'}
        pending={action.pending}
        error={action.error}
        onSubmit={submit}
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Code" error={errors.code} htmlFor="cabin-code">
            <input id="cabin-code" value={values.code} onChange={event => setValues(current => ({ ...current, code: event.target.value }))} maxLength={32} autoComplete="off" className={`${deskInput} font-mono uppercase`} aria-invalid={Boolean(errors.code)} />
          </FormField>
          <FormField label="Display order" error={errors.displayOrder} htmlFor="cabin-order">
            <input id="cabin-order" inputMode="numeric" value={values.displayOrder} onChange={event => setValues(current => ({ ...current, displayOrder: event.target.value }))} className={`${deskInput} font-mono tabular-nums`} aria-invalid={Boolean(errors.displayOrder)} />
          </FormField>
        </div>
        <FormField label="Name" error={errors.name} htmlFor="cabin-name">
          <input id="cabin-name" value={values.name} onChange={event => setValues(current => ({ ...current, name: event.target.value }))} maxLength={80} className={deskInput} aria-invalid={Boolean(errors.name)} />
        </FormField>
        <FormField label="Cabin class" htmlFor="cabin-class">
          <select id="cabin-class" value={values.cabinClass} onChange={event => setValues(current => ({ ...current, cabinClass: event.target.value }))} className={deskInput}>
            {CABIN_CLASSES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </FormField>
      </FormSheet>
    </DeskSection>
  )
}
