import Link from 'next/link'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { formatMinorUnits } from '@/features/keystone/lib/money'
import { safeDeskReturn } from '@/features/platform/lib/desk-return'
import { Shell } from '@/features/platform/screens/Canonical/PlatformDeskPages'
import { Code, DeskSection, Facts, Notice, Panel, Pill, Route, TitleLine, Track, Well } from '@/features/platform/components/desk'
import { TicketStatusLabel, ticketTone } from '@/features/platform/tickets/components/TicketStatus'
import { airportZoneLabel, instantToAirportLocal } from '@/features/platform/flight-ops/lib/airport-time'
import { TICKETING_ACTOR_QUERY, canReadTickets, type TicketingActor } from '@/features/platform/tickets/lib/tickets'

type Params = Promise<{ id: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

type CouponRow = {
  id: string
  couponNumber: number | null
  status: string | null
  fareBasisCode: string | null
  bookingClassCode: string | null
  amount: number | null
  currencyCode: string | null
  usedAt: string | null
  bookingSegment: {
    originCode: string | null
    destinationCode: string | null
    marketingCarrierCode: string | null
    marketingFlightNumber: string | null
    scheduledDepartureAt: string | null
    cabinCode: string | null
    origin: { timezone: string | null } | null
  } | null
}

type TicketDetail = {
  id: string
  ticketNumber: string | null
  status: string | null
  issuingCarrierCode: string | null
  validatingCarrierCode: string | null
  totalAmount: number | null
  currencyCode: string | null
  issuedAt: string | null
  voidedAt: string | null
  refundedAt: string | null
  passenger: { givenName: string | null; familyName: string | null } | null
  booking: { recordLocator: string | null } | null
  originalTicket: { id: string; ticketNumber: string | null } | null
  reissuedTickets: { id: string; ticketNumber: string | null; status: string | null }[] | null
  coupons: CouponRow[] | null
  couponsCount: number | null
}

const TICKET_QUERY = `query PlatformTicket($id: ID!) {
  ticket(where: { id: $id }) {
    id ticketNumber status issuingCarrierCode validatingCarrierCode totalAmount currencyCode issuedAt voidedAt refundedAt
    passenger { givenName familyName }
    booking { recordLocator }
    originalTicket { id ticketNumber }
    reissuedTickets(orderBy: [{ issuedAt: desc }], take: 20) { id ticketNumber status }
    coupons(orderBy: [{ couponNumber: asc }], take: 50) {
      id couponNumber status fareBasisCode bookingClassCode amount currencyCode usedAt
      bookingSegment { originCode destinationCode marketingCarrierCode marketingFlightNumber scheduledDepartureAt cabinCode origin { timezone } }
    }
    couponsCount
  }
}`

function utc(value: string | null) {
  return value ? `${value.slice(0, 16).replace('T', ' ')} UTC` : '--'
}

export async function TicketDetailPage({ params, searchParams }: { params: Params; searchParams?: SearchParams }) {
  const { id } = await params
  const query = searchParams ? await searchParams : {}
  const backHref = safeDeskReturn('tickets', query.returnTo)
  const parent = { title: 'Tickets', href: backHref }
  const nav = (locator?: string | null) => (
    <Track>
      <Pill asChild size="sm"><Link href={backHref}>Tickets</Link></Pill>
      <Pill asChild size="sm"><Link href={locator ? `/dashboard/platform/bookings?locator=${encodeURIComponent(locator)}` : '/dashboard/platform/bookings'}>Bookings</Link></Pill>
    </Track>
  )

  const actorResponse = await keystoneClient<{ authenticatedItem: TicketingActor }>(TICKETING_ACTOR_QUERY)
  if (!actorResponse.success) {
    return <Shell title="Ticket" eyebrow="Tickets" parent={parent} actions={nav()}><Notice tone="bad">Ticket could not be loaded. Try again.</Notice></Shell>
  }
  if (!canReadTickets(actorResponse.data.authenticatedItem)) {
    return <Shell title="Ticket" eyebrow="Tickets" tone="bad" status="Unavailable" parent={parent} actions={nav()}><Notice tone="bad" role="alert">Tickets are unavailable under your current access.</Notice></Shell>
  }
  const response = await keystoneClient<{ ticket: TicketDetail | null }>(TICKET_QUERY, { id })
  if (!response.success) {
    return <Shell title="Ticket" eyebrow="Tickets" parent={parent} actions={nav()}><Notice tone="bad">Ticket could not be loaded. Try again.</Notice></Shell>
  }
  const ticket = response.data.ticket
  if (!ticket) {
    return <Shell title="Ticket" eyebrow="Tickets" tone="bad" status="Not found" parent={parent} actions={nav()}><Notice tone="bad" role="alert">Ticket not found.</Notice></Shell>
  }

  const locator = ticket.booking?.recordLocator
  const coupons = ticket.coupons ?? []
  const reissued = ticket.reissuedTickets ?? []
  const passengerName = [ticket.passenger?.givenName, ticket.passenger?.familyName].filter(Boolean).join(' ')

  return (
    <Shell
      title={ticket.ticketNumber ?? 'Ticket'}
      eyebrow="Tickets"
      tone={ticketTone(ticket.status)}
      status={ticket.status ?? undefined}
      parent={parent}
      actions={nav(locator)}
      meta={<span className="inline-flex flex-wrap items-baseline gap-3"><TicketStatusLabel status={ticket.status} /><span className="tabular-nums ">{formatMinorUnits(ticket.totalAmount, ticket.currencyCode)}</span></span>}
    >
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <DeskSection title="Ticket">
          <Facts items={[
            { label: 'Ticket number', value: ticket.ticketNumber ?? '--', mono: true },
            { label: 'Status', value: <TicketStatusLabel status={ticket.status} /> },
            { label: 'Passenger', value: passengerName || '--' },
            { label: 'Booking', value: locator ? <Link href={`/dashboard/platform/bookings?locator=${encodeURIComponent(locator)}`} className="tabular-nums font-medium underline underline-offset-4">{locator}</Link> : '--' },
            { label: 'Issuing carrier', value: ticket.issuingCarrierCode ?? '--', mono: true },
            { label: 'Validating carrier', value: ticket.validatingCarrierCode ?? '--', mono: true },
            { label: 'Total', value: formatMinorUnits(ticket.totalAmount, ticket.currencyCode), mono: true },
            { label: 'Issued', value: utc(ticket.issuedAt), mono: true },
            ticket.voidedAt ? { label: 'Voided', value: utc(ticket.voidedAt), mono: true } : null,
            ticket.refundedAt ? { label: 'Refunded', value: utc(ticket.refundedAt), mono: true } : null,
            ticket.originalTicket ? { label: 'Reissued from', value: <Link href={`/dashboard/platform/tickets/${ticket.originalTicket.id}`} className="tabular-nums underline underline-offset-4">{ticket.originalTicket.ticketNumber ?? '--'}</Link> } : null,
            reissued.length ? { label: 'Reissued as', value: <span className="inline-flex flex-col items-end gap-1">{reissued.map(next => <Link key={next.id} href={`/dashboard/platform/tickets/${next.id}`} className="tabular-nums underline underline-offset-4">{next.ticketNumber ?? '--'}</Link>)}</span> } : null,
          ]} />
        </DeskSection>
        <DeskSection title="Coupons" count={ticket.couponsCount ?? coupons.length}>
          {coupons.length === 0 ? <Well>No coupons.</Well> : (
            <Panel>
              <ol className="divide-y">
                {coupons.map(coupon => {
                  const segment = coupon.bookingSegment
                  return (
                    <li key={coupon.id} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <TitleLine as="h3" tone={ticketTone(coupon.status)} status={coupon.status ?? undefined} className="text-sm font-medium">
                          <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <span className="tabular-nums  text-muted-foreground">{coupon.couponNumber ?? '--'}</span>
                            <Route from={segment?.originCode} to={segment?.destinationCode} />
                            <span className="tabular-nums ">{segment ? `${segment.marketingCarrierCode ?? ''}${segment.marketingFlightNumber ?? ''}` : '--'}</span>
                          </span>
                        </TitleLine>
                        <p className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-3 pl-4">
                          <Code>{segment?.scheduledDepartureAt ? `${instantToAirportLocal(segment.scheduledDepartureAt, segment.origin?.timezone).replace('T', ' ')} ${airportZoneLabel(segment.scheduledDepartureAt, segment.origin?.timezone)}` : '--'}</Code>
                          <Code>Fare {coupon.fareBasisCode || '--'}</Code>
                          <Code>Class {coupon.bookingClassCode || '--'}{segment?.cabinCode ? ` / ${segment.cabinCode}` : ''}</Code>
                        </p>
                      </div>
                      <div className="flex items-baseline gap-4 pl-4 sm:pl-0">
                        <span className="tabular-nums text-sm  text-foreground">{formatMinorUnits(coupon.amount, coupon.currencyCode)}</span>
                        <TicketStatusLabel status={coupon.status} />
                      </div>
                    </li>
                  )
                })}
              </ol>
            </Panel>
          )}
        </DeskSection>
      </div>
    </Shell>
  )
}
