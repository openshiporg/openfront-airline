'use client'

import * as React from 'react'

import { Code, DeskSection, Panel, Pill, Route, StatusLabel, TitleLine, Track, Well, deskInput, statusTone } from '@/features/platform/components/desk'
import { createFareRuleAction, setFareRuleStatusAction, updateFareRuleAction } from '@/features/platform/fares/actions/fares'
import type { FareBrandOption, FareRouteOption, FareRuleRow } from '@/features/platform/fares/lib/types'
import { CheckField, DeskRow, FormField, FormSheet, TransitionPills, useDeskAction } from '@/features/platform/network/components/DeskForm'
import { dateInput, formatMinor, majorToMinor, minorToInput, PRODUCT_TRANSITIONS, wholeNumber } from '@/features/platform/network/lib/desk-shared'

type Values = {
  fareBrandId: string
  routeId: string
  fareBasisPattern: string
  isRefundable: boolean
  isChangeable: boolean
  changeFee: string
  cancellationFee: string
  noShowFee: string
  advance: string
  minStay: string
  maxStay: string
  effectiveFrom: string
  effectiveTo: string
}
type Errors = Partial<Record<keyof Values, string>>

function RuleItem({ rule, onEdit }: { rule: FareRuleRow; onEdit: () => void }) {
  const action = useDeskAction()
  return (
    <DeskRow
      error={action.error}
      actions={
        <TransitionPills
          transitions={PRODUCT_TRANSITIONS[rule.status] ?? []}
          disabled={action.pending}
          onEdit={rule.status === 'archived' ? undefined : onEdit}
          onTransition={to => action.run(() => setFareRuleStatusAction(rule.id, to))}
        />
      }
    >
      <TitleLine tone={statusTone(rule.status)} status={rule.status} className="text-sm font-medium text-foreground">
        <span className="tabular-nums font-semibold ">{rule.fareBasisPattern || 'Any basis'}</span>
        <span className="ml-2">{rule.fareBrand ? rule.fareBrand.name : 'No brand'}</span>
        {rule.route ? <Route from={rule.route.origin?.iataCode} to={rule.route.destination?.iataCode} className="ml-2" /> : <span className="ml-2 text-muted-foreground">All routes</span>}
      </TitleLine>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <StatusLabel status={rule.status} />
        <span>{rule.isRefundable ? 'Refundable' : 'Non-refundable'}</span>
        <span>{rule.isChangeable ? 'Changeable' : 'No changes'}</span>
        <span className="tabular-nums ">Change {formatMinor(rule.changeFeeAmount, rule.currencyCode)}</span>
        <span className="tabular-nums ">Cancel {formatMinor(rule.cancellationFeeAmount, rule.currencyCode)}</span>
        <span className="tabular-nums ">No-show {formatMinor(rule.noShowFeeAmount, rule.currencyCode)}</span>
        {rule.minimumAdvancePurchaseHours != null && <span className="tabular-nums ">AP {rule.minimumAdvancePurchaseHours} h</span>}
        {(rule.minimumStayDays != null || rule.maximumStayDays != null) && (
          <span className="tabular-nums ">Stay {rule.minimumStayDays ?? 0}-{rule.maximumStayDays ?? 'any'} d</span>
        )}
        {(rule.effectiveFrom || rule.effectiveTo) && <span className="tabular-nums ">{dateInput(rule.effectiveFrom) || 'Open'} / {dateInput(rule.effectiveTo) || 'Open'}</span>}
        <Code>{rule.ruleKey}</Code>
      </div>
    </DeskRow>
  )
}

