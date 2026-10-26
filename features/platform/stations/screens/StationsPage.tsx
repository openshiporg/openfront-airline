import Link from 'next/link'

import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import {
  DeskHeader,
  DeskSection,
  type DeskTone,
  Field,
  FilterBar,
  Notice,
  Panel,
  Pill,
  TitleLine,
  Track,
  Well,
  deskInput,
} from '@/features/platform/components/desk'
import { NewStationAssignment, StationAssignmentActions } from '@/features/platform/stations/components/StationAssignmentForms'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const PATH = '/dashboard/platform/stations'
const STATUSES = ['active', 'suspended', 'revoked'] as const
const PAGE_SIZE = 300

type Assignment = {
  id: string
  assignmentKey: string | null
  status: string | null
  canCheckIn: boolean | null
  canAcceptBags: boolean | null
  canBoard: boolean | null
  validFrom: string | null
  validUntil: string | null
  user: { id: string; name: string | null; email: string | null } | null
  airport: { id: string; iataCode: string | null; name: string | null; city: string | null } | null
}

function one(value: string | string[] | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

function formatInstant(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

/** Persisted status plus the validity window: what requireStationCapability will actually honour now. */
function effectiveState(assignment: Assignment, now: number): { label: string; tone: DeskTone } {
  const status = assignment.status ?? 'active'
  if (status === 'revoked') return { label: 'Revoked', tone: 'bad' }
  if (status === 'suspended') return { label: 'Suspended', tone: 'warn' }
  if (assignment.validUntil && new Date(assignment.validUntil).getTime() <= now) return { label: 'Expired', tone: 'idle' }
  if (assignment.validFrom && new Date(assignment.validFrom).getTime() > now) return { label: 'Not yet valid', tone: 'info' }
  return { label: 'Active', tone: 'ok' }
}


function hrefWith(current: { status: string; airport: string; user: string }, patch: Partial<{ status: string; airport: string; user: string }>) {
  const next = { ...current, ...patch }
  const query = new URLSearchParams()
  if (next.status) query.set('status', next.status)
  if (next.airport) query.set('airport', next.airport)
  if (next.user) query.set('user', next.user)
  const text = query.toString()
  return text ? `${PATH}?${text}` : PATH
}

export async function StationsPage({ searchParams }: { searchParams?: SearchParams } = {}) {
  const params = searchParams ? await searchParams : {}
  const statusParam = one(params.status)
  const status = (STATUSES as readonly string[]).includes(statusParam) ? statusParam : ''
  const airportParam = one(params.airport).toUpperCase()
  const airport = /^[A-Z0-9]{3}$/.test(airportParam) ? airportParam : ''
  const userParam = one(params.user)
  const user = /^[A-Za-z0-9_-]{1,64}$/.test(userParam) ? userParam : ''
  const filters = { status, airport, user }

  const identity = await keystoneClient<{ authenticatedItem: { carrier: { id: string; code: string | null } | null } | null }>(
    `query StationsDeskIdentity { authenticatedItem { ... on User { carrier { id code } } } }`,
  )
  const carrier = identity.success ? identity.data.authenticatedItem?.carrier ?? null : null

  const base: Record<string, unknown>[] = []
  if (airport) base.push({ airport: { iataCode: { equals: airport } } })
  if (user) base.push({ user: { id: { equals: user } } })
  const withStatus = (value: string) => ({ AND: [...base, { status: { equals: value } }] })

  const [assignments, users, airports] = await Promise.all([
    keystoneClient<{
      stationAssignments: Assignment[] | null
      all: number | null
      active: number | null
      suspended: number | null
      revoked: number | null
    }>(
      `query StationsDesk($where: StationAssignmentWhereInput!, $base: StationAssignmentWhereInput!, $activeWhere: StationAssignmentWhereInput!, $suspendedWhere: StationAssignmentWhereInput!, $revokedWhere: StationAssignmentWhereInput!, $take: Int!) {
        stationAssignments(where: $where, orderBy: [{ validFrom: desc }], take: $take) {
          id assignmentKey status canCheckIn canAcceptBags canBoard validFrom validUntil
          user { id name email }
          airport { id iataCode name city }
        }
        all: stationAssignmentsCount(where: $base)
        active: stationAssignmentsCount(where: $activeWhere)
        suspended: stationAssignmentsCount(where: $suspendedWhere)
        revoked: stationAssignmentsCount(where: $revokedWhere)
      }`,
      {
        where: status ? withStatus(status) : { AND: base },
        base: { AND: base },
        activeWhere: withStatus('active'),
        suspendedWhere: withStatus('suspended'),
        revokedWhere: withStatus('revoked'),
        take: PAGE_SIZE,
      },
    ),
    carrier
      ? keystoneClient<{ users: Array<{ id: string; name: string | null; email: string | null }> | null }>(
        `query StationsDeskUsers($carrierId: ID!) { users(where: { carrier: { id: { equals: $carrierId } } }, orderBy: [{ name: asc }], take: 500) { id name email } }`,
        { carrierId: carrier.id },
      )
      : Promise.resolve(null),
    keystoneClient<{ airports: Array<{ id: string; iataCode: string | null; name: string | null; city: string | null }> | null }>(
      `query StationsDeskAirports { airports(where: { isActive: { equals: true } }, orderBy: [{ iataCode: asc }], take: 1000) { id iataCode name city } }`,
    ),
  ])

  const userOptions = users?.success ? users.data.users ?? [] : []
  const airportOptions = airports.success ? airports.data.airports ?? [] : []
  const rows = assignments.success ? assignments.data.stationAssignments : null
  const counts = assignments.success ? assignments.data : null
  const now = Date.now()
  const total = counts ? (status ? counts[status as (typeof STATUSES)[number]] : counts.all) ?? 0 : 0

  const groups = new Map<string, { label: string; city: string | null; rows: Assignment[] }>()
  for (const row of rows ?? []) {
    const code = row.airport?.iataCode ?? '---'
    const group = groups.get(code) ?? { label: code, city: row.airport?.city ?? row.airport?.name ?? null, rows: [] }
    group.rows.push(row)
    groups.set(code, group)
  }
  const sortedGroups = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label))
  const selectedAirport = airportOptions.find(option => option.iataCode === airport)
  const selectedUser = userOptions.find(option => option.id === user)

  const tabs = [
    { value: '', label: 'All', count: counts?.all },
    { value: 'active', label: 'Active', count: counts?.active },
    { value: 'suspended', label: 'Suspended', count: counts?.suspended },
    { value: 'revoked', label: 'Revoked', count: counts?.revoked },
  ]

  return (
    <PageContainer
      title="Stations & access"
      header={
        <DeskHeader
          eyebrow="Station control"
          title="Stations & access"
          meta={counts ? <span className="tabular-nums ">{counts.active ?? 0} active</span> : undefined}
        />
      }
      breadcrumbs={[
        { type: 'link', label: 'Dashboard', href: '/dashboard' },
        { type: 'page', label: 'Platform' },
        { type: 'page', label: 'Stations & access' },
      ]}
    >
      <div className="min-w-0 space-y-6 p-4 [overflow-wrap:anywhere] md:p-6">
        {!identity.success || !carrier ? (
          <Notice tone="warn">Carrier unavailable for your account.</Notice>
        ) : users && !users.success ? (
          <Notice tone="warn">Carrier users are unavailable under your current access.</Notice>
        ) : !airports.success ? (
          <Notice tone="warn">Airports are unavailable under your current access.</Notice>
        ) : (
          <NewStationAssignment users={userOptions} airports={airportOptions} defaultAirportId={selectedAirport?.id} defaultUserId={selectedUser?.id} />
        )}

        <Track aria-label="Assignment status" className="max-w-full">
          {tabs.map(tab => (
            <Pill key={tab.value || 'all'} asChild size="sm" active={status === tab.value}>
              <Link href={hrefWith(filters, { status: tab.value })} aria-current={status === tab.value ? 'page' : undefined}>
                {tab.label}
                {tab.count != null && <span className="tabular-nums text-[11px]  text-muted-foreground">{tab.count}</span>}
              </Link>
            </Pill>
          ))}
        </Track>

        <FilterBar action={PATH}>
          {status && <input type="hidden" name="status" value={status} />}
          <Field label="Airport" className="sm:w-56">
            <select name="airport" defaultValue={airport} className={`${deskInput} tabular-nums`}>
              <option value="">All airports</option>
              {airportOptions.map(option => (
                <option key={option.id} value={option.iataCode ?? ''}>{option.iataCode} {option.city || option.name || ''}</option>
              ))}
            </select>
          </Field>
          <Field label="User" className="sm:flex-1">
            <select name="user" defaultValue={user} className={deskInput}>
              <option value="">All users</option>
              {userOptions.map(option => (
                <option key={option.id} value={option.id}>{option.name || option.email || option.id}</option>
              ))}
            </select>
          </Field>
          <Track>
            <Pill type="submit">Filter</Pill>
            <Pill asChild><Link href={status ? `${PATH}?status=${status}` : PATH}>Clear</Link></Pill>
          </Track>
        </FilterBar>

        {!assignments.success || rows === null ? (
          <Notice tone="warn" role="alert">
            <span>Station assignments are unavailable under your current access.</span>
            <Link href={hrefWith(filters, {})} className="ml-2 font-medium underline underline-offset-4">Retry</Link>
          </Notice>
        ) : rows.length === 0 ? (
          <Well>No station assignments.</Well>
        ) : (
          <div className="space-y-8">
            {total > rows.length && (
              <Notice tone="info"><span className="tabular-nums ">Latest {rows.length} of {total}</span></Notice>
            )}
            {sortedGroups.map(group => (
              <DeskSection
                key={group.label}
                title={<span><span className="tabular-nums tracking-wider">{group.label}</span>{group.city && <span className="ml-2 font-normal text-muted-foreground">{group.city}</span>}</span>}
                count={group.rows.length}
              >
                <Panel className="divide-y">
                  <div aria-hidden="true" className="hidden gap-x-4 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground lg:grid lg:grid-cols-[minmax(10rem,1.2fr)_minmax(8rem,1fr)_minmax(10rem,1fr)_auto]"><span>Assignee</span><span>Duties</span><span>Valid</span><span /></div>
                  {group.rows.map(row => {
                    const state = effectiveState(row, now)
                    const from = formatInstant(row.validFrom)
                    const until = formatInstant(row.validUntil)
                    return (
                      <div key={row.id} className="grid min-w-0 gap-x-4 gap-y-1 px-3 py-2 text-sm lg:grid-cols-[minmax(10rem,1.2fr)_minmax(8rem,1fr)_minmax(10rem,1fr)_auto] lg:items-start">
                        <div className="min-w-0">
                          <TitleLine as="h3" tone={state.tone} status={state.label} className="font-medium text-foreground">
                            {row.user ? (
                              <Link href={hrefWith(filters, { user: row.user.id })} className="hover:underline hover:underline-offset-4">{row.user.name || row.user.email || 'Unnamed user'}</Link>
                            ) : 'User unavailable'}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">{state.label}</span>
                          </TitleLine>
                          {row.user?.email && row.user.name && <p className="pl-[1.375rem] text-xs text-muted-foreground">{row.user.email}</p>}
                        </div>
                        <p className="pl-[1.375rem] text-foreground/80 lg:pl-0">
                          {[row.canCheckIn && 'Check-in', row.canAcceptBags && 'Bags', row.canBoard && 'Boarding'].filter(Boolean).join(', ') || <span className="text-muted-foreground">No duties</span>}
                        </p>
                        <p className="pl-[1.375rem] tabular-nums text-muted-foreground lg:pl-0">
                          {from ?? 'Immediately'} to {until ?? 'Open-ended'}
                        </p>
                        <div className="min-w-0 pl-[1.375rem] lg:pl-0">
                          <StationAssignmentActions
                            assignment={{
                              id: row.id,
                              status: row.status,
                              canCheckIn: Boolean(row.canCheckIn),
                              canAcceptBags: Boolean(row.canAcceptBags),
                              canBoard: Boolean(row.canBoard),
                              validFrom: row.validFrom,
                              validUntil: row.validUntil,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </Panel>
              </DeskSection>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  )
}
