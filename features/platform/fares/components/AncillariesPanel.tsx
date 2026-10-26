'use client'

import * as React from 'react'

import { Code, DeskSection, Panel, Pill, StatusLabel, TitleLine, Track, Well, deskInput, statusTone } from '@/features/platform/components/desk'
import { createAncillaryAction, setAncillaryStatusAction, updateAncillaryAction } from '@/features/platform/fares/actions/fares'
import { ANCILLARY_TYPES, FULFILLMENT_TYPES, type AncillaryRow } from '@/features/platform/fares/lib/types'
import { CheckField, DeskRow, FormField, FormSheet, TransitionPills, useDeskAction } from '@/features/platform/network/components/DeskForm'
import { formatMinor, majorToMinor, minorToInput, PRODUCT_TRANSITIONS } from '@/features/platform/network/lib/desk-shared'

type Values = { code: string; name: string; description: string; type: string; fulfillmentType: string; price: string; tax: string; requiresInventory: boolean }
type Errors = Partial<Record<keyof Values, string>>

const typeLabel = (value: string) => ANCILLARY_TYPES.find(option => option.value === value)?.label ?? value

function AncillaryItem({ product, onEdit }: { product: AncillaryRow; onEdit: () => void }) {
  const action = useDeskAction()
  return (
    <DeskRow
      error={action.error}
      actions={
        <TransitionPills
          transitions={PRODUCT_TRANSITIONS[product.status] ?? []}
          disabled={action.pending}
          onEdit={product.status === 'archived' ? undefined : onEdit}
          onTransition={to => action.run(() => setAncillaryStatusAction(product.id, to))}
        />
      }
    >
      <TitleLine tone={statusTone(product.status)} status={product.status} className="text-sm font-medium text-foreground">
        <span className="tabular-nums font-semibold ">{product.code}</span>
        <span className="ml-2">{product.name}</span>
      </TitleLine>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <StatusLabel status={product.status} />
        <span>{typeLabel(product.type)}</span>
        <span className="tabular-nums  text-foreground">{formatMinor(product.defaultPriceAmount, product.currencyCode)}</span>
        <span className="tabular-nums ">Tax {formatMinor(product.taxAmount, product.currencyCode)}</span>
        <span>{product.fulfillmentType === 'standalone' ? 'Standalone' : 'Per flight'}</span>
        {product.requiresInventory && <span>Inventory controlled</span>}
        <Code>{product.productKey}</Code>
      </div>
    </DeskRow>
  )
}