export function FareRulesPanel({
  rules,
  total,
  brands,
  routes,
  currencyCode,
  statusTabs,
  pager,
}: {
  rules: FareRuleRow[]
  total: number
  brands: FareBrandOption[]
  routes: FareRouteOption[]
  currencyCode: string
  statusTabs: React.ReactNode
  pager: React.ReactNode
}) {
  const [editing, setEditing] = React.useState<FareRuleRow | 'new' | null>(null)
  const [values, setValues] = React.useState<Values | null>(null)
  const [errors, setErrors] = React.useState<Errors>({})
  const action = useDeskAction()
  const formCurrency = editing && editing !== 'new' ? editing.currencyCode : currencyCode

  function open(rule: FareRuleRow | 'new') {
    setErrors({})
    action.setError(null)
    setValues(rule === 'new'
      ? { fareBrandId: brands.find(brand => brand.status !== 'archived')?.id ?? '', routeId: '', fareBasisPattern: '', isRefundable: false, isChangeable: false, changeFee: '', cancellationFee: '', noShowFee: '', advance: '', minStay: '', maxStay: '', effectiveFrom: '', effectiveTo: '' }
      : {
        fareBrandId: rule.fareBrand?.id ?? '',
        routeId: rule.route?.id ?? '',
        fareBasisPattern: rule.fareBasisPattern ?? '',
        isRefundable: rule.isRefundable,
        isChangeable: rule.isChangeable,
        changeFee: minorToInput(rule.changeFeeAmount, rule.currencyCode),
        cancellationFee: minorToInput(rule.cancellationFeeAmount, rule.currencyCode),
        noShowFee: minorToInput(rule.noShowFeeAmount, rule.currencyCode),
        advance: rule.minimumAdvancePurchaseHours != null ? String(rule.minimumAdvancePurchaseHours) : '',
        minStay: rule.minimumStayDays != null ? String(rule.minimumStayDays) : '',
        maxStay: rule.maximumStayDays != null ? String(rule.maximumStayDays) : '',
        effectiveFrom: dateInput(rule.effectiveFrom),
        effectiveTo: dateInput(rule.effectiveTo),
      })
    setEditing(rule)
  }

  const set = (field: keyof Values) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event.target.value
    setValues(current => current ? { ...current, [field]: value } : current)
  }

  function submit() {
    if (!values) return
    const nextErrors: Errors = {}
    if (!values.fareBrandId) nextErrors.fareBrandId = 'Required.'
    const pattern = values.fareBasisPattern.trim().toUpperCase()
    if (pattern && !/^[A-Z0-9*?]{1,32}$/.test(pattern)) nextErrors.fareBasisPattern = 'Letters, digits, * and ?.'
    const changeFee = majorToMinor(values.changeFee, formCurrency)
    if (!changeFee.ok) nextErrors.changeFee = changeFee.error
    const cancellationFee = majorToMinor(values.cancellationFee, formCurrency)
    if (!cancellationFee.ok) nextErrors.cancellationFee = cancellationFee.error
    const noShowFee = majorToMinor(values.noShowFee, formCurrency)
    if (!noShowFee.ok) nextErrors.noShowFee = noShowFee.error
    const advance = wholeNumber(values.advance, { max: 8_760 })
    if (!advance.ok) nextErrors.advance = advance.error
    const minStay = wholeNumber(values.minStay, { max: 365 })
    if (!minStay.ok) nextErrors.minStay = minStay.error
    const maxStay = wholeNumber(values.maxStay, { max: 365 })
    if (!maxStay.ok) nextErrors.maxStay = maxStay.error
    if (minStay.ok && maxStay.ok && minStay.value != null && maxStay.value != null && maxStay.value < minStay.value) nextErrors.maxStay = 'At least the minimum stay.'
    if (values.effectiveFrom && values.effectiveTo && values.effectiveTo < values.effectiveFrom) nextErrors.effectiveTo = 'On or after effective from.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length || !changeFee.ok || !cancellationFee.ok || !noShowFee.ok || !advance.ok || !minStay.ok || !maxStay.ok) return
    const input = {
      fareBrandId: values.fareBrandId,
      routeId: values.routeId,
      fareBasisPattern: pattern,
      isRefundable: values.isRefundable,
      isChangeable: values.isChangeable,
      changeFeeAmount: changeFee.value,
      cancellationFeeAmount: cancellationFee.value,
      noShowFeeAmount: noShowFee.value,
      minimumAdvancePurchaseHours: advance.value,
      minimumStayDays: minStay.value,
      maximumStayDays: maxStay.value,
      effectiveFrom: values.effectiveFrom,
      effectiveTo: values.effectiveTo,
    }
    const target = editing
    action.run(() => target && target !== 'new' ? updateFareRuleAction(target.id, input) : createFareRuleAction(input), () => setEditing(null))
  }

  const brandOptions = editing && editing !== 'new' && editing.fareBrand && !brands.some(brand => brand.id === editing.fareBrand?.id) ? [editing.fareBrand, ...brands] : brands
  const routeOptions = editing && editing !== 'new' && editing.route && !routes.some(route => route.id === editing.route?.id) ? [editing.route, ...routes] : routes

  return (
    <DeskSection title="Fare rules" count={total} actions={<Track><Pill variant="primary" size="sm" onClick={() => open('new')}>New fare rule</Pill></Track>}>
      <div className="space-y-3">
        {statusTabs}
        {rules.length === 0 ? <Well>No fare rules</Well> : (
          <Panel>
            <ul className="divide-y">
              {rules.map(rule => <RuleItem key={rule.id} rule={rule} onEdit={() => open(rule)} />)}
            </ul>
          </Panel>
        )}
        {pager}
      </div>

      <FormSheet
        open={editing !== null && values !== null}
        onOpenChange={next => { if (!next) setEditing(null) }}
        title={editing === 'new' ? 'New fare rule' : 'Edit fare rule'}
        submitLabel={editing === 'new' ? 'Create fare rule' : 'Save fare rule'}
        pending={action.pending}
        error={action.error}
        onSubmit={submit}
      >
        {values && (
          <>
            <FormField label="Fare brand" error={errors.fareBrandId} htmlFor="rule-brand">
              <select id="rule-brand" value={values.fareBrandId} onChange={set('fareBrandId')} className={deskInput} aria-invalid={Boolean(errors.fareBrandId)}>
                <option value="">Select fare brand</option>
                {brandOptions.map(brand => <option key={brand.id} value={brand.id}>{brand.code} {brand.name} ({brand.status})</option>)}
              </select>
            </FormField>
            <FormField label="Route" htmlFor="rule-route">
              <select id="rule-route" value={values.routeId} onChange={set('routeId')} className={`${deskInput} tabular-nums`}>
                <option value="">All routes</option>
                {routeOptions.map(route => <option key={route.id} value={route.id}>{route.origin?.iataCode ?? '---'}-{route.destination?.iataCode ?? '---'} ({route.status})</option>)}
              </select>
            </FormField>
            <FormField label="Fare basis pattern" error={errors.fareBasisPattern} htmlFor="rule-basis">
              <input id="rule-basis" value={values.fareBasisPattern} onChange={set('fareBasisPattern')} maxLength={32} autoComplete="off" placeholder="Y*" className={`${deskInput} tabular-nums uppercase`} aria-invalid={Boolean(errors.fareBasisPattern)} />
            </FormField>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <CheckField label="Refundable" checked={values.isRefundable} onChange={checked => setValues(current => current ? { ...current, isRefundable: checked } : current)} />
              <CheckField label="Changeable" checked={values.isChangeable} onChange={checked => setValues(current => current ? { ...current, isChangeable: checked } : current)} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <FormField label={`Change fee (${formCurrency})`} error={errors.changeFee} htmlFor="rule-change">
                <input id="rule-change" inputMode="decimal" value={values.changeFee} onChange={set('changeFee')} placeholder="0" className={`${deskInput} tabular-nums `} aria-invalid={Boolean(errors.changeFee)} />
              </FormField>
              <FormField label={`Cancel fee (${formCurrency})`} error={errors.cancellationFee} htmlFor="rule-cancel">
                <input id="rule-cancel" inputMode="decimal" value={values.cancellationFee} onChange={set('cancellationFee')} placeholder="0" className={`${deskInput} tabular-nums `} aria-invalid={Boolean(errors.cancellationFee)} />
              </FormField>
              <FormField label={`No-show fee (${formCurrency})`} error={errors.noShowFee} htmlFor="rule-noshow">
                <input id="rule-noshow" inputMode="decimal" value={values.noShowFee} onChange={set('noShowFee')} placeholder="0" className={`${deskInput} tabular-nums `} aria-invalid={Boolean(errors.noShowFee)} />
              </FormField>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Advance (h)" error={errors.advance} htmlFor="rule-advance">
                <input id="rule-advance" inputMode="numeric" value={values.advance} onChange={set('advance')} className={`${deskInput} tabular-nums `} aria-invalid={Boolean(errors.advance)} />
              </FormField>
              <FormField label="Min stay (d)" error={errors.minStay} htmlFor="rule-minstay">
                <input id="rule-minstay" inputMode="numeric" value={values.minStay} onChange={set('minStay')} className={`${deskInput} tabular-nums `} aria-invalid={Boolean(errors.minStay)} />
              </FormField>
              <FormField label="Max stay (d)" error={errors.maxStay} htmlFor="rule-maxstay">
                <input id="rule-maxstay" inputMode="numeric" value={values.maxStay} onChange={set('maxStay')} className={`${deskInput} tabular-nums `} aria-invalid={Boolean(errors.maxStay)} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Effective from" htmlFor="rule-from">
                <input id="rule-from" type="date" value={values.effectiveFrom} onChange={set('effectiveFrom')} className={`${deskInput} tabular-nums `} />
              </FormField>
              <FormField label="Effective to" error={errors.effectiveTo} htmlFor="rule-to">
                <input id="rule-to" type="date" value={values.effectiveTo} onChange={set('effectiveTo')} className={`${deskInput} tabular-nums `} aria-invalid={Boolean(errors.effectiveTo)} />
              </FormField>
            </div>
          </>
        )}
      </FormSheet>
    </DeskSection>
  )
}
