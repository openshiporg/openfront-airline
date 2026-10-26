import Link from 'next/link'
import { ChevronRight, Search } from 'lucide-react'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { formatMinorUnits } from '@/features/keystone/lib/money'
import { detailWithReturn } from '@/features/platform/lib/desk-return'
import { Shell } from '@/features/platform/screens/Canonical/PlatformDeskPages'
import { Code, DeskSection, Field, FilterBar, Notice, Panel, Pill, TitleLine, Track, Well, deskInput } from '@/features/platform/components/desk'
import { TicketStatusLabel, ticketTone } from '@/features/platform/tickets/components/TicketStatus'
import { StatusTrack } from '@/features/platform/tickets/components/StatusTrack'
import { TICKETING_ACTOR_QUERY, TICKET_STATUSES, canReadTickets, statusText, type TicketStatus, type TicketingActor } from '@/features/platform/tickets/lib/tickets'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const BASE = '/dashboard/platform/tickets'
const PAGE_SIZE = 100

type TicketRow = {
  id: string
  ticketNumber: string | null
  status: string | null
  totalAmount: number | null
  currencyCode: string | null
  issuedAt: string | null
  passenger: { givenName: string | null; familyName: string | null } | null
  booking: { recordLocator: string | null } | null
  couponsCount: number | null
}

const statusCounts = TICKET_STATUSES.map(status => `${status}: ticketsCount(where: { AND: [$base, { status: { equals: ${status} } }] })`).join('\n  ')

const TICKETS_QUERY = `query PlatformTickets($base: TicketWhereInput!, $where: TicketWhereInput!, $cursor: TicketWhereUniqueInput, $skip: Int!) {
  tickets(where: $where, orderBy: [{ issuedAt: desc }, { id: asc }], take: ${PAGE_SIZE + 1}, cursor: $cursor, skip: $skip) {
    id ticketNumber status totalAmount currencyCode issuedAt couponsCount
    passenger { givenName familyName }
    booking { recordLocator }
  }
  all: ticketsCount(where: $base)
  ${statusCounts}
}`

