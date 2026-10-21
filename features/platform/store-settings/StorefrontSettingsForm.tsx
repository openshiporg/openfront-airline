'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { STOREFRONT_BRAND_COLORS, normalizeStorefrontBrandColor } from '@/features/airline/lib/branding'
import { updateStorefrontSettings } from './actions'

type Settings = {
  name: string
  legalName: string
  storefrontBrandColor?: string | null
  storefrontHomepageTitle?: string | null
  storefrontHomepageDescription?: string | null
}

export function StorefrontSettingsForm({ initialSettings }: { initialSettings: Settings }) {
  const [form, setForm] = useState({
    name: initialSettings.name,
    legalName: initialSettings.legalName,
    storefrontBrandColor: normalizeStorefrontBrandColor(initialSettings.storefrontBrandColor) ?? '',
    storefrontHomepageTitle: initialSettings.storefrontHomepageTitle ?? '',
    storefrontHomepageDescription: initialSettings.storefrontHomepageDescription ?? '',
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
        const accepted = { name: saved.name, legalName: saved.legalName, storefrontBrandColor: normalizeStorefrontBrandColor(saved.storefrontBrandColor) ?? '', storefrontHomepageTitle: saved.storefrontHomepageTitle, storefrontHomepageDescription: saved.storefrontHomepageDescription }
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

  return <form onSubmit={event => { event.preventDefault(); save() }} className="space-y-6">
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Public carrier identity</h2>
      <p className="mt-1 text-sm text-muted-foreground">Your airline name appears in public navigation and the footer.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div><Label htmlFor="storefront-name">Carrier name</Label><Input id="storefront-name" className="mt-2" maxLength={120} required value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></div>
        <div><Label htmlFor="storefront-legal-name">Legal name</Label><Input id="storefront-legal-name" className="mt-2" maxLength={160} required value={form.legalName} onChange={event => setForm(current => ({ ...current, legalName: event.target.value }))} /></div>
      </div>
    </section>

    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Homepage content</h2>
      <p className="mt-1 text-sm text-muted-foreground">Complete these fields to publish your booking homepage. Existing booking services remain available.</p>
      <div className="mt-5 space-y-4">
        <div><Label htmlFor="storefront-title">Homepage title</Label><Input id="storefront-title" className="mt-2" maxLength={120} placeholder="Find your next flight" required value={form.storefrontHomepageTitle} onChange={event => setForm(current => ({ ...current, storefrontHomepageTitle: event.target.value }))} /></div>
        <div><Label htmlFor="storefront-description">Homepage description</Label><Textarea id="storefront-description" className="mt-2 min-h-24" maxLength={320} placeholder="Describe the public booking experience without making provider or operational claims." required value={form.storefrontHomepageDescription} onChange={event => setForm(current => ({ ...current, storefrontHomepageDescription: event.target.value }))} /></div>
      </div>
    </section>

    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Approved brand color</h2>
      <p className="mt-1 text-sm text-muted-foreground">Choose the color used on your public booking pages.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label="Approved storefront colors">
        {STOREFRONT_BRAND_COLORS.map(option => {
          const selected = form.storefrontBrandColor === option.value
          return <label key={option.value} className={cn('relative flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm font-medium focus-within:ring-2 focus-within:ring-ring', selected && 'ring-2 ring-ring')}>
            <input type="radio" className="sr-only" name="storefrontBrandColor" value={option.value} checked={selected} required onChange={() => setForm(current => ({ ...current, storefrontBrandColor: option.value }))} />
            <span className="grid size-6 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: option.hex }}>{selected ? <Check className="size-3.5" /> : null}</span>{option.label}
          </label>
        })}
      </div>
    </section>

    <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={isPending || !dirty}>{isPending ? 'Saving…' : 'Save storefront settings'}</Button><Button type="button" variant="outline" disabled={isPending || !dirty} onClick={() => { if (window.confirm('Discard unsaved settings changes?')) { setForm(baseline); setMessage('Changes discarded.') } }}>Discard changes</Button>{dirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}{message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}</div>
  </form>
}
