import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { Notice } from '@/features/platform/components/desk'
import { Shell } from '@/features/platform/screens/Canonical/PlatformDeskPages'
import { textSearch } from '@/features/platform/lib/worklist-search'
import { AirportsPanel } from '@/features/platform/network/components/AirportsPanel'
import { DeskSearch, deskHref, Pager, pageParam, StatusTabLinks, stringParam, TabLinks } from '@/features/platform/network/components/DeskNav'
import { RoutesPanel } from '@/features/platform/network/components/RoutesPanel'
import { SchedulesPanel } from '@/features/platform/network/components/SchedulesPanel'
import { ROUTE_STATUSES, SCHEDULE_STATUSES } from '@/features/platform/network/lib/desk-shared'
import type { AirportOption, AirportRow, NetworkCarrier, RouteOption, RouteRow, ScheduleRow } from '@/features/platform/network/lib/types'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const BASE = '/dashboard/platform/network'
const PAGE_SIZE = 50
const TABS = [
  { value: 'airports', label: 'Airports' },
  { value: 'routes', label: 'Routes' },
  { value: 'schedules', label: 'Schedules' },
] as const
type Tab = (typeof TABS)[number]['value']

const CARRIER = 'authenticatedItem { ... on User { carrier { id code defaultCurrencyCode } } }'
const AIRPORT_OPTION = 'id iataCode city countryCode'
const ROUTE_OPTION = 'id routeKey status origin { iataCode } destination { iataCode }'

function statusCounts(list: string, statuses: readonly string[]) {
  return statuses.map(status => `${status}Count: ${list}Count(where: { AND: [$base, { status: { equals: ${status} } }] })`).join('\n')
}

function Unavailable() {
  return <Notice tone="bad">This section could not be loaded. Check your access and try again.</Notice>
}

async function airportsTab(q: string, page: number) {
  const where = q ? { OR: [{ iataCode: textSearch(q) }, { icaoCode: textSearch(q) }, { name: textSearch(q) }, { city: textSearch(q) }, { countryCode: textSearch(q) }] } : {}
  const response = await keystoneClient<{ airports: AirportRow[]; airportsCount: number }>(
    `query NetworkAirports($where: AirportWhereInput!, $take: Int!, $skip: Int!) {
      airports(where: $where, take: $take, skip: $skip, orderBy: [{ iataCode: asc }]) { id iataCode icaoCode name city countryCode subdivisionCode timezone isActive }
      airportsCount(where: $where)
    }`,
    { where, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE },
  )
  if (!response.success) return <Unavailable />
  const query = { tab: 'airports', q }
  return <>
    <DeskSearch action={BASE} hidden={{ tab: 'airports' }} q={q} label="Code, name or city" />
    <AirportsPanel airports={response.data.airports} total={response.data.airportsCount} canRegister />
    <Pager base={BASE} query={query} page={page} pageSize={PAGE_SIZE} total={response.data.airportsCount} />
  </>
}

async function routesTab(q: string, status: string, page: number) {
  const base = q ? {
    OR: [
      { routeKey: textSearch(q) },
      { origin: { OR: [{ iataCode: textSearch(q) }, { city: textSearch(q) }] } },
      { destination: { OR: [{ iataCode: textSearch(q) }, { city: textSearch(q) }] } },
    ],
  } : {}
  const where = status ? { AND: [base, { status: { equals: status } }] } : base
  const response = await keystoneClient<{ authenticatedItem: { carrier: NetworkCarrier } | null; routes: RouteRow[]; routesCount: number; airports: AirportOption[] } & Record<string, number>>(
    `query NetworkRoutes($base: RouteWhereInput!, $where: RouteWhereInput!, $take: Int!, $skip: Int!) {
      ${CARRIER}
      routes(where: $where, take: $take, skip: $skip, orderBy: [{ routeKey: asc }]) {
        id routeKey status distanceKilometers minimumConnectionMinutes isInternational schedulesCount
        origin { ${AIRPORT_OPTION} } destination { ${AIRPORT_OPTION} }
      }
      routesCount(where: $where)
      ${statusCounts('routes', ROUTE_STATUSES)}
      airports(where: { isActive: { equals: true } }, take: 1000, orderBy: [{ iataCode: asc }]) { ${AIRPORT_OPTION} }
    }`,
    { base, where, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE },
  )
  if (!response.success) return <Unavailable />
  const data = response.data
  const query = { tab: 'routes', q, status }
  const counts = Object.fromEntries(ROUTE_STATUSES.map(value => [value, data[`${value}Count`] as number]))
  return <>
    <DeskSearch action={BASE} hidden={{ tab: 'routes', status }} q={q} label="Airport, city or route key" />
    <RoutesPanel
      routes={data.routes}
      total={data.routesCount}
      airports={data.airports}
      carrierCode={data.authenticatedItem?.carrier?.code ?? ''}
      statusTabs={<StatusTabLinks base={BASE} query={query} current={status} counts={counts} statuses={ROUTE_STATUSES} />}
      pager={<Pager base={BASE} query={query} page={page} pageSize={PAGE_SIZE} total={data.routesCount} />}
    />
  </>
}