export function AncillariesPanel({
  products,
  total,
  currencyCode,
  statusTabs,
  pager,
}: {
  products: AncillaryRow[]
  total: number
  currencyCode: string
  statusTabs: React.ReactNode
  pager: React.ReactNode
}) {
  const [editing, setEditing] = React.useState<AncillaryRow | 'new' | null>(null)
  const [values, setValues] = React.useState<Values>({ code: '', name: '', description: '', type: 'checked_bag', fulfillmentType: 'associated', price: '', tax: '', requiresInventory: false })
  const [errors, setErrors] = React.useState<Errors>({})
  const action = useDeskAction()
  const formCurrency = editing && editing !== 'new' ? editing.currencyCode : currencyCode

  function open(product: AncillaryRow | 'new') {
    setErrors({})
    action.setError(null)
    setValues(product === 'new'
      ? { code: '', name: '', description: '', type: 'checked_bag', fulfillmentType: 'associated', price: '', tax: '', requiresInventory: false }
      : {
        code: product.code,
        name: product.name,
        description: product.description ?? '',
        type: product.type,
        fulfillmentType: product.fulfillmentType ?? 'associated',
        price: minorToInput(product.defaultPriceAmount, product.currencyCode),
        tax: minorToInput(product.taxAmount, product.currencyCode),
        requiresInventory: product.requiresInventory,
      })
    setEditing(product)
  }

  const set = (field: keyof Values) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = event.target.value
    setValues(current => ({ ...current, [field]: value }))
  }

  function submit() {
    const nextErrors: Errors = {}
    if (!/^[A-Z0-9_-]{1,32}$/i.test(values.code.trim())) nextErrors.code = 'Letters, digits, dashes or underscores.'
    if (!values.name.trim()) nextErrors.name = 'Required.'
    const price = majorToMinor(values.price, formCurrency)
    if (!price.ok) nextErrors.price = price.error
    const tax = majorToMinor(values.tax, formCurrency)
    if (!tax.ok) nextErrors.tax = tax.error
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length || !price.ok || !tax.ok) return
    const input = {
      code: values.code,
      name: values.name,
      description: values.description,
      type: values.type,
      fulfillmentType: values.fulfillmentType,
      defaultPriceAmount: price.value,
      taxAmount: tax.value,
      requiresInventory: values.requiresInventory,
    }
    const target = editing
    action.run(() => target && target !== 'new' ? updateAncillaryAction(target.id, input) : createAncillaryAction(input), () => setEditing(null))
  }

  return (
    <DeskSection title="Ancillary products" count={total} actions={<Track><Pill variant="primary" size="sm" onClick={() => open('new')}>New product</Pill></Track>}>
      <div className="space-y-3">
        {statusTabs}
        {products.length === 0 ? <Well>No ancillary products</Well> : (
          <Panel>
            <ul className="divide-y">
              {products.map(product => <AncillaryItem key={product.id} product={product} onEdit={() => open(product)} />)}
            </ul>
          </Panel>
        )}
        {pager}
      </div>

      <FormSheet
        open={editing !== null}
        onOpenChange={next => { if (!next) setEditing(null) }}
        title={editing === 'new' ? 'New ancillary product' : 'Edit ancillary product'}
        submitLabel={editing === 'new' ? 'Create product' : 'Save product'}
        pending={action.pending}
        error={action.error}
        onSubmit={submit}
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Code" error={errors.code} htmlFor="product-code">
            <input id="product-code" value={values.code} onChange={set('code')} maxLength={32} autoComplete="off" disabled={editing !== null && editing !== 'new'} className={`${deskInput} tabular-nums uppercase`} aria-invalid={Boolean(errors.code)} />
          </FormField>
          <FormField label="Type" htmlFor="product-type">
            <select id="product-type" value={values.type} onChange={set('type')} className={deskInput}>
              {ANCILLARY_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </FormField>
        </div>
        <FormField label="Name" error={errors.name} htmlFor="product-name">
          <input id="product-name" value={values.name} onChange={set('name')} maxLength={120} className={deskInput} aria-invalid={Boolean(errors.name)} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={`Price (${formCurrency})`} error={errors.price} htmlFor="product-price">
            <input id="product-price" inputMode="decimal" value={values.price} onChange={set('price')} placeholder="0" className={`${deskInput} tabular-nums `} aria-invalid={Boolean(errors.price)} />
          </FormField>
          <FormField label={`Tax (${formCurrency})`} error={errors.tax} htmlFor="product-tax">
            <input id="product-tax" inputMode="decimal" value={values.tax} onChange={set('tax')} placeholder="0" className={`${deskInput} tabular-nums `} aria-invalid={Boolean(errors.tax)} />
          </FormField>
        </div>
        <FormField label="Fulfillment" htmlFor="product-fulfillment">
          <select id="product-fulfillment" value={values.fulfillmentType} onChange={set('fulfillmentType')} className={deskInput}>
            {FULFILLMENT_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </FormField>
        <CheckField label="Requires inventory" checked={values.requiresInventory} onChange={checked => setValues(current => ({ ...current, requiresInventory: checked }))} />
        <FormField label="Description" htmlFor="product-description">
          <textarea id="product-description" value={values.description} onChange={set('description')} maxLength={1000} rows={3} className={`${deskInput} h-auto py-2`} />
        </FormField>
      </FormSheet>
    </DeskSection>
  )
}
