'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Field, Notice, Pill, Track, deskInput } from '@/features/platform/components/desk'
import { recordBagEventAction } from '@/features/platform/baggage/actions/bag-events'
import type { BagAction } from '@/features/platform/baggage/lib/types'

const CONFIRM: Partial<Record<BagAction, string>> = { mishandle: 'Mark this bag mishandled?', close: 'Close this bag?' }

export function BagActions({ bagId, actions, defaultStation }: { bagId: string; actions: ReadonlyArray<{ action: BagAction; label: string }>; defaultStation?: string | null }) {
  const router = useRouter()
  const [station, setStation] = useState(defaultStation ?? '')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()
  // One key per attempt: retrying the same scan reuses it, a different scan gets a new one.
  const attempt = useRef<{ body: string; key: string } | null>(null)

  function run(action: BagAction) {
    const prompt = CONFIRM[action]
    if (prompt && !window.confirm(prompt)) return
    const airportCode = station.trim().toUpperCase() || null
    if (airportCode && !/^[A-Z]{3}$/.test(airportCode)) { setMessage({ tone: 'bad', text: 'Station must be a three-letter code.' }); return }
    const trimmedNote = note.trim() || null
    const body = JSON.stringify({ action, airportCode, note: trimmedNote })
    if (!attempt.current || attempt.current.body !== body) attempt.current = { body, key: `bag-event-${crypto.randomUUID()}` }
    const key = attempt.current.key
    setMessage(null)
    startTransition(async () => {
      const result = await recordBagEventAction({ bagId, action, airportCode, note: trimmedNote, idempotencyKey: key })
      if (!result.success) { setMessage({ tone: 'bad', text: result.error }); return }
      attempt.current = null
      setNote('')
      setMessage({ tone: 'ok', text: `Recorded. Status ${result.status.replaceAll('_', ' ')}.` })
      router.refresh()
    })
  }

  if (!actions.length) return null

  return (
    <div className="min-w-0 space-y-3">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr]">
        <Field label="Station"><input value={station} onChange={e => setStation(e.target.value)} maxLength={3} placeholder="JFK" className={`${deskInput} font-mono uppercase`} /></Field>
        <Field label="Note"><input value={note} onChange={e => setNote(e.target.value)} maxLength={300} className={deskInput} /></Field>
      </div>
      <Track role="group" aria-label="Bag actions">
        {actions.map(({ action, label }) => (
          <Pill key={action} size="sm" variant={action === 'mishandle' || action === 'close' ? 'danger' : undefined} disabled={pending} onClick={() => run(action)}>{label}</Pill>
        ))}
      </Track>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </div>
  )
}
