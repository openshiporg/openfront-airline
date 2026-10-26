import Link from 'next/link'
import { ChevronRight, Search } from 'lucide-react'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { detailWithReturn } from '@/features/platform/lib/desk-return'
import { Shell } from '@/features/platform/screens/Canonical/PlatformDeskPages'
import { Code, DeskSection, Field, FilterBar, Notice, Panel, Pill, Route, RowLink, TitleLine, Track, Well, deskInput } from '@/features/platform/components/desk'
import { BagStatusLabel, bagTone } from '@/features/platform/baggage/components/BagStatus'
import { StatusTrack } from '@/features/platform/baggage/components/StatusTrack'
import { BAG_STATUSES, formatKg } from '@/features/platform/baggage/lib/bag-actions'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const BASE = '/dashboard/platform/baggage'
const PAGE_SIZE = 100

type Actor = {
  carrier?: { id: string } | null
  role?: { canReadAirportService: boolean | null; canManageAirportService: boolean | null; canManageCarriers: boolean | null } | null
} | null

type BagRow = {
  id: string
  tagNumber: string | null
  status: string | null
  weightGrams: number | null
  passenger: { givenName: string | null; familyName: string | null } | null
  booking: { recordLocator: string | null } | null
  flightInstance: { flightNumber: string | null; serviceDate: string | null } | null
  origin: { iataCode: string | null } | null
  destination: { iataCode: string | null } | null
}

const statusCounts = BAG_STATUSES.map(status => `${status}: bagsCount(where: { AND: [$base, { status: { equals: ${status} } }] })`).join('\n  ')

const ACTOR_QUERY = `query PlatformBaggageActor { authenticatedItem { ... on User { carrier { id } role { canReadAirportService canManageAirportService canManageCarriers } } } }`

const BAGGAGE_QUERY = `query PlatformBaggage($base: BagWhereInput!, $where: BagWhereInput!, $cursor: BagWhereUniqueInput, $skip: Int!) {
  bags(where: $where, orderBy: [{ updatedAt: desc }, { id: asc }], take: ${PAGE_SIZE + 1}, cursor: $cursor, skip: $skip) {
    id tagNumber status weightGrams
    passenger { givenName familyName }
    booking { recordLocator }
    flightInstance { flightNumber serviceDate }
    origin { iataCode }
    destination { iataCode }
  }
  all: bagsCount(where: $base)
  ${statusCounts}
}`

