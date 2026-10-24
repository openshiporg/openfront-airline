import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { Notice } from '@/features/platform/components/desk'
import { Shell } from '@/features/platform/screens/Canonical/PlatformDeskPages'
import { textSearch } from '@/features/platform/lib/worklist-search'
import { AncillariesPanel } from '@/features/platform/fares/components/AncillariesPanel'
import { CabinsPanel } from '@/features/platform/fares/components/CabinsPanel'
import { FareBrandsPanel } from '@/features/platform/fares/components/FareBrandsPanel'
import { FareRulesPanel } from '@/features/platform/fares/components/FareRulesPanel'
import type { AncillaryRow, CabinOption, CabinRow, FareBrandOption, FareBrandRow, FareRouteOption, FareRuleRow } from '@/features/platform/fares/lib/types'
import { DeskSearch, Pager, pageParam, StatusTabLinks, stringParam, TabLinks } from '@/features/platform/network/components/DeskNav'
import { PRODUCT_STATUSES } from '@/features/platform/network/lib/desk-shared'

type SearchParams = Promise<Record<string, string | string[] | undefined>>
type Carrier = { authenticatedItem: { carrier: { id: string; code: string; defaultCurrencyCode: string | null } | null } | null }

const BASE = '/dashboard/platform/fares'
const PAGE_SIZE = 50
const TABS = [
  { value: 'cabins', label: 'Cabins' },
  { value: 'brands', label: 'Fare brands' },
  { value: 'rules', label: 'Fare rules' },
  { value: 'ancillaries', label: 'Ancillaries' },
] as const
type Tab = (typeof TABS)[number]['value']

const CARRIER = 'authenticatedItem { ... on User { carrier { id code defaultCurrencyCode } } }'
const ROUTE_OPTION = 'id routeKey status origin { iataCode } destination { iataCode }'

function statusCounts(list: string) {
  return PRODUCT_STATUSES.map(status => `${status}Count: ${list}Count(where: { AND: [$base, { status: { equals: ${status} } }] })`).join('\n')
}

function countsOf(data: Record<string, unknown>) {
  return Object.fromEntries(PRODUCT_STATUSES.map(status => [status, data[`${status}Count`] as number]))
}

function whereWithStatus(base: Record<string, unknown>, status: string) {
  return status ? { AND: [base, { status: { equals: status } }] } : base
}

function Unavailable() {
  return <Notice tone="bad">This section could not be loaded. Check your access and try again.</Notice>
}

async function cabinsTab(q: string, page: number) {
  const where = q ? { OR: [{ code: textSearch(q) }, { name: textSearch(q) }] } : {}
  const response = await keystoneClient<{ cabins: CabinRow[]; cabinsCount: number }>(
    `query FaresCabins($where: CabinWhereInput!, $take: Int!, $skip: Int!) {
      cabins(where: $where, take: $take, skip: $skip, orderBy: [{ displayOrder: asc }, { code: asc }]) { id code name cabinClass displayOrder fareBrandsCount }
      cabinsCount(where: $where)
    }`,
    { where, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE },
  )
  if (!response.success) return <Unavailable />
  const query = { tab: 'cabins', q }
  return <>
    <DeskSearch action={BASE} hidden={{ tab: 'cabins' }} q={q} label="Code or name" />
    <CabinsPanel cabins={response.data.cabins} total={response.data.cabinsCount} pager={<Pager base={BASE} query={query} page={page} pageSize={PAGE_SIZE} total={response.data.cabinsCount} />} />
  </>
}

async function brandsTab(q: string, status: string, page: number) {
  const base = q ? { OR: [{ code: textSearch(q) }, { name: textSearch(q) }] } : {}
  const where = whereWithStatus(base, status)
  const response = await keystoneClient<{ fareBrands: FareBrandRow[]; fareBrandsCount: number; cabins: CabinOption[] } & Record<string, unknown>>(
    `query FaresBrands($base: FareBrandWhereInput!, $where: FareBrandWhereInput!, $take: Int!, $skip: Int!) {
      fareBrands(where: $where, take: $take, skip: $skip, orderBy: [{ displayOrder: asc }, { code: asc }]) {
        id code name description status displayOrder includedBaggage rulesCount cabin { id code name }
      }
      fareBrandsCount(where: $where)
      ${statusCounts('fareBrands')}
      cabins(take: 200, orderBy: [{ displayOrder: asc }]) { id code name }
    }`,
    { base, where, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE },
  )
  if (!response.success) return <Unavailable />
  const data = response.data
  const query = { tab: 'brands', q, status }
  return <>
    <DeskSearch action={BASE} hidden={{ tab: 'brands', status }} q={q} label="Code or name" />
    <FareBrandsPanel
      brands={data.fareBrands}
      total={data.fareBrandsCount}
      cabins={data.cabins}
      statusTabs={<StatusTabLinks base={BASE} query={query} current={status} counts={countsOf(data)} statuses={PRODUCT_STATUSES} />}
      pager={<Pager base={BASE} query={query} page={page} pageSize={PAGE_SIZE} total={data.fareBrandsCount} />}
    />
  </>
}

