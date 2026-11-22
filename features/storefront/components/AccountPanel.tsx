'use client'

import { type FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { postGraphql as graphql } from '@/features/storefront/lib/request-errors'
import { formatMinorUnits } from '@/features/keystone/lib/money'
import { PlatformDateInput } from '@/features/platform/components/PlatformDateTime'

type Profile = { email: string; emailVerified: boolean; givenName: string; familyName: string; dateOfBirth: string; phone: string }
type Trip = { recordLocator: string; status: string; paymentStatus: string; ticketingStatus: string; totalAmount: number; currencyCode: string; pass: string; segments: Array<{ originCode: string; destinationCode: string; flightNumber: string; departureAt: string | null; departureLabel: string | null }> }
type View = 'signin' | 'signup' | 'forgot' | 'reset'

const PROFILE = 'email emailVerified givenName familyName dateOfBirth phone'

function tripState(trip: Trip) {
  if (trip.status === 'cancelled') return { label: 'Cancelled', tone: 'warn' }
  if (['unpaid', 'failed'].includes(trip.paymentStatus)) return { label: 'Payment due', tone: 'warn' }
  if (trip.ticketingStatus === 'ticketed') return { label: 'Ticketed', tone: 'ok' }
  return { label: 'Confirmed', tone: 'ok' }
}

export function AccountPanel({ carrierCode }: { carrierCode: string }) {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const [trips, setTrips] = useState<Trip[]>([])
  const [view, setView] = useState<View>('signin')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null)
  const [resetToken, setResetToken] = useState('')

  async function load() {
    const data = await graphql<{ customerAccount: Profile | null }>(`{customerAccount{${PROFILE}}}`, {})
    setProfile(data.customerAccount)
    if (data.customerAccount) setTrips((await graphql<{ customerTrips: Trip[] }>('{customerTrips{recordLocator status paymentStatus ticketingStatus totalAmount currencyCode pass segments{originCode destinationCode flightNumber departureAt departureLabel}}}', {})).customerTrips)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const confirm = params.get('confirm'), reset = params.get('reset')
    if (confirm || reset) history.replaceState(null, '', window.location.pathname)
    void (async () => {
      try {
        if (confirm) {
          await graphql('mutation($t:String!){confirmCustomerEmail(token:$t){email}}', { t: confirm })
          setStatus({ text: 'Email confirmed. Your trips booked with it are below.', tone: 'ok' })
        }
        if (reset) { setResetToken(reset); setView('reset') }
      } catch (error) { setStatus({ text: error instanceof Error ? error.message : 'That link didn’t work.', tone: 'warn' }) }
      try { await load() } catch { setProfile(null) }
    })()
  }, [])

  async function run(work: () => Promise<unknown>, done?: string) {
    setBusy(true); setStatus(null)
    try { await work(); if (done) setStatus({ text: done, tone: 'ok' }) }
    catch (error) { setStatus({ text: error instanceof Error ? error.message : 'That didn’t work. Try again.', tone: 'warn' }) }
    setBusy(false)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>
    if (view === 'signin') return run(async () => { await graphql(`mutation($c:String!,$e:String!,$p:String!){signInCustomer(carrierCode:$c,email:$e,password:$p){email}}`, { c: carrierCode, e: form.email, p: form.password }); await load() })
    if (view === 'signup') return run(async () => { await graphql(`mutation($c:String!,$e:String!,$p:String!,$g:String!,$f:String!){signUpCustomer(carrierCode:$c,email:$e,password:$p,givenName:$g,familyName:$f){email}}`, { c: carrierCode, e: form.email, p: form.password, g: form.givenName, f: form.familyName }); await load() }, 'Account created. We emailed you a link: confirm it to see trips booked with this email.')
    if (view === 'forgot') return run(() => graphql(`mutation($c:String!,$e:String!){sendCustomerAccountLink(carrierCode:$c,email:$e,purpose:"reset")}`, { c: carrierCode, e: form.email }), 'If there’s an account with that email, a reset link is on its way.')
    return run(async () => { await graphql('mutation($t:String!,$p:String!){resetCustomerPassword(token:$t,password:$p){email}}', { t: resetToken, p: form.password }); setView('signin'); await load() }, 'Password changed. You’re signed in.')
  }

  const notice = status && <p role="status" className="af-notice" data-tone={status.tone}><span className="af-dot" data-tone={status.tone} />{status.text}</p>

  if (profile === undefined) return <p className="text-sm text-[var(--af-ink-2)]">Loading your account…</p>

  if (!profile) {
    const titles: Record<View, string> = { signin: 'Sign in', signup: 'Create an account', forgot: 'Reset your password', reset: 'Choose a new password' }
    return <div className="mx-auto grid max-w-md gap-5">
      {notice}
      <form onSubmit={submit} className="af-card grid gap-4 p-5 sm:p-6">
        <h2 className="text-2xl font-medium tracking-[-0.01em]">{titles[view]}</h2>
        {view === 'signup' && <div className="grid grid-cols-2 gap-3">
          <label className="af-field"><span className="af-field-label">First name</span><input name="givenName" required autoComplete="given-name" className="af-input" /></label>
          <label className="af-field"><span className="af-field-label">Last name</span><input name="familyName" required autoComplete="family-name" className="af-input" /></label>
        </div>}
        {view !== 'reset' && <label className="af-field"><span className="af-field-label">Email</span><input name="email" type="email" required autoComplete="email" className="af-input" /></label>}
        {view !== 'forgot' && <label className="af-field"><span className="af-field-label">{view === 'reset' ? 'New password' : 'Password'}</span><input name="password" type="password" required minLength={view === 'signin' ? undefined : 10} autoComplete={view === 'signin' ? 'current-password' : 'new-password'} className="af-input" />{view !== 'signin' && <span className="text-xs text-[var(--af-ink-3)]">At least 10 characters.</span>}</label>}
        <button disabled={busy} className="af-pill af-pill-primary w-full">{busy ? 'One moment…' : view === 'signin' ? 'Sign in' : view === 'signup' ? 'Create account' : view === 'forgot' ? 'Email me a reset link' : 'Save password'}</button>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-2 text-sm">
          {view === 'signin' ? <>
            <button type="button" onClick={() => { setView('signup'); setStatus(null) }} className="font-semibold underline underline-offset-4">Create an account</button>
            <button type="button" onClick={() => { setView('forgot'); setStatus(null) }} className="underline underline-offset-4">Forgot password?</button>
          </> : <button type="button" onClick={() => { setView('signin'); setStatus(null) }} className="font-semibold underline underline-offset-4">Back to sign in</button>}
        </div>
      </form>
      <p className="text-center text-sm text-[var(--af-ink-2)]">No account? You can still <Link href="/manage-booking" className="font-semibold underline underline-offset-4">find a booking</Link> with its reference and your last name.</p>
    </div>
  }

  return <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
    <section aria-labelledby="trips-title" className="grid min-w-0 gap-4">
      {notice}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="trips-title" className="text-2xl font-medium tracking-[-0.01em]">My trips</h2>
        <Link href="/#book" className="af-pill af-pill-raised af-pill-sm">Book a flight</Link>
      </div>
      {!profile.emailVerified ? <div className="af-card grid gap-3 p-5">
        <p className="font-medium">Confirm your email to see your trips</p>
        <p className="text-sm text-[var(--af-ink-2)]">We sent a link to {profile.email}. Trips booked with this email show here once it’s confirmed.</p>
        <div className="af-track w-fit"><button disabled={busy} onClick={() => run(() => graphql(`mutation($c:String!,$e:String!){sendCustomerAccountLink(carrierCode:$c,email:$e,purpose:"verify")}`, { c: carrierCode, e: profile.email }), 'Link sent. Check your inbox.')} className="af-pill af-pill-raised af-pill-sm">Send the link again</button></div>
      </div> : trips.length === 0 ? <div className="af-card p-5 text-sm text-[var(--af-ink-2)]">No trips booked with {profile.email} yet.</div>
        : <ul className="grid gap-3">{trips.map(trip => {
          const state = tripState(trip)
          const first = trip.segments[0]
          return <li key={trip.recordLocator}><Link href={`/manage-booking?ref=${trip.recordLocator}#pass=${encodeURIComponent(trip.pass)}`} className="af-card group flex min-w-0 items-center gap-4 p-4 transition-colors hover:bg-[var(--af-paper)] sm:p-5">
            <div className="min-w-0 flex-1">
              <p className="af-display flex items-center gap-2 text-2xl uppercase">{first?.originCode ?? '—'}<span className="af-path text-[var(--af-ink-3)]" />{trip.segments.at(-1)?.destinationCode ?? '—'}</p>
              <p className="mt-1 truncate text-sm text-[var(--af-ink-2)]">{first ? `${first.flightNumber} · ${first.departureLabel ?? ''}` : 'No flights'} · <span className="af-mono">{trip.recordLocator}</span></p>
            </div>
            <div className="shrink-0 text-right">
              <p className="af-title-line justify-end text-sm font-medium"><span className="af-dot" data-tone={state.tone} />{state.label}</p>
              <p className="af-mono mt-1 text-sm">{formatMinorUnits(trip.totalAmount, trip.currencyCode)}</p>
            </div>
            <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-[var(--af-ink-3)] transition-transform group-hover:translate-x-0.5" />
          </Link></li>
        })}</ul>}
    </section>
    <aside className="grid gap-4">
      <form onSubmit={event => { event.preventDefault(); const f = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>; void run(async () => setProfile((await graphql<{ updateCustomerTraveler: Profile }>(`mutation($g:String!,$f:String!,$d:String!,$p:String!){updateCustomerTraveler(givenName:$g,familyName:$f,dateOfBirth:$d,phone:$p){${PROFILE}}}`, { g: f.givenName, f: f.familyName, d: f.dateOfBirth, p: f.phone })).updateCustomerTraveler), 'Saved. We’ll fill these in when you book.') }} className="af-card grid gap-3 p-5">
        <h2 className="text-lg font-semibold">Traveler details</h2>
        <p className="-mt-1 text-sm text-[var(--af-ink-2)]">Filled in for you when you book.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="af-field"><span className="af-field-label">First name</span><input name="givenName" defaultValue={profile.givenName} required autoComplete="given-name" className="af-input" /></label>
          <label className="af-field"><span className="af-field-label">Last name</span><input name="familyName" defaultValue={profile.familyName} required autoComplete="family-name" className="af-input" /></label>
        </div>
        <div className="af-field"><span className="af-field-label">Date of birth</span><PlatformDateInput aria-label="Date of birth" name="dateOfBirth" defaultValue={profile.dateOfBirth} max={new Date().toISOString().slice(0, 10)} placeholder="Select date" className="af-input af-trigger" /></div>
        <label className="af-field"><span className="af-field-label">Phone (optional)</span><input name="phone" type="tel" defaultValue={profile.phone} autoComplete="tel" className="af-input" /></label>
        <button disabled={busy} className="af-pill af-pill-raised w-full">Save details</button>
      </form>
      <div className="af-card flex items-center justify-between gap-3 p-5">
        <p className="min-w-0 truncate text-sm">Signed in as <span className="font-medium">{profile.email}</span></p>
        <button disabled={busy} onClick={() => run(async () => { await graphql('mutation{signOutCustomer}', {}); setProfile(null); setTrips([]) })} className="af-pill af-pill-sm shrink-0">Sign out</button>
      </div>
    </aside>
  </div>
}