async function schedulesTab(q: string, status: string, routeId: string, page: number) {
  const parts: Record<string, unknown>[] = []
  if (q) parts.push({ OR: [{ flightNumber: textSearch(q) }, { scheduleKey: textSearch(q) }, { route: { routeKey: textSearch(q) } }] })
  if (routeId) parts.push({ route: { id: { equals: routeId } } })
  const base = parts.length ? { AND: parts } : {}
  const where = status ? { AND: [base, { status: { equals: status } }] } : base
  const response = await keystoneClient<{ authenticatedItem: { carrier: NetworkCarrier } | null; flightSchedules: ScheduleRow[]; flightSchedulesCount: number; routes: RouteOption[] } & Record<string, number>>(
    `query NetworkSchedules($base: FlightScheduleWhereInput!, $where: FlightScheduleWhereInput!, $take: Int!, $skip: Int!) {
      ${CARRIER}
      flightSchedules(where: $where, take: $take, skip: $skip, orderBy: [{ flightNumber: asc }]) {
        id scheduleKey flightNumber departureLocalTime arrivalLocalTime arrivalDayOffset daysOfWeek effectiveFrom effectiveTo status instancesCount
        route { ${ROUTE_OPTION} }
      }
      flightSchedulesCount(where: $where)
      ${statusCounts('flightSchedules', SCHEDULE_STATUSES)}
      routes(take: 1000, orderBy: [{ routeKey: asc }]) { ${ROUTE_OPTION} }
    }`,
    { base, where, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE },
  )
  if (!response.success) return <Unavailable />
  const data = response.data
  const query = { tab: 'schedules', q, status, route: routeId }
  const counts = Object.fromEntries(SCHEDULE_STATUSES.map(value => [value, data[`${value}Count`] as number]))
  const filteredRoute = routeId ? data.routes.find(route => route.id === routeId) : null
  return <>
    <DeskSearch action={BASE} hidden={{ tab: 'schedules', status, route: routeId }} q={q} label="Flight number or route" />
    <SchedulesPanel
      schedules={data.flightSchedules}
      total={data.flightSchedulesCount}
      routes={data.routes}
      carrierCode={data.authenticatedItem?.carrier?.code ?? ''}
      routeFilter={routeId ? {
        label: filteredRoute ? `${filteredRoute.origin?.iataCode ?? '---'}-${filteredRoute.destination?.iataCode ?? '---'}` : 'Unknown route',
        clearHref: deskHref(BASE, { tab: 'schedules', q, status }),
      } : null}
      statusTabs={<StatusTabLinks base={BASE} query={query} current={status} counts={counts} statuses={SCHEDULE_STATUSES} />}
      pager={<Pager base={BASE} query={query} page={page} pageSize={PAGE_SIZE} total={data.flightSchedulesCount} />}
    />
  </>
}

export async function NetworkPage({ searchParams }: { searchParams?: SearchParams } = {}) {
  const params = searchParams ? await searchParams : {}
  const requested = stringParam(params.tab)
  const tab: Tab = TABS.some(entry => entry.value === requested) ? requested as Tab : 'routes'
  const q = stringParam(params.q)
  const page = pageParam(params.page)
  const statuses: readonly string[] = tab === 'schedules' ? SCHEDULE_STATUSES : ROUTE_STATUSES
  const requestedStatus = stringParam(params.status)
  const status = statuses.includes(requestedStatus) ? requestedStatus : ''
  const routeId = /^[A-Za-z0-9_-]{1,64}$/.test(stringParam(params.route)) ? stringParam(params.route) : ''

  return (
    <Shell title="Network" eyebrow="Network planning" actions={<TabLinks base={BASE} current={tab} tabs={TABS} />}>
      {tab === 'airports' && await airportsTab(q, page)}
      {tab === 'routes' && await routesTab(q, status, page)}
      {tab === 'schedules' && await schedulesTab(q, status, routeId, page)}
    </Shell>
  )
}
