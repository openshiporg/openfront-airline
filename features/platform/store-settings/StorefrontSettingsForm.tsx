'use client'

import { useEffect, useRef, useState, useTransition } from 'react'

import { DeskSection, Field, Notice, Panel, Pill, StatusDot, Track, deskInput } from '@/features/platform/components/desk'
import { cn } from '@/lib/utils'
import { STOREFRONT_BRAND_COLORS, normalizeStorefrontBrandColor } from '@/features/airline/lib/branding'
import { updateStorefrontSettings } from './actions'

type Settings = {
  name: string
  legalName: string
  storefrontBrandColor?: string | null
  storefrontHomepageTitle?: string | null
  storefrontHomepageDescription?: string | null
  storefrontContactEmail?: string | null
  storefrontContactPhone?: string | null
  storefrontServiceHours?: string | null
}

export function StorefrontSettingsForm({ initialSettings }: { initialSettings: Settings }) {
  const [form, setForm] = useState({
    name: initialSettings.name,
    legalName: initialSettings.legalName,
    storefrontBrandColor: normalizeStorefrontBrandColor(initialSettings.storefrontBrandColor) ?? '',
    storefrontHomepageTitle: initialSettings.storefrontHomepageTitle ?? '',
    storefrontHomepageDescription: initialSettings.storefrontHomepageDescription ?? '',
    storefrontContactEmail: initialSettings.storefrontContactEmail ?? '',
    storefrontContactPhone: initialSettings.storefrontContactPhone ?? '',
    storefrontServiceHours: initialSettings.storefrontServiceHours ?? '',
  })
  const [message, setMessage] = useState('')
  const [baseline, setBaseline] = useState(form)
  const saveInFlight = useRef(false)
  const [isPending, startTransition] = useTransition()
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline)

  useEffect(() => {
    if (!dirty && !isPending) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, isPending])

  function save() {
    if (saveInFlight.current) return
    saveInFlight.current = true
    const submitted = { ...form }
    setMessage('')
    startTransition(async () => {
      try {
        const saved = await updateStorefrontSettings(submitted)
        if (!saved?.id) throw new Error('Missing saved settings')
        const accepted = { name: saved.name, legalName: saved.legalName, storefrontBrandColor: normalizeStorefrontBrandColor(saved.storefrontBrandColor) ?? '', storefrontHomepageTitle: saved.storefrontHomepageTitle, storefrontHomepageDescription: saved.storefrontHomepageDescription, storefrontContactEmail: saved.storefrontContactEmail ?? '', storefrontContactPhone: saved.storefrontContactPhone ?? '', storefrontServiceHours: saved.storefrontServiceHours ?? '' }
        setBaseline(accepted)
        setForm(current => JSON.stringify(current) === JSON.stringify(submitted) ? accepted : current)
        setMessage('Submitted settings saved.')
      } catch {
        setMessage('Storefront settings could not be saved. Your changes are still here.')
      } finally {
        saveInFlight.current = false
      }
    })
  }

  const brand = STOREFRONT_BRAND_COLORS.find(option => option.value === form.storefrontBrandColor) ?? null
  const failed = message.includes('could not')

  return <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
    <form onSubmit={event => { event.preventDefault(); save() }} className="min-w-0 space-y-6">
      <DeskSection title="Carrier identity">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Carrier name"><input id="storefront-name" className={deskInput} maxLength={120} required value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></Field>
          <Field label="Legal name"><input id="storefront-legal-name" className={deskInput} maxLength={160} required value={form.legalName} onChange={event => setForm(current => ({ ...current, legalName: event.target.value }))} /></Field>
        </div>
      </DeskSection>

      <DeskSection title="Homepage">
        <div className="space-y-4">
          <Field label="Homepage title"><input id="storefront-title" className={deskInput} maxLength={120} placeholder="Find your next flight" required value={form.storefrontHomepageTitle} onChange={event => setForm(current => ({ ...current, storefrontHomepageTitle: event.target.value }))} /></Field>
          <Field label="Homepage description"><textarea id="storefront-description" className={cn(deskInput, 'h-auto min-h-24 py-2')} maxLength={320} required value={form.storefrontHomepageDescription} onChange={event => setForm(current => ({ ...current, storefrontHomepageDescription: event.target.value }))} /></Field>
        </div>
      </DeskSection>

      <DeskSection title="Customer service">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email"><input type="email" className={deskInput} maxLength={254} value={form.storefrontContactEmail} onChange={event => setForm(current => ({ ...current, storefrontContactEmail: event.target.value }))} /></Field>
          <Field label="Phone"><input type="tel" className={cn(deskInput, 'font-mono')} maxLength={40} value={form.storefrontContactPhone} onChange={event => setForm(current => ({ ...current, storefrontContactPhone: event.target.value }))} /></Field>
          <Field label="Hours" className="sm:col-span-2"><input className={deskInput} maxLength={200} placeholder="Daily 06:00–22:00 ET" value={form.storefrontServiceHours} onChange={event => setForm(current => ({ ...current, storefrontServiceHours: event.target.value }))} /></Field>
        </div>
      </DeskSection>

      <DeskSection title="Brand colour">
        <Track role="radiogroup" aria-label="Brand colour" className="flex-wrap rounded-2xl">
          {STOREFRONT_BRAND_COLORS.map(option => {
            const selected = form.storefrontBrandColor === option.value
            return <Pill key={option.value} asChild active={selected} className="cursor-pointer focus-within:ring-2 focus-within:ring-ring">
              <label>
                <input type="radio" className="sr-only" name="storefrontBrandColor" value={option.value} checked={selected} required onChange={() => setForm(current => ({ ...current, storefrontBrandColor: option.value }))} />
                <span aria-hidden="true" className="size-3 rounded-full ring-1 ring-black/10 dark:ring-white/20" style={{ backgroundColor: option.hex }} />
                {option.label}
              </label>
            </Pill>
          })}
        </Track>
      </DeskSection>

      <div className="flex flex-wrap items-center gap-3">
        <Track>
          <Pill type="submit" variant="primary" disabled={isPending || !dirty}>{isPending ? 'Saving…' : 'Save'}</Pill>
          <Pill disabled={isPending || !dirty} onClick={() => { if (window.confirm('Discard unsaved settings changes?')) { setForm(baseline); setMessage('Changes discarded.') } }}>Discard</Pill>
        </Track>
        {dirty && <span className="inline-flex items-baseline gap-2 text-sm text-muted-foreground"><StatusDot tone="warn" className="-translate-y-[0.05em] size-1.5 shadow-none" />Unsaved changes</span>}
      </div>
      {message ? <Notice tone={failed ? 'bad' : 'ok'} role="status">{message}</Notice> : null}
    </form>

    <aside aria-label="Storefront preview" className="min-w-0 lg:sticky lg:top-4">
      <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Preview</p>
      <Panel className="overflow-hidden">
        <div className="flex min-w-0 items-center justify-between gap-3 border-b bg-background px-4 py-3">
          <span className="min-w-0 truncate text-sm font-semibold text-foreground">{form.name || 'Carrier name'}</span>
          <span className="shrink-0 rounded-full px-3 py-1 text-xs font-medium text-white" style={{ backgroundColor: (brand ?? STOREFRONT_BRAND_COLORS[0]).hex }}>Book</span>
        </div>
        <div className="px-4 py-8 text-white" style={{ backgroundColor: (brand ?? STOREFRONT_BRAND_COLORS[0]).hex }}>
          <p className="break-words text-xl font-semibold tracking-tight">{form.storefrontHomepageTitle || 'Homepage title'}</p>
          <p className="mt-2 break-words text-sm text-white/80">{form.storefrontHomepageDescription || 'Homepage description'}</p>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3 bg-background px-4 py-2 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">{form.legalName || 'Legal name'}</span>
          <span className="shrink-0">{brand?.label ?? 'No colour'}</span>
        </div>
      </Panel>
    </aside>
  </div>
}
