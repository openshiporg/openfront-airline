'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'
import { Code, DeskSection, Field, Notice, Panel, Pill, StatusLabel, TitleLine, Track, deskInput, statusTone } from '@/features/platform/components/desk'
import onboardingContract from '../seed.json'

type CarrierIdentity = { id?: string; name: string; legalName: string; code: string; defaultCurrencyCode: string; defaultTimezone: string }
type CredentialSummary = { id: string; name: string; tokenPreview: string; audience: string; scopes: string[]; status: string; expiresAt: string; lastUsedAt?: string | null }

export function CarrierOnboardingForm({ initialCarrier, initialServiceDate, onExitRiskChange }: { initialCarrier?: CarrierIdentity; initialServiceDate: string; onExitRiskChange?: (risk: { busy: boolean; dirty: boolean; hasSecret: boolean; unknown: boolean }) => void }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [steps, setSteps] = useState<Array<{ key: string; status: string; requirements: string[] }>>([])
  const [serviceDate, setServiceDate] = useState(initialServiceDate)
  const [departure, setDeparture] = useState(`${initialServiceDate}T09:00`)
  const [arrival, setArrival] = useState(`${initialServiceDate}T10:20`)
  const [credentialBusy, setCredentialBusy] = useState(false)
  const [settlementCredential, setSettlementCredential] = useState<{ credentialId: string; token: string; expiresAt: string } | null>(null)
  const [credentialSummaries, setCredentialSummaries] = useState<CredentialSummary[]>([])

  const formRef = useRef<HTMLFormElement>(null)
  const requestBusy = useRef(false)
  const [dirty, setDirty] = useState(false)
  const [credentialUnknown, setCredentialUnknown] = useState(false)
  const [credentialError, setCredentialError] = useState('')
  useEffect(() => {
    onExitRiskChange?.({ busy: saving || credentialBusy, dirty, hasSecret: !!settlementCredential, unknown: credentialUnknown })
  }, [saving, credentialBusy, dirty, settlementCredential, credentialUnknown, onExitRiskChange])
  useEffect(() => {
    if (!dirty && !credentialBusy && !credentialUnknown && !settlementCredential) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, credentialBusy, credentialUnknown, settlementCredential])

  async function loadCredentialSummaries() {
    const response = await fetch('/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: `query { machineCredentialSummaries }` }) })
    const payload = await response.json()
    if (!response.ok || payload.errors?.length || !Array.isArray(payload.data?.machineCredentialSummaries)) throw new Error('Credential list unavailable')
    setCredentialSummaries(payload.data.machineCredentialSummaries)
    setCredentialError('')
  }

  useEffect(() => { void loadCredentialSummaries().catch(() => setCredentialError('Credentials could not be loaded. Reload the list to try again.')) }, [])

  async function submit(formData: FormData) {
    if (requestBusy.current) return
    requestBusy.current = true
    setSaving(true)
    setMessage('Saving launch setup…')
    const query = `mutation($name:String!,$legalName:String!,$code:String!,$currencyCode:String!,$timezone:String!,$originCode:String!,$destinationCode:String!,$flightNumber:String!,$serviceDate:String!,$scheduledDepartureAt:String!,$scheduledArrivalAt:String!,$capacity:Int!,$baseAmount:Int!,$taxAmount:Int!){completeCarrierOnboarding(name:$name,legalName:$legalName,code:$code,currencyCode:$currencyCode,timezone:$timezone,originCode:$originCode,destinationCode:$destinationCode,flightNumber:$flightNumber,serviceDate:$serviceDate,scheduledDepartureAt:$scheduledDepartureAt,scheduledArrivalAt:$scheduledArrivalAt,capacity:$capacity,baseAmount:$baseAmount,taxAmount:$taxAmount){completed steps{key status requirements}}}`
    const variables = {
      name: String(formData.get('name') ?? ''),
      legalName: String(formData.get('legalName') ?? ''),
      code: String(formData.get('code') ?? ''),
      currencyCode: String(formData.get('currencyCode') ?? ''),
      timezone: String(formData.get('timezone') ?? ''),
      originCode: String(formData.get('originCode') ?? ''),
      destinationCode: String(formData.get('destinationCode') ?? ''),
      flightNumber: String(formData.get('flightNumber') ?? ''),
      serviceDate,
      scheduledDepartureAt: departure,
      scheduledArrivalAt: arrival,
      capacity: Number(formData.get('capacity')),
      baseAmount: Number(formData.get('baseAmount')),
      taxAmount: Number(formData.get('taxAmount')),
    }
    try {
      const response = await fetch('/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) })
      const payload = await response.json()
      const progress = payload.data?.completeCarrierOnboarding
      if (!response.ok || payload.errors?.length || typeof progress?.completed !== 'boolean' || !Array.isArray(progress.steps) || progress.steps.some((step: { key?: unknown; status?: unknown; requirements?: unknown }) => typeof step.key !== 'string' || typeof step.status !== 'string' || !Array.isArray(step.requirements) || step.requirements.some((value: unknown) => typeof value !== 'string'))) throw new Error('Setup result unavailable')
      setSteps(progress.steps)
      setDirty(false)
      setMessage(progress.completed ? 'Launch setup completed.' : 'Progress saved. Complete the remaining steps below.')
      // The sidebar card and Operations launch card read onboardingStatus on the server.
      if (progress) router.refresh()
    } catch {
      setMessage('Launch setup could not be saved. Check your connection and try again.')
    } finally {
      requestBusy.current = false
      setSaving(false)
    }
  }

  async function issueSettlementCredential() {
    if (requestBusy.current || credentialUnknown || settlementCredential) return
    requestBusy.current = true
    setCredentialBusy(true)
    setMessage('Issuing settlement-import credential…')
    // Until a valid response is received the outcome may be committed. Never automatically issue a replacement.
    setCredentialUnknown(true)
    let issued = false
    try {
      const query = `mutation($name:String!,$audience:String!,$scopes:[String!]!,$expiresAt:String!){issueMachineCredential(name:$name,audience:$audience,scopes:$scopes,expiresAt:$expiresAt){credentialId token expiresAt}}`
      const variables = { name: 'Settlement importer', audience: 'settlement-import', scopes: ['settlements:write'], expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString() }
      const response = await fetch('/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) })
      const payload = await response.json()
      const credential = payload.data?.issueMachineCredential
      if (!response.ok || payload.errors?.length || typeof credential?.credentialId !== 'string' || typeof credential.token !== 'string' || !credential.token || !Number.isFinite(Date.parse(credential.expiresAt))) throw new Error('Unconfirmed issuance')
      setSettlementCredential(credential)
      setCredentialUnknown(false)
      issued = true
      setMessage('Credential issued. Copy it now; it cannot be retrieved later.')
      await loadCredentialSummaries()
    } catch {
      setMessage(issued ? 'Credential issued. Copy the token below. The credential list could not be refreshed.' : 'Issuance outcome is unknown. Reload the credential list and ask an administrator to reconcile this attempt before issuing another credential.')
    } finally {
      requestBusy.current = false
      setCredentialBusy(false)
    }
  }

  async function revokeSettlementCredential(credentialId: string) {
    if (requestBusy.current || !window.confirm('Revoke this settlement-import credential? Imports using it stop immediately.')) return
    requestBusy.current = true
    setCredentialBusy(true)
    try {
      const response = await fetch('/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: `mutation($id:ID!){revokeMachineCredential(credentialId:$id)}`, variables: { id: credentialId } }) })
      const payload = await response.json()
      if (!response.ok || payload.errors?.length || payload.data?.revokeMachineCredential !== true) throw new Error('Revocation unconfirmed')
      if (settlementCredential?.credentialId === credentialId) setSettlementCredential(null)
      setMessage('Credential revoked.')
      await loadCredentialSummaries()
    } catch {
      setMessage('Revocation could not be confirmed. Reload the credential list; retry only this same credential if it remains active.')
    } finally {
      requestBusy.current = false
      setCredentialBusy(false)
    }
  }

  const step = (n: string, label: string) => <span className="flex items-baseline gap-2"><span className="font-mono text-xs tabular-nums text-muted-foreground">{n}</span>{label}</span>
  const failed = /could not|unknown|failed/i.test(message)

  return <form ref={formRef} onChange={() => setDirty(true)} action={submit} className="min-w-0 max-w-4xl space-y-8">
    <fieldset disabled={saving || credentialBusy} className="min-w-0 space-y-8">
      <DeskSection title={step('01', 'Carrier identity')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Carrier name"><input className={deskInput} name="name" defaultValue={initialCarrier?.name ?? ''} required /></Field>
          <Field label="Legal name"><input className={deskInput} name="legalName" defaultValue={initialCarrier?.legalName ?? ''} required /></Field>
          <Field label="Carrier code"><input className={cn(deskInput, 'font-mono uppercase tabular-nums')} name="code" defaultValue={initialCarrier?.code ?? ''} maxLength={3} required /></Field>
          <Field label="Currency"><select className={cn(deskInput, 'font-mono')} name="currencyCode" defaultValue={initialCarrier?.defaultCurrencyCode ?? 'USD'} required>{[...new Set([...onboardingContract.supportedCurrencies, initialCarrier?.defaultCurrencyCode ?? 'USD'])].map(currency => <option key={currency} value={currency}>{currency}</option>)}</select></Field>
          <Field label="Timezone" className="sm:col-span-2"><input className={cn(deskInput, 'font-mono')} name="timezone" defaultValue={initialCarrier?.defaultTimezone ?? 'America/New_York'} required /></Field>
        </div>
      </DeskSection>

      <DeskSection title={step('02', 'First sellable service')}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Origin"><select name="originCode" defaultValue="JFK" required className={cn(deskInput, 'font-mono')}><option value="JFK">JFK · New York</option><option value="BOS">BOS · Boston</option></select></Field>
          <Field label="Destination"><select name="destinationCode" defaultValue="BOS" required className={cn(deskInput, 'font-mono')}><option value="JFK">JFK · New York</option><option value="BOS">BOS · Boston</option></select></Field>
          <Field label="Flight number"><input name="flightNumber" defaultValue="101" maxLength={6} required className={cn(deskInput, 'font-mono uppercase tabular-nums')} /></Field>
          <Field label="Service date"><input type="date" value={serviceDate} onChange={event => { const next = event.target.value; setServiceDate(next); setDeparture(value => `${next}T${value.slice(11)}`); setArrival(value => { const dayOffset = Math.round((Date.parse(value.slice(0, 10)) - Date.parse(serviceDate)) / 86_400_000); const day = new Date(Date.parse(next) + (Number.isFinite(dayOffset) ? dayOffset : 0) * 86_400_000).toISOString().slice(0, 10); return `${day}T${value.slice(11)}` }) }} required className={cn(deskInput, 'font-mono tabular-nums')} /></Field>
          <Field label="Departure (carrier time)"><input type="datetime-local" value={departure} onChange={event => setDeparture(event.target.value)} required className={cn(deskInput, 'font-mono tabular-nums')} /></Field>
          <Field label="Arrival (carrier time)"><input type="datetime-local" value={arrival} onChange={event => setArrival(event.target.value)} required className={cn(deskInput, 'font-mono tabular-nums')} /></Field>
          <Field label="Capacity"><input type="number" name="capacity" defaultValue={30} min={1} max={300} required className={cn(deskInput, 'font-mono tabular-nums')} /></Field>
          <Field label="Base amount (minor units)"><input type="number" name="baseAmount" defaultValue={12900} min={0} required className={cn(deskInput, 'font-mono tabular-nums')} /></Field>
          <Field label="Tax amount (minor units)"><input type="number" name="taxAmount" defaultValue={2580} min={0} required className={cn(deskInput, 'font-mono tabular-nums')} /></Field>
        </div>
      </DeskSection>

      <DeskSection title={step('03', 'Launch readiness')}>
        <div className="space-y-4">
          <Track className="flex-wrap rounded-2xl">
            <Pill asChild><a href="/dashboard/users/create" target="_blank" rel="noreferrer">Create payment operator</a></Pill>
            <Pill asChild><a href="/dashboard/carriers">Carrier settings</a></Pill>
          </Track>
          <Panel className="overflow-hidden">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <TitleLine as="p" tone={settlementCredential ? 'ok' : credentialUnknown ? 'warn' : 'idle'} className="text-sm font-medium text-foreground">Settlement import credential</TitleLine>
              {!settlementCredential && <Track><Pill size="sm" disabled={credentialBusy || credentialUnknown} onClick={() => void issueSettlementCredential()}>{credentialBusy ? 'Issuing…' : 'Issue credential'}</Pill></Track>}
            </div>
            {settlementCredential && <div className="space-y-3 border-b px-4 py-3">
              <code className="block overflow-x-auto rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">{settlementCredential.token}</code>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">Expires {new Date(settlementCredential.expiresAt).toLocaleString()}</span>
                <Track>
                  <Pill size="sm" onClick={() => navigator.clipboard.writeText(settlementCredential.token).then(() => setMessage('Settlement credential copied.')).catch(() => setMessage('Copy failed. Select and copy the token below.'))}>Copy once</Pill>
                  <Pill size="sm" variant="danger" disabled={credentialBusy} onClick={() => void revokeSettlementCredential(settlementCredential.credentialId)}>Revoke</Pill>
                </Track>
              </div>
            </div>}
            {credentialSummaries.length > 0 && <ul className="divide-y">{credentialSummaries.map(credential => <li key={credential.id} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-sm">
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-medium text-foreground">{credential.name}</span>
                <Code>{credential.tokenPreview}</Code>
                <StatusLabel status={credential.status} />
                <span className="font-mono text-xs tabular-nums text-muted-foreground">expires {new Date(credential.expiresAt).toLocaleDateString()}</span>
              </span>
              {credential.status === 'active' && <Track><Pill size="sm" variant="danger" disabled={credentialBusy} onClick={() => void revokeSettlementCredential(credential.id)}>Revoke</Pill></Track>}
            </li>)}</ul>}
          </Panel>
        </div>
      </DeskSection>

      <Track><Pill type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Create or verify launch setup'}</Pill></Track>
    </fieldset>

    {credentialError && <Notice tone="bad">{credentialError}</Notice>}
    <Track><Pill disabled={credentialBusy} onClick={() => void loadCredentialSummaries().catch(() => setCredentialError('Credentials could not be loaded.'))}>Reload credential list</Pill></Track>
    {steps.length > 0 && <Panel className="overflow-hidden"><ol className="divide-y">{steps.map(entry => <li key={entry.key} className="px-4 py-3 text-sm">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
        <TitleLine as="span" tone={statusTone(entry.status)} status={entry.status} className="font-medium text-foreground">{onboardingContract.steps.find(item => item.key === entry.key)?.label ?? entry.key.replaceAll('_', ' ')}</TitleLine>
        <StatusLabel status={entry.status} />
      </div>
      {entry.requirements.map(requirement => <p key={requirement} className="mt-1 pl-4 text-muted-foreground">{requirement}</p>)}
    </li>)}</ol></Panel>}
    <div aria-live="polite">{message && <Notice tone={failed ? 'bad' : 'idle'} role="status">{message}</Notice>}</div>
  </form>
}