function text(value: string | string[] | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function BaggageListPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ? await searchParams : {}
  const q = text(params.q).slice(0, 60)
  const rawStatus = text(params.status)
  const status = (BAG_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : ''
  const rawDate = text(params.date)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && !Number.isNaN(Date.parse(`${rawDate}T00:00:00Z`)) ? rawDate : ''
  const cursor = /^[A-Za-z0-9_-]{1,64}$/.test(text(params.cursor)) ? text(params.cursor) : ''

  const and: Record<string, unknown>[] = []
  if (q) and.push({ OR: [{ tagNumber: { contains: q, mode: 'insensitive' } }, { booking: { recordLocator: { contains: q, mode: 'insensitive' } } }] })
  if (date) {
    const start = new Date(`${date}T00:00:00.000Z`)
    and.push({ flightInstance: { serviceDate: { gte: start.toISOString(), lt: new Date(start.getTime() + 86_400_000).toISOString() } } })
  }
  const base = { AND: and }
  const where = status ? { AND: [...and, { status: { equals: status } }] } : base

  const hrefWith = (overrides: Record<string, string>) => {
    const query = new URLSearchParams()
    const values = { q, status, date, ...overrides }
    for (const [key, value] of Object.entries(values)) if (value) query.set(key, value)
    return query.size ? `${BASE}?${query}` : BASE
  }

  const filters = (
    <FilterBar action={BASE}>
      {status && <input type="hidden" name="status" value={status} />}
      <Field label="Tag number or record locator" className="sm:flex-1"><span className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input type="search" name="q" defaultValue={q} maxLength={60} className={`${deskInput} pl-9 tabular-nums uppercase`} /></span></Field>
      <Field label="Flight date" className="sm:w-48"><input type="date" name="date" defaultValue={date} className={`${deskInput} tabular-nums `} /></Field>
      <Track><Pill type="submit">Search</Pill><Pill asChild><Link href={BASE}>Clear</Link></Pill></Track>
    </FilterBar>
  )

  const actorResponse = await keystoneClient<{ authenticatedItem: Actor }>(ACTOR_QUERY)
  if (!actorResponse.success) {
    return <Shell title="Baggage" eyebrow="Airport service">{filters}<Notice tone="bad">Bags could not be loaded. Try again.</Notice></Shell>
  }
  const actor = actorResponse.data.authenticatedItem
  const role = actor?.role
  const canRead = Boolean((role?.canReadAirportService || role?.canManageAirportService) && (role?.canManageCarriers || actor?.carrier?.id))
  if (!canRead) {
    return <Shell title="Baggage" eyebrow="Airport service" tone="bad" status="Unavailable"><Notice tone="bad" role="alert">Bag records are unavailable under your current access.</Notice></Shell>
  }

  const response = await keystoneClient<{ bags: BagRow[] | null } & Record<'all' | (typeof BAG_STATUSES)[number], number | null>>(BAGGAGE_QUERY, {
    base,
    where,
    cursor: cursor ? { id: cursor } : null,
    skip: cursor ? 1 : 0,
  })
  if (!response.success) {
    return <Shell title="Baggage" eyebrow="Airport service">{filters}<Notice tone="bad">Bags could not be loaded. Try again.</Notice></Shell>
  }

  const rows = response.data.bags ?? []
  const hasNext = rows.length > PAGE_SIZE
  const items = rows.slice(0, PAGE_SIZE)
  const total = status ? response.data[status as (typeof BAG_STATUSES)[number]] : response.data.all
  const tabs = [{ value: '', label: 'All', count: response.data.all }, ...BAG_STATUSES.map(value => ({ value, label: value.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()), count: response.data[value] }))]
  const returnParams = { q, status, date }
  const mishandled = (response.data.mishandled ?? 0) + (response.data.delayed ?? 0)

  return (
    <Shell title="Baggage" eyebrow="Airport service" tone={mishandled > 0 ? 'warn' : undefined} meta={<span className="tabular-nums ">{response.data.all ?? 0} bags{date ? ` / ${date}` : ''}</span>}>
      {filters}
      <StatusTrack label="Bag status" current={status} options={tabs} hrefFor={value => hrefWith({ status: value })} />
      {cursor && <Track><Pill asChild size="sm"><Link href={hrefWith({})}>First page</Link></Pill></Track>}
      {items.length === 0 ? <Well>No bags match.</Well> : (
        <DeskSection title="Bags" count={total ?? undefined} actions={hasNext ? <Track><Pill asChild size="sm"><Link href={hrefWith({ cursor: items[items.length - 1].id })}>Next {PAGE_SIZE}<ChevronRight aria-hidden="true" /></Link></Pill></Track> : undefined}>
          <Panel className="divide-y">
            {items.map(bag => (
              <RowLink key={bag.id} href={detailWithReturn(`${BASE}/${bag.id}`, returnParams)}>
                <div className="min-w-0 flex-1">
                  <TitleLine as="h3" tone={bagTone(bag.status)} status={bag.status ?? undefined} className="tabular-nums text-sm font-semibold  tracking-wide">{bag.tagNumber ?? '--'}</TitleLine>
                  <p className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-2 pl-4 text-sm text-muted-foreground">
                    <span className="text-foreground">{[bag.passenger?.givenName, bag.passenger?.familyName].filter(Boolean).join(' ') || 'Passenger unavailable'}</span>
                    {bag.booking?.recordLocator && <Code>{bag.booking.recordLocator}</Code>}
                  </p>
                </div>
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1 pl-4 sm:pl-0">
                  <Route from={bag.origin?.iataCode} to={bag.destination?.iataCode} />
                  <Code>{bag.flightInstance?.flightNumber ?? '--'} {bag.flightInstance?.serviceDate?.slice(0, 10) ?? ''}</Code>
                  <span className="tabular-nums text-xs  text-foreground">{formatKg(bag.weightGrams)}</span>
                  <BagStatusLabel status={bag.status} />
                </div>
              </RowLink>
            ))}
          </Panel>
        </DeskSection>
      )}
    </Shell>
  )
}
