'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

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

  return <form ref={formRef} onChange={() => setDirty(true)} action={submit} className="grid max-w-4xl gap-6 rounded-2xl border bg-background p-5 md:p-6">
    <fieldset disabled={saving || credentialBusy} className="contents"><section className="space-y-4"><div><h2 className="font-semibold">1. Carrier identity</h2><p className="text-sm text-muted-foreground">Your airline's public name, legal name, carrier code, currency, and timezone.</p></div><div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Carrier name<input className="mt-1 w-full rounded-md border p-2" name="name" defaultValue={initialCarrier?.name ?? ''} required /></label>
      <label className="text-sm font-medium">Legal name<input className="mt-1 w-full rounded-md border p-2" name="legalName" defaultValue={initialCarrier?.legalName ?? ''} required /></label>
      <label className="text-sm font-medium">Carrier code<input className="mt-1 w-full rounded-md border p-2 uppercase" name="code" defaultValue={initialCarrier?.code ?? ''} maxLength={3} required /></label>
      <label className="text-sm font-medium">Currency<select className="mt-1 w-full rounded-md border bg-background p-2" name="currencyCode" defaultValue={initialCarrier?.defaultCurrencyCode ?? 'USD'} required>{[...new Set([...onboardingContract.supportedCurrencies, initialCarrier?.defaultCurrencyCode ?? 'USD'])].map(currency => <option key={currency} value={currency}>{currency}</option>)}</select></label>
    </div><label className="block text-sm font-medium">Timezone<input className="mt-1 w-full rounded-md border p-2" name="timezone" defaultValue={initialCarrier?.defaultTimezone ?? 'America/New_York'} required /></label></section>
    <section className="space-y-4 border-t pt-5"><div><h2 className="font-semibold">2. First sellable service</h2><p className="text-sm text-muted-foreground">Creates a route, published schedule, standard fare, dated flight, inventory, and seat map with dates relative to setup.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-sm font-medium">Origin<select name="originCode" defaultValue="JFK" required className="mt-1 w-full rounded-md border bg-background p-2"><option value="JFK">JFK — New York</option><option value="BOS">BOS — Boston</option></select></label>
      <label className="text-sm font-medium">Destination<select name="destinationCode" defaultValue="BOS" required className="mt-1 w-full rounded-md border bg-background p-2"><option value="JFK">JFK — New York</option><option value="BOS">BOS — Boston</option></select></label>
      <label className="text-sm font-medium">Flight number<input name="flightNumber" defaultValue="101" maxLength={6} required className="mt-1 w-full rounded-md border p-2 uppercase" /></label>
      <label className="text-sm font-medium">Service date<input type="date" value={serviceDate} onChange={event => { const next = event.target.value; setServiceDate(next); setDeparture(value => `${next}T${value.slice(11)}`); setArrival(value => { const dayOffset = Math.round((Date.parse(value.slice(0, 10)) - Date.parse(serviceDate)) / 86_400_000); const day = new Date(Date.parse(next) + (Number.isFinite(dayOffset) ? dayOffset : 0) * 86_400_000).toISOString().slice(0, 10); return `${day}T${value.slice(11)}` }) }} required className="mt-1 w-full rounded-md border p-2" /></label>
      <label className="text-sm font-medium">Departure (in the carrier timezone above)<input type="datetime-local" value={departure} onChange={event => setDeparture(event.target.value)} required className="mt-1 w-full rounded-md border p-2" /></label>
      <label className="text-sm font-medium">Arrival (in the carrier timezone above)<input type="datetime-local" value={arrival} onChange={event => setArrival(event.target.value)} required className="mt-1 w-full rounded-md border p-2" /></label>
      <label className="text-sm font-medium">Capacity<input type="number" name="capacity" defaultValue={30} min={1} max={300} required className="mt-1 w-full rounded-md border p-2" /></label>
      <label className="text-sm font-medium">Base amount (minor units)<input type="number" name="baseAmount" defaultValue={12900} min={0} required className="mt-1 w-full rounded-md border p-2" /></label>
      <label className="text-sm font-medium">Tax amount (minor units)<input type="number" name="taxAmount" defaultValue={2580} min={0} required className="mt-1 w-full rounded-md border p-2" /></label>
    </div></section>
    <section className="space-y-3 border-t pt-5"><h2 className="font-semibold">3. Launch readiness</h2><p className="text-sm text-muted-foreground">The command grants this administrator station capabilities at the origin and configures manual external-settlement evidence with independent approval. Complete readiness also requires a distinct second payment operator and an active import credential. No provider, compliance, certification, regulatory, or safety success is asserted. <a href="/dashboard/users/create" target="_blank" rel="noreferrer" className="font-medium text-primary underline">Create the independent operator in a new tab</a>, then explicitly enable direct sales in <a href="/dashboard/carriers" className="font-medium text-primary underline">carrier settings</a> and rerun this setup.</p><div className="rounded-lg border bg-muted/30 p-3"><p className="text-sm font-medium">Settlement-import machine credential</p><p className="mt-1 text-xs text-muted-foreground">Issue only for the external ledger importer. The secret is displayed once and is never stored in this browser.</p>{settlementCredential ? <div className="mt-3 space-y-2"><code className="block overflow-x-auto rounded bg-background p-2 text-xs">{settlementCredential.token}</code><p className="text-xs text-muted-foreground">Expires {new Date(settlementCredential.expiresAt).toLocaleString()}</p><div className="flex gap-2"><button type="button" onClick={() => navigator.clipboard.writeText(settlementCredential.token).then(() => setMessage('Settlement credential copied.')).catch(() => setMessage('Copy failed. Select and copy the token below.'))} className="rounded-md border px-3 py-2 text-sm">Copy once</button><button type="button" disabled={credentialBusy} onClick={() => void revokeSettlementCredential(settlementCredential.credentialId)} className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">Revoke</button></div></div> : <button type="button" disabled={credentialBusy || credentialUnknown} onClick={() => void issueSettlementCredential()} className="mt-3 rounded-md border px-3 py-2 text-sm disabled:opacity-50">{credentialBusy ? 'Issuing…' : 'Issue import credential'}</button>}{credentialSummaries.length > 0 && <ul className="mt-3 space-y-2">{credentialSummaries.map(credential => <li key={credential.id} className="flex flex-col gap-2 rounded border bg-background p-2 text-xs sm:flex-row sm:items-center sm:justify-between"><span><strong>{credential.name}</strong> · {credential.tokenPreview} · {credential.status} · expires {new Date(credential.expiresAt).toLocaleDateString()}</span>{credential.status === 'active' && <button type="button" disabled={credentialBusy} onClick={() => void revokeSettlementCredential(credential.id)} className="w-fit rounded border border-destructive/40 px-2 py-1 text-destructive">Revoke</button>}</li>)}</ul>}</div><button className="w-fit rounded-md bg-foreground px-4 py-2 text-background disabled:opacity-50" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create or verify launch setup'}</button></section>
    </fieldset>
    {credentialError && <p role="alert" className="text-sm text-destructive">{credentialError}</p>}
    <button type="button" disabled={credentialBusy} onClick={() => void loadCredentialSummaries().catch(() => setCredentialError('Credentials could not be loaded.'))} className="w-fit rounded border px-3 py-2 text-sm">Reload credential list</button>
    {steps.length > 0 && <ol className="space-y-2">{steps.map(step => <li key={step.key} className="rounded-md border p-3 text-sm"><span className="font-medium">{onboardingContract.steps.find(entry => entry.key === step.key)?.label ?? step.key.replaceAll('_', ' ')}</span> · {step.status}{step.requirements.map(requirement => <p key={requirement} className="text-muted-foreground">{requirement}</p>)}</li>)}</ol>}
    <p aria-live="polite" className="text-sm text-muted-foreground">{message}</p>
  </form>
}
