'use client'

import * as React from 'react'

import { DeskSection, Panel, Pill, StatusLabel, TitleLine, Track, Well, deskInput, statusTone } from '@/features/platform/components/desk'
import { createFareBrandAction, setFareBrandStatusAction, updateFareBrandAction } from '@/features/platform/fares/actions/fares'
import { baggageOf, type CabinOption, type FareBrandRow } from '@/features/platform/fares/lib/types'
import { DeskRow, FormField, FormSheet, TransitionPills, useDeskAction } from '@/features/platform/network/components/DeskForm'
import { PRODUCT_TRANSITIONS, wholeNumber } from '@/features/platform/network/lib/desk-shared'

type Values = { code: string; name: string; description: string; cabinId: string; displayOrder: string; pieces: string; weightKg: string }
type Errors = Partial<Record<keyof Values, string>>

function formatKg(grams: number) {
  return `${Number((grams / 1000).toFixed(1))} kg`
}

function BrandItem({ brand, onEdit }: { brand: FareBrandRow; onEdit: () => void }) {
  const action = useDeskAction()
  const baggage = baggageOf(brand.includedBaggage)
  return (
    <DeskRow
      error={action.error}
      actions={
        <TransitionPills
          transitions={PRODUCT_TRANSITIONS[brand.status] ?? []}
          disabled={action.pending}
          onEdit={brand.status === 'archived' ? undefined : onEdit}
          onTransition={to => action.run(() => setFareBrandStatusAction(brand.id, to))}
        />
      }
    >
      <TitleLine tone={statusTone(brand.status)} status={brand.status} className="text-sm font-medium text-foreground">
        <span className="font-semibold">{brand.name}</span>
        {brand.code.toUpperCase() !== brand.name.toUpperCase() && <span className="ml-2 tabular-nums text-muted-foreground">{brand.code}</span>}
      </TitleLine>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <StatusLabel status={brand.status} />
        <span>{brand.cabin ? `${brand.cabin.name} (${brand.cabin.code})` : 'No cabin'}</span>
        <span className="tabular-nums ">
          {baggage.pieces === 0 ? 'No checked bags' : `${baggage.pieces} x ${baggage.maxWeightGrams ? formatKg(baggage.maxWeightGrams) : 'bag'}`}
        </span>
        <span className="tabular-nums ">{brand.rulesCount ?? 0} rules</span>
        <span className="tabular-nums">Position {(brand.displayOrder ?? 0) + 1}</span>
      </div>
      {brand.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{brand.description}</p>}
    </DeskRow>
  )
}