async function rulesTab(q: string, status: string, page: number) {
  const base = q ? {
    OR: [
      { ruleKey: textSearch(q) },
      { fareBasisPattern: textSearch(q) },
      { fareBrand: { OR: [{ code: textSearch(q) }, { name: textSearch(q) }] } },
      { route: { routeKey: textSearch(q) } },
    ],
  } : {}
  const where = whereWithStatus(base, status)
  const response = await keystoneClient<Carrier & { fareRules: FareRuleRow[]; fareRulesCount: number; fareBrands: FareBrandOption[]; routes: FareRouteOption[] } & Record<string, unknown>>(
    `query FaresRules($base: FareRuleWhereInput!, $where: FareRuleWhereInput!, $take: Int!, $skip: Int!) {
      ${CARRIER}
      fareRules(where: $where, take: $take, skip: $skip, orderBy: [{ ruleKey: asc }]) {
        id ruleKey fareBasisPattern status isRefundable isChangeable changeFeeAmount cancellationFeeAmount noShowFeeAmount currencyCode
        minimumAdvancePurchaseHours minimumStayDays maximumStayDays effectiveFrom effectiveTo
        fareBrand { id code name status }
        route { ${ROUTE_OPTION} }
      }
      fareRulesCount(where: $where)
      ${statusCounts('fareRules')}
      fareBrands(where: { status: { not: { equals: archived } } }, take: 500, orderBy: [{ displayOrder: asc }, { code: asc }]) { id code name status }
      routes(where: { status: { not: { equals: archived } } }, take: 1000, orderBy: [{ routeKey: asc }]) { ${ROUTE_OPTION} }
    }`,
    { base, where, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE },
  )
  if (!response.success) return <Unavailable />
  const data = response.data
  const query = { tab: 'rules', q, status }
  return <>
    <DeskSearch action={BASE} hidden={{ tab: 'rules', status }} q={q} label="Fare basis, brand or route" />
    <FareRulesPanel
      rules={data.fareRules}
      total={data.fareRulesCount}
      brands={data.fareBrands}
      routes={data.routes}
      currencyCode={data.authenticatedItem?.carrier?.defaultCurrencyCode || 'USD'}
      statusTabs={<StatusTabLinks base={BASE} query={query} current={status} counts={countsOf(data)} statuses={PRODUCT_STATUSES} />}
      pager={<Pager base={BASE} query={query} page={page} pageSize={PAGE_SIZE} total={data.fareRulesCount} />}
    />
  </>
}

async function ancillariesTab(q: string, status: string, page: number) {
  const base = q ? { OR: [{ code: textSearch(q) }, { name: textSearch(q) }, { productKey: textSearch(q) }] } : {}
  const where = whereWithStatus(base, status)
  const response = await keystoneClient<Carrier & { ancillaryProducts: AncillaryRow[]; ancillaryProductsCount: number } & Record<string, unknown>>(
    `query FaresAncillaries($base: AncillaryProductWhereInput!, $where: AncillaryProductWhereInput!, $take: Int!, $skip: Int!) {
      ${CARRIER}
      ancillaryProducts(where: $where, take: $take, skip: $skip, orderBy: [{ code: asc }]) {
        id productKey code name description type status fulfillmentType defaultPriceAmount taxAmount currencyCode requiresInventory
      }
      ancillaryProductsCount(where: $where)
      ${statusCounts('ancillaryProducts')}
    }`,
    { base, where, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE },
  )
  if (!response.success) return <Unavailable />
  const data = response.data
  const query = { tab: 'ancillaries', q, status }
  return <>
    <DeskSearch action={BASE} hidden={{ tab: 'ancillaries', status }} q={q} label="Code or name" />
    <AncillariesPanel
      products={data.ancillaryProducts}
      total={data.ancillaryProductsCount}
      currencyCode={data.authenticatedItem?.carrier?.defaultCurrencyCode || 'USD'}
      statusTabs={<StatusTabLinks base={BASE} query={query} current={status} counts={countsOf(data)} statuses={PRODUCT_STATUSES} />}
      pager={<Pager base={BASE} query={query} page={page} pageSize={PAGE_SIZE} total={data.ancillaryProductsCount} />}
    />
  </>
}

export async function FaresPage({ searchParams }: { searchParams?: SearchParams } = {}) {
  const params = searchParams ? await searchParams : {}
  const requested = stringParam(params.tab)
  const tab: Tab = TABS.some(entry => entry.value === requested) ? requested as Tab : 'brands'
  const q = stringParam(params.q)
  const page = pageParam(params.page)
  const requestedStatus = stringParam(params.status)
  const status = (PRODUCT_STATUSES as readonly string[]).includes(requestedStatus) ? requestedStatus : ''

  return (
    <Shell title="Fares & products" eyebrow="Offers" actions={<TabLinks base={BASE} current={tab} tabs={TABS} />}>
      {tab === 'cabins' && await cabinsTab(q, page)}
      {tab === 'brands' && await brandsTab(q, status, page)}
      {tab === 'rules' && await rulesTab(q, status, page)}
      {tab === 'ancillaries' && await ancillariesTab(q, status, page)}
    </Shell>
  )
}