function text(value: string | string[] | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function TicketListPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ? await searchParams : {}
  const q = text(params.q).slice(0, 60)
  const rawStatus = text(params.status)
  const status = (TICKET_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus as TicketStatus : ''
  const cursor = /^[A-Za-z0-9_-]{1,64}$/.test(text(params.cursor)) ? text(params.cursor) : ''

  const insensitive = { contains: q, mode: 'insensitive' }
  const and: Record<string, unknown>[] = q ? [{ OR: [
    { ticketNumber: insensitive },
    { booking: { recordLocator: insensitive } },
    { passenger: { givenName: insensitive } },
    { passenger: { familyName: insensitive } },
  ] }] : []
  const base = { AND: and }
  const where = status ? { AND: [...and, { status: { equals: status } }] } : base

  const hrefWith = (overrides: Record<string, string>) => {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries({ q, status, ...overrides })) if (value) query.set(key, value)
    return query.size ? `${BASE}?${query}` : BASE
  }
  const bookingsLink = <Track><Pill asChild size="sm"><Link href="/dashboard/platform/bookings">Bookings</Link></Pill></Track>

  const filters = (
    <FilterBar action={BASE}>
      {status && <input type="hidden" name="status" value={status} />}
      <Field label="Ticket number, record locator or passenger" className="sm:flex-1"><span className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input type="search" name="q" defaultValue={q} maxLength={60} className={`${deskInput} pl-9`} /></span></Field>
      <Track><Pill type="submit">Search</Pill><Pill asChild><Link href={BASE}>Clear</Link></Pill></Track>
    </FilterBar>
  )

  const actorResponse = await keystoneClient<{ authenticatedItem: TicketingActor }>(TICKETING_ACTOR_QUERY)
  if (!actorResponse.success) {
    return <Shell title="Tickets" eyebrow="Ticketing" actions={bookingsLink}>{filters}<Notice tone="bad">Tickets could not be loaded. Try again.</Notice></Shell>
  }
  if (!canReadTickets(actorResponse.data.authenticatedItem)) {
    return <Shell title="Tickets" eyebrow="Ticketing" tone="bad" status="Unavailable" actions={bookingsLink}><Notice tone="bad" role="alert">Tickets are unavailable under your current access.</Notice></Shell>
  }

  const response = await keystoneClient<{ tickets: TicketRow[] | null } & Record<'all' | TicketStatus, number | null>>(TICKETS_QUERY, {
    base,
    where,
    cursor: cursor ? { id: cursor } : null,
    skip: cursor ? 1 : 0,
  })
  if (!response.success) {
    return <Shell title="Tickets" eyebrow="Ticketing" actions={bookingsLink}>{filters}<Notice tone="bad">Tickets could not be loaded. Try again.</Notice></Shell>
  }

  const rows = response.data.tickets ?? []
  const hasNext = rows.length > PAGE_SIZE
  const items = rows.slice(0, PAGE_SIZE)
  const total = status ? response.data[status] : response.data.all
  const tabs = [{ value: '', label: 'All', count: response.data.all }, ...TICKET_STATUSES.map(value => ({ value, label: statusText(value), count: response.data[value] }))]
  const returnParams = { q, status }

  return (
    <Shell title="Tickets" eyebrow="Ticketing" actions={bookingsLink} meta={<span className="tabular-nums ">{response.data.all ?? 0} tickets</span>}>
      {filters}
      <StatusTrack label="Ticket status" current={status} options={tabs} hrefFor={value => hrefWith({ status: value })} />
      {cursor && <Track><Pill asChild size="sm"><Link href={hrefWith({})}>First page</Link></Pill></Track>}
      {items.length === 0 ? <Well>No tickets match.</Well> : (
        <DeskSection title="Tickets" count={total ?? undefined} actions={hasNext ? <Track><Pill asChild size="sm"><Link href={hrefWith({ cursor: items[items.length - 1].id })}>Next {PAGE_SIZE}<ChevronRight aria-hidden="true" /></Link></Pill></Track> : undefined}>
          <Panel>
            <ul className="divide-y">
              {items.map(ticket => {
                const locator = ticket.booking?.recordLocator
                return (
                  <li key={ticket.id} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <TitleLine as="h3" tone={ticketTone(ticket.status)} status={ticket.status ?? undefined} className="text-sm font-semibold">
                        <Link href={detailWithReturn(`${BASE}/${ticket.id}`, returnParams)} className="tabular-nums  tracking-wide underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{ticket.ticketNumber ?? '--'}</Link>
                      </TitleLine>
                      <p className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-2 pl-4 text-sm">
                        <span className="text-foreground">{[ticket.passenger?.givenName, ticket.passenger?.familyName].filter(Boolean).join(' ') || 'Passenger unavailable'}</span>
                        {locator && <Link href={`/dashboard/platform/bookings?locator=${encodeURIComponent(locator)}`} className="tabular-nums text-[12px]  text-muted-foreground underline underline-offset-4 hover:text-foreground">{locator}</Link>}
                      </p>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1 pl-4 sm:pl-0">
                      <Code>{ticket.issuedAt ? ticket.issuedAt.slice(0, 10) : 'Not issued'}</Code>
                      <span className="tabular-nums text-xs  text-muted-foreground">Cpn <span className="text-foreground">{ticket.couponsCount ?? '--'}</span></span>
                      <span className="tabular-nums text-sm  text-foreground">{formatMinorUnits(ticket.totalAmount, ticket.currencyCode)}</span>
                      <TicketStatusLabel status={ticket.status} />
                    </div>
                  </li>
                )
              })}
            </ul>
          </Panel>
        </DeskSection>
      )}
    </Shell>
  )
}