export function FareBrandsPanel({
  brands,
  total,
  cabins,
  statusTabs,
  pager,
}: {
  brands: FareBrandRow[]
  total: number
  cabins: CabinOption[]
  statusTabs: React.ReactNode
  pager: React.ReactNode
}) {
  const [editing, setEditing] = React.useState<FareBrandRow | 'new' | null>(null)
  const [values, setValues] = React.useState<Values>({ code: '', name: '', description: '', cabinId: '', displayOrder: '0', pieces: '0', weightKg: '' })
  const [errors, setErrors] = React.useState<Errors>({})
  const action = useDeskAction()

  function open(brand: FareBrandRow | 'new') {
    setErrors({})
    action.setError(null)
    if (brand === 'new') {
      setValues({ code: '', name: '', description: '', cabinId: cabins[0]?.id ?? '', displayOrder: '0', pieces: '0', weightKg: '' })
    } else {
      const baggage = baggageOf(brand.includedBaggage)
      setValues({
        code: brand.code,
        name: brand.name,
        description: brand.description ?? '',
        cabinId: brand.cabin?.id ?? '',
        displayOrder: String(brand.displayOrder ?? 0),
        pieces: String(baggage.pieces),
        weightKg: baggage.maxWeightGrams ? String(baggage.maxWeightGrams / 1000) : '',
      })
    }
    setEditing(brand)
  }

  const set = (field: keyof Values) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValues(current => ({ ...current, [field]: event.target.value }))

  function submit() {
    const nextErrors: Errors = {}
    if (!/^[A-Z0-9_-]{1,32}$/i.test(values.code.trim())) nextErrors.code = 'Letters, digits, dashes or underscores.'
    if (!values.name.trim()) nextErrors.name = 'Required.'
    if (!values.cabinId) nextErrors.cabinId = 'Required.'
    const order = wholeNumber(values.displayOrder, { max: 999 })
    if (!order.ok) nextErrors.displayOrder = order.error
    const pieces = wholeNumber(values.pieces, { max: 10 })
    if (!pieces.ok) nextErrors.pieces = pieces.error
    const weightText = values.weightKg.trim()
    const weightKg = weightText ? Number(weightText) : 0
    if (weightText && (!/^\d+(\.\d{1,3})?$/.test(weightText) || weightKg > 100)) nextErrors.weightKg = '0 to 100 kg.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length || !order.ok || !pieces.ok) return
    const input = {
      code: values.code,
      name: values.name,
      description: values.description,
      cabinId: values.cabinId,
      displayOrder: order.value ?? 0,
      baggagePieces: pieces.value ?? 0,
      baggageMaxWeightGrams: Math.round(weightKg * 1000),
    }
    const target = editing
    action.run(() => target && target !== 'new' ? updateFareBrandAction(target.id, input) : createFareBrandAction(input), () => setEditing(null))
  }

  const cabinOptions = editing && editing !== 'new' && editing.cabin && !cabins.some(cabin => cabin.id === editing.cabin?.id) ? [editing.cabin, ...cabins] : cabins

  return (
    <DeskSection title="Fare brands" count={total} actions={<Track><Pill variant="primary" size="sm" onClick={() => open('new')}>New fare brand</Pill></Track>}>
      <div className="space-y-3">
        {statusTabs}
        {brands.length === 0 ? <Well>No fare brands</Well> : (
          <Panel>
            <ul className="divide-y">
              {brands.map(brand => <BrandItem key={brand.id} brand={brand} onEdit={() => open(brand)} />)}
            </ul>
          </Panel>
        )}
        {pager}
      </div>

      <FormSheet
        open={editing !== null}
        onOpenChange={next => { if (!next) setEditing(null) }}
        title={editing === 'new' ? 'New fare brand' : 'Edit fare brand'}
        submitLabel={editing === 'new' ? 'Create fare brand' : 'Save fare brand'}
        pending={action.pending}
        error={action.error}
        onSubmit={submit}
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Code" error={errors.code} htmlFor="brand-code">
            <input id="brand-code" value={values.code} onChange={set('code')} maxLength={32} autoComplete="off" className={`${deskInput} tabular-nums uppercase`} aria-invalid={Boolean(errors.code)} />
          </FormField>
          <FormField label="Display order" error={errors.displayOrder} htmlFor="brand-order">
            <input id="brand-order" inputMode="numeric" value={values.displayOrder} onChange={set('displayOrder')} className={`${deskInput} tabular-nums `} aria-invalid={Boolean(errors.displayOrder)} />
          </FormField>
        </div>
        <FormField label="Name" error={errors.name} htmlFor="brand-name">
          <input id="brand-name" value={values.name} onChange={set('name')} maxLength={80} className={deskInput} aria-invalid={Boolean(errors.name)} />
        </FormField>
        <FormField label="Cabin" error={errors.cabinId} htmlFor="brand-cabin">
          <select id="brand-cabin" value={values.cabinId} onChange={set('cabinId')} className={deskInput} aria-invalid={Boolean(errors.cabinId)}>
            <option value="">Select cabin</option>
            {cabinOptions.map(cabin => <option key={cabin.id} value={cabin.id}>{cabin.code} {cabin.name}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Included bags" error={errors.pieces} htmlFor="brand-pieces">
            <input id="brand-pieces" inputMode="numeric" value={values.pieces} onChange={set('pieces')} className={`${deskInput} tabular-nums `} aria-invalid={Boolean(errors.pieces)} />
          </FormField>
          <FormField label="Max weight per bag (kg)" error={errors.weightKg} htmlFor="brand-weight">
            <input id="brand-weight" inputMode="decimal" value={values.weightKg} onChange={set('weightKg')} className={`${deskInput} tabular-nums `} aria-invalid={Boolean(errors.weightKg)} />
          </FormField>
        </div>
        <FormField label="Description" htmlFor="brand-description">
          <textarea id="brand-description" value={values.description} onChange={set('description')} maxLength={1000} rows={3} className={`${deskInput} h-auto py-2`} />
        </FormField>
      </FormSheet>
    </DeskSection>
  )
}
