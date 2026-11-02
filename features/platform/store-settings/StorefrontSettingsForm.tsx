'use client'

import { useEffect, useRef, useState, useTransition } from 'react'

import { DeskSection, Field, Notice, Panel, Pill, StatusDot, Track, deskInput } from '@/features/platform/components/desk'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Code } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from './lib/store-logo'
import { HUE_PRESETS, LOGO_ICONS } from './lib/icon-registry'
import { StoreSettingsSaveBar } from './components/StoreSettingsSaveBar'
import { STOREFRONT_BRAND_COLORS, normalizeStorefrontBrandColor } from '@/features/airline/lib/branding'
import { updateStorefrontSettings } from './actions'

type Settings = {
  name: string
  legalName: string
  logoIcon?: string | null
  logoColor?: string | null
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
    logoIcon: initialSettings.logoIcon || DEFAULT_STORE_LOGO_ICON,
    logoColor: normalizeStoreLogoColor(initialSettings.logoColor),
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
        const accepted = { name: saved.name, legalName: saved.legalName, logoIcon: saved.logoIcon || DEFAULT_STORE_LOGO_ICON, logoColor: normalizeStoreLogoColor(saved.logoColor), storefrontBrandColor: normalizeStorefrontBrandColor(saved.storefrontBrandColor) ?? '', storefrontHomepageTitle: saved.storefrontHomepageTitle, storefrontHomepageDescription: saved.storefrontHomepageDescription, storefrontContactEmail: saved.storefrontContactEmail ?? '', storefrontContactPhone: saved.storefrontContactPhone ?? '', storefrontServiceHours: saved.storefrontServiceHours ?? '' }
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

  // Same names as the E-commerce logo block, over this page's form state.
  const logoIcon = form.logoIcon
  const logoColor = form.logoColor
  const setLogoIcon = (value: string) => setForm(current => ({ ...current, logoIcon: value }))
  const setLogoColor = (value: string) => setForm(current => ({ ...current, logoColor: value }))
  // Find matching preset icon, but don't default to first icon if not found
  const selectedIcon = LOGO_ICONS.find((icon) => icon.lightSvg === logoIcon)

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

      <DeskSection title="Logo">
        <div className="grid min-w-0 gap-6">
          {/* Logo Icon Selector */}
          <div>
            <Label>Logo Icon</Label>
            <div className="mt-2 flex items-center gap-2">
              <Select
                value={selectedIcon?.id || ''}
                onValueChange={(id) => {
                  const icon = LOGO_ICONS.find((i) => i.id === id);
                  if (icon) setLogoIcon(icon.lightSvg);
                }}
              >
                <SelectPrimitive.Trigger
                  className={cn(
                    'flex h-12 w-12 shrink-0 rounded-lg border border-input bg-background focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 p-0 overflow-hidden items-center justify-center'
                  )}
                >
                  <div
                    dangerouslySetInnerHTML={{ __html: logoIcon }}
                    style={{ filter: `hue-rotate(${logoColor}deg)` }}
                    className="[&>svg]:w-6 [&>svg]:h-6"
                  />
                </SelectPrimitive.Trigger>
                <SelectContent className="border-border dark:border-blue-700">
                  {LOGO_ICONS.map((icon) => (
                    <SelectItem key={icon.id} value={icon.id}>
                      <span className="flex items-center gap-3">
                        <div
                          dangerouslySetInnerHTML={{ __html: icon.lightSvg }}
                          style={{ filter: `hue-rotate(${logoColor}deg)` }}
                          className="[&>svg]:w-6 [&>svg]:h-6"
                        />
                        <span>
                          <span className="block font-medium text-gray-900 dark:text-gray-100">
                            {icon.name}
                          </span>
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* SVG Code Editor Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 shrink-0"
                    type="button"
                  >
                    <Code className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(500px,calc(100vw-2rem))]" align="start">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Edit SVG Code</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Edit the SVG code directly. Changes will be reflected in the icon preview.
                      </p>
                    </div>
                    <Textarea
                      value={logoIcon}
                      onChange={(e) => setLogoIcon(e.target.value)}
                      className="font-mono text-xs min-h-[300px]"
                      placeholder="<svg>...</svg>"
                    />
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-muted-foreground">Preview:</div>
                      <div
                        dangerouslySetInnerHTML={{ __html: logoIcon }}
                        style={{ filter: `hue-rotate(${logoColor}deg)` }}
                        className="[&>svg]:w-8 [&>svg]:h-8 flex items-center justify-center p-2 border rounded"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Logo Color Selector */}
          <div>
            <Label>Logo Color</Label>
            <div className="mt-2">
              <Select
                value={logoColor}
                onValueChange={(value) => setLogoColor(value)}
              >
                <SelectPrimitive.Trigger
                  className={cn(
                    'flex h-12 w-12 shrink-0 rounded-lg border border-input bg-background focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 p-0 overflow-hidden items-center justify-center'
                  )}
                >
                  <SelectValue>
                    <div
                      className="w-6 h-6 rounded-full"
                      style={{
                        background: `hsl(${(240 + parseInt(logoColor)) % 360}, 70%, 50%)`
                      }}
                    />
                  </SelectValue>
                </SelectPrimitive.Trigger>
                <SelectContent className="border-border dark:border-blue-700">
                  <div className="grid grid-cols-4 gap-2 p-2">
                    {HUE_PRESETS.map((preset) => (
                      <SelectItem
                        key={preset.value}
                        value={preset.value.toString()}
                        className="cursor-pointer p-0 h-12 w-12 flex items-center justify-center [&>span:first-child]:hidden"
                      >
                        <div
                          className="w-6 h-6 rounded-full"
                          style={{
                            background: `hsl(${(240 + preset.value) % 360}, 70%, 50%)`
                          }}
                        />
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            </div>
          </div>
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
          <Field label="Phone"><input type="tel" className={cn(deskInput, 'tabular-nums')} maxLength={40} value={form.storefrontContactPhone} onChange={event => setForm(current => ({ ...current, storefrontContactPhone: event.target.value }))} /></Field>
          <Field label="Hours" className="sm:col-span-2"><input className={deskInput} maxLength={200} placeholder="Daily 06:00–22:00 ET" value={form.storefrontServiceHours} onChange={event => setForm(current => ({ ...current, storefrontServiceHours: event.target.value }))} /></Field>
        </div>
      </DeskSection>

      <DeskSection title="Brand colour">
        <Track role="radiogroup" aria-label="Brand colour" className="flex-wrap rounded-[4px]">
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
        <StoreSettingsSaveBar
          isSaving={isPending}
          button={<Pill type="submit" variant="primary" disabled={isPending || !dirty}>{isPending ? 'Saving…' : 'Save'}</Pill>}
        />
        <Pill className="hidden md:inline-flex" disabled={isPending || !dirty} onClick={() => { if (window.confirm('Discard unsaved settings changes?')) { setForm(baseline); setMessage('Changes discarded.') } }}>Discard</Pill>
        {dirty && <span className="inline-flex items-baseline gap-2 text-sm text-muted-foreground"><StatusDot tone="warn" className="-translate-y-[0.05em] size-1.5 shadow-none" />Unsaved changes</span>}
      </div>
      {message ? <Notice tone={failed ? 'bad' : 'ok'} role="status">{message}</Notice> : null}
    </form>

    <aside aria-label="Storefront preview" className="min-w-0 lg:sticky lg:top-4">
      <p className="mb-2 tabular-nums text-xs font-medium text-muted-foreground">Preview</p>
      <Panel className="overflow-hidden">
        <div className="flex min-w-0 items-center justify-between gap-3 border-b bg-background px-4 py-3">
          <span className="min-w-0 truncate text-sm font-semibold text-foreground">{form.name || 'Carrier name'}</span>
          <span className="shrink-0 rounded-[4px] px-3 py-1 text-xs font-medium text-white" style={{ backgroundColor: (brand ?? STOREFRONT_BRAND_COLORS[0]).hex }}>Book</span>
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
