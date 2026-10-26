'use client'

import Link from 'next/link'
import { NO_RECORD_ID } from '@/features/platform/lib/no-cursor'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DeskSection,
  Meter,
  Notice,
  Panel,
  Pill,
  Readout,
  ReadoutStrip,
  Route,
  StatusLabel,
  TitleLine,
  Track,
  Well,
  deskInput,
  statusTone,
  type DeskTone,
} from '@/features/platform/components/desk'
import { flightWorklistHref } from '@/features/platform/lib/flight-worklist'
import { scheduleWorklistHref } from '@/features/platform/lib/schedule-worklist'
import {
  canEditVisibleInventoryBucket,
  emptyInventoryBucketWorklistPage,
  inventoryBucketWorklistPage,
  inventoryBucketWorklistScope,
  INVENTORY_BUCKET_WORKLIST_PAGE_SIZE,
  NETWORK_SELECTED_FLIGHT_BUCKETS_QUERY,
  resolveInventoryFlightSelection,
  selectedFlightBucketWhere,
  type InventoryBucketWorklistActor,
  type InventoryBucketWorklistItem,
  type InventoryBucketWorklistPage,
  type InventoryBucketWorklistScope,
} from '@/features/platform/lib/inventory-bucket-worklist'
import {
  cabinReadScope,
  cabinWorklistPage,
  cabinWorklistWhere,
  CABIN_WORKLIST_PAGE_SIZE,
  emptyCabinWorklistPage,
  NETWORK_PROVISIONING_CABINS_QUERY,
  normalizeCabinSearch,
  resolveProvisioningCabinId,
  type CabinReadActor,
  type CabinReadScope,
  type CabinWorklistPage,
  type ProvisioningCabin,
} from '@/features/platform/lib/provisioning-cabin-worklist'
import {
  cabinActiveFareBrandWhere,
  compatibleActiveFareBrands,
  fareBrandReadScope,
  fareBrandWorklistPage,
  initialCompatibleFareBrandId,
  FARE_BRAND_WORKLIST_PAGE_SIZE,
  NETWORK_CABIN_FARE_BRANDS_QUERY,
  normalizeFareBrandSearch,
  provisioningFareBrandBinding,
  resolveCompatibleFareBrandId,
  type FareBrand,
  type FareBrandReadActor,
  type FareBrandReadScope,
  type FareBrandWorklistPage,
} from '@/features/platform/lib/provisioning-fare-brand'

type Schedule = { id: string; flightNumber: string; departureLocalTime?: string | null; arrivalLocalTime?: string | null; route: { origin: { iataCode: string }; destination: { iataCode: string } } }
type Flight = { id: string; flightNumber: string; serviceDate: string; scheduledDepartureAt: string; status: string; carrier?: { id: string } | null; origin: { iataCode: string }; destination: { iataCode: string }; inventoryBuckets?: Array<{ id: string; status: string; authorized: number; capacity: number; sold: number; held: number; blocked: number; bookingClassCode: string }>; inventoryBucketsOverflow?: boolean }

async function mutate(query: string, variables: Record<string, unknown>) {
  const response = await fetch('/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify({ query, variables }) })
  const payload = await response.json() as { data?: any; errors?: Array<{ message: string }> }
  if (!response.ok || payload.errors?.length || !payload.data) throw new Error(payload.errors?.[0]?.message ?? 'Network operation failed.')
  return payload.data
}

type WorklistState = 'ready' | 'empty' | 'stale' | 'inconsistent' | 'unavailable'
type ScheduleWorklistView = {
  state: WorklistState
  totalCount: number | null
  pageItemCount: number
  nextCursor: string | null
  cursor: string | null
}
type FlightWorklistView = ScheduleWorklistView & { from: string }

const fieldLabel = 'flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground'
const linkFocus = 'rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function flightTone(status: string): DeskTone {
  return status === 'closed_for_sale' ? 'idle' : statusTone(status)
}

/** Pagination links rendered as pills in a track. */
function PageLinks({ firstHref, nextHref, firstLabel = 'First page', nextLabel }: { firstHref: string | null; nextHref: string | null; firstLabel?: string; nextLabel: string }) {
  if (!firstHref && !nextHref) return null
  return <Track>
    {firstHref && <Pill asChild><Link href={firstHref}>{firstLabel}</Link></Pill>}
    {nextHref && <Pill asChild><Link href={nextHref}>{nextLabel}<ChevronRight /></Link></Pill>}
  </Track>
}

/** A state notice with an optional recovery action beneath it. */
function StateNotice({ tone = 'warn', role, children, action }: { tone?: DeskTone; role?: 'alert' | 'status'; children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="space-y-2">
    <Notice tone={tone} role={role}>{children}</Notice>
    {action && <Track>{action}</Track>}
  </div>
}

/** Sold / held / blocked / capacity figures for one bucket. */
function BucketFigures({ sold, held, blocked, capacity }: { sold: number; held: number; blocked: number; capacity: number }) {
  const committed = sold + held + blocked
  return <span className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums text-xs  text-muted-foreground">
    <Meter value={capacity ? committed / capacity : 0} segments={10} label={`${committed} of ${capacity} committed`} />
    <span><span className="text-foreground">{sold}</span> sold</span>
    <span><span className="text-foreground">{held}</span> held</span>
    <span><span className="text-foreground">{blocked}</span> blk</span>
    <span><span className="text-foreground">{capacity}</span> cap</span>
  </span>
}

const emptyFareBrandPage = (state: FareBrandWorklistPage['state']): FareBrandWorklistPage => ({
  items: [], totalCount: null, hasNextPage: false, nextCursor: null, state,
})

async function readInventoryBucketPage(flightId: string, carrierId: string, cursor: string | null): Promise<InventoryBucketWorklistPage> {
  const bucketWhere = selectedFlightBucketWhere(flightId, carrierId)
  if (!bucketWhere) return emptyInventoryBucketWorklistPage('unavailable')

  try {
    const response = await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        query: NETWORK_SELECTED_FLIGHT_BUCKETS_QUERY,
        variables: {
          bucketWhere,
          bucketCursor: cursor ? { id: cursor } : null,
          bucketSkip: cursor ? 1 : 0,
          bucketCursorId: cursor ?? NO_RECORD_ID,
        },
      }),
    })
    const payload = await response.json() as {
      data?: {
        authenticatedItem?: InventoryBucketWorklistActor
        inventoryBuckets?: InventoryBucketWorklistItem[] | null
        inventoryBucketsCount?: number | null
        inventoryBucketCursorRecord?: Array<{ id: string }> | null
      }
      errors?: Array<{ message?: string }>
    }
    const scope: InventoryBucketWorklistScope = inventoryBucketWorklistScope(payload.data?.authenticatedItem, carrierId)
    if (scope !== 'authorized') return emptyInventoryBucketWorklistPage(scope)
    if (!response.ok || payload.errors?.length || !payload.data) return emptyInventoryBucketWorklistPage('unavailable')
    const cursorAuthorized = !cursor || Boolean(payload.data.inventoryBucketCursorRecord?.some(record => record.id === cursor))
    return inventoryBucketWorklistPage({
      rows: payload.data.inventoryBuckets,
      totalCount: payload.data.inventoryBucketsCount,
      flightId,
      carrierId,
      cursor,
      cursorAuthorized,
      scope,
      canManageInventory: payload.data.authenticatedItem?.role?.canManageInventory === true,
    })
  } catch {
    return emptyInventoryBucketWorklistPage('unavailable')
  }
}

async function readCabinPage(search: string, cursor: string | null): Promise<CabinWorklistPage> {
  try {
    const response = await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        query: NETWORK_PROVISIONING_CABINS_QUERY,
        variables: {
          cabinWhere: cabinWorklistWhere(search),
          cabinCursor: cursor ? { id: cursor } : null,
          cabinSkip: cursor ? 1 : 0,
          cabinCursorId: cursor ?? NO_RECORD_ID,
        },
      }),
    })
    const payload = await response.json() as {
      data?: {
        authenticatedItem?: CabinReadActor
        cabins?: ProvisioningCabin[] | null
        cabinsCount?: number | null
        cabinCursorRecord?: Array<{ id: string }> | null
      }
      errors?: Array<{ message?: string }>
    }
    const scope: CabinReadScope = cabinReadScope(payload.data?.authenticatedItem)
    if (scope !== 'authorized') return emptyCabinWorklistPage(scope)
    if (!response.ok || payload.errors?.length || !payload.data) return emptyCabinWorklistPage('unavailable')
    const cursorAuthorized = !cursor || Boolean(payload.data.cabinCursorRecord?.some(record => record.id === cursor))
    return cabinWorklistPage({
      rows: payload.data.cabins,
      totalCount: payload.data.cabinsCount,
      cursor,
      cursorAuthorized,
      scope,
    })
  } catch {
    return emptyCabinWorklistPage('unavailable')
  }
}

async function readFareBrandPage(cabinId: string, search: string, cursor: string | null): Promise<FareBrandWorklistPage> {
  const fareBrandWhere = cabinActiveFareBrandWhere(cabinId, search)
  if (!fareBrandWhere) return emptyFareBrandPage('unavailable')

  try {
    const response = await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        query: NETWORK_CABIN_FARE_BRANDS_QUERY,
        variables: {
          fareBrandWhere,
          fareBrandCursor: cursor ? { id: cursor } : null,
          fareBrandSkip: cursor ? 1 : 0,
          fareBrandCursorId: cursor ?? NO_RECORD_ID,
        },
      }),
    })
    const payload = await response.json() as {
      data?: {
        authenticatedItem?: FareBrandReadActor
        fareBrands?: FareBrand[] | null
        fareBrandsCount?: number | null
        fareBrandCursorRecord?: Array<{ id: string }> | null
      }
      errors?: Array<{ message?: string }>
    }
    const scope: FareBrandReadScope = fareBrandReadScope(payload.data?.authenticatedItem)
    if (scope !== 'authorized') return emptyFareBrandPage(scope)
    if (!response.ok || payload.errors?.length || !payload.data) return emptyFareBrandPage('unavailable')
    const cursorAuthorized = !cursor || Boolean(payload.data.fareBrandCursorRecord?.some(record => record.id === cursor))
    return fareBrandWorklistPage({
      rows: payload.data.fareBrands,
      totalCount: payload.data.fareBrandsCount,
      cabinId,
      cursor,
      cursorAuthorized,
      scope,
    })
  } catch {
    return emptyFareBrandPage('unavailable')
  }
}

export function NetworkDesk({ schedules, flights, defaultCurrencyCode, defaultTimezone, mode = 'all', detailBase = '/dashboard/network', scheduleSelectionId, scheduleSelectionUnavailable = false, scheduleWorklist, flightWorklist, inventoryActorCarrierId }: { schedules: Schedule[]; flights: Flight[]; defaultCurrencyCode: string; defaultTimezone: string; mode?: 'all' | 'schedules' | 'inventory'; detailBase?: string; scheduleSelectionId?: string; scheduleSelectionUnavailable?: boolean; scheduleWorklist?: ScheduleWorklistView; flightWorklist?: FlightWorklistView; inventoryActorCarrierId?: string }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  // Command failures render as alerts, not in the success-styled status banner.
  const [messageFailed, setMessageFailed] = useState(false)
  const [working, setWorking] = useState<string | null>(null)
  const [scheduleId, setScheduleId] = useState(scheduleSelectionId ?? schedules[0]?.id ?? '')
  const [scheduleSelectionInvalid, setScheduleSelectionInvalid] = useState(scheduleSelectionUnavailable)
  useEffect(() => {
    setScheduleId(scheduleSelectionId ?? '')
    setScheduleSelectionInvalid(scheduleSelectionUnavailable)
  }, [scheduleSelectionId, scheduleSelectionUnavailable])
  const [cabinId, setCabinId] = useState('')
  const [cabinSearchInput, setCabinSearchInput] = useState('')
  const [cabinSearch, setCabinSearch] = useState('')
  const [cabinCursor, setCabinCursor] = useState<string | null>(null)
  const [cabinCursorStack, setCabinCursorStack] = useState<Array<string | null>>([])
  const [cabinRequestNonce, setCabinRequestNonce] = useState(0)
  const [cabinPage, setCabinPage] = useState<CabinWorklistPage>(() => emptyCabinWorklistPage('loading'))
  const cabinRequestGeneration = useRef(0)
  const autoSelectFirstCabin = useRef(true)
  const [fareBrandId, setFareBrandId] = useState('')
  const [fareBrandSearchInput, setFareBrandSearchInput] = useState('')
  const [fareBrandSearch, setFareBrandSearch] = useState('')
  const [fareBrandCursor, setFareBrandCursor] = useState<string | null>(null)
  const [fareBrandCursorStack, setFareBrandCursorStack] = useState<Array<string | null>>([])
  const [fareBrandRequestNonce, setFareBrandRequestNonce] = useState(0)
  const [fareBrandPage, setFareBrandPage] = useState<FareBrandWorklistPage>(() => emptyFareBrandPage('loading'))
  const fareBrandRequestGeneration = useRef(0)
  const autoSelectFirstFareBrand = useRef(true)
  const selectedCabinId = cabinPage.state === 'ready' || cabinPage.state === 'overflow'
    ? resolveProvisioningCabinId(cabinPage.items, cabinId)
    : ''
  const compatibleBrands = useMemo(() => compatibleActiveFareBrands(fareBrandPage.items, selectedCabinId), [fareBrandPage.items, selectedCabinId])
  const selectedFareBrandId = resolveCompatibleFareBrandId(compatibleBrands, selectedCabinId, fareBrandId)
  const departureDateTime = useMemo(() => new Intl.DateTimeFormat('en-US', { timeZone: defaultTimezone, dateStyle: 'medium', timeStyle: 'short' }), [defaultTimezone])
  const defaultDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
  const [serviceDate, setServiceDate] = useState(defaultDate)
  const [departure, setDeparture] = useState(`${defaultDate}T09:00`)
  const [arrival, setArrival] = useState(`${defaultDate}T10:20`)
  const [capacity, setCapacity] = useState('30')
  const [baseAmount, setBaseAmount] = useState('12900')
  const [taxAmount, setTaxAmount] = useState('2580')
  const [currencyCode, setCurrencyCode] = useState(defaultCurrencyCode)
  const inventoryWriteBusy = useRef(false)
  const [authorizations, setAuthorizations] = useState<Record<string, string>>({})
  const [inventoryFlightId, setInventoryFlightId] = useState('')
  const [inventoryBucketCursor, setInventoryBucketCursor] = useState<string | null>(null)
  const [inventoryBucketCursorStack, setInventoryBucketCursorStack] = useState<Array<string | null>>([])
  const [inventoryBucketRequestNonce, setInventoryBucketRequestNonce] = useState(0)
  const [inventoryBucketPage, setInventoryBucketPage] = useState<InventoryBucketWorklistPage>(() => emptyInventoryBucketWorklistPage('loading'))
  const inventoryBucketRequestGeneration = useRef(0)
  const selectedInventoryFlight = resolveInventoryFlightSelection(flights, inventoryFlightId, inventoryActorCarrierId ?? '')
  const selectedInventoryFlightState = selectedInventoryFlight.state
  const authorizedInventoryFlightId = selectedInventoryFlight.flightId
  const selectedInventoryFlightRecord = flights.find(flight => flight.id === authorizedInventoryFlightId) ?? null
  const fareBrandBinding = (cabinPage.state === 'ready' || cabinPage.state === 'overflow')
    && selectedCabinId
    && (fareBrandPage.state === 'ready' || fareBrandPage.state === 'overflow')
    ? provisioningFareBrandBinding({ pageBrands: fareBrandPage.items, selectedFareBrandId: fareBrandId, cabinId: selectedCabinId, scheduleId, serviceDate })
    : null
  const staleFareBrandSelection = Boolean(fareBrandId && !selectedFareBrandId)
  useEffect(() => {
    if (mode === 'inventory') return
    const requestId = ++cabinRequestGeneration.current
    const chooseInitialCabin = autoSelectFirstCabin.current
    setCabinPage(emptyCabinWorklistPage('loading'))
    void readCabinPage(cabinSearch, cabinCursor).then(page => {
      if (cabinRequestGeneration.current !== requestId) return
      setCabinPage(page)
      if (chooseInitialCabin && (page.state === 'ready' || page.state === 'overflow') && page.items.length) {
        setCabinId(page.items[0].id)
      }
      autoSelectFirstCabin.current = false
    })
    return () => {
      if (cabinRequestGeneration.current === requestId) cabinRequestGeneration.current += 1
    }
  }, [cabinSearch, cabinCursor, cabinRequestNonce, mode])
  useEffect(() => {
    if (mode === 'inventory') return
    const requestId = ++fareBrandRequestGeneration.current
    const chooseInitialBrand = autoSelectFirstFareBrand.current
    setFareBrandPage(emptyFareBrandPage('loading'))
    if (!selectedCabinId) {
      return () => { fareBrandRequestGeneration.current += 1 }
    }
    void readFareBrandPage(selectedCabinId, fareBrandSearch, fareBrandCursor).then(page => {
      if (fareBrandRequestGeneration.current !== requestId) return
      setFareBrandPage(page)
      if (chooseInitialBrand && (page.state === 'ready' || page.state === 'overflow') && page.items.length) {
        setFareBrandId(initialCompatibleFareBrandId(page.items, selectedCabinId))
      }
      autoSelectFirstFareBrand.current = false
    })
    return () => {
      if (fareBrandRequestGeneration.current === requestId) fareBrandRequestGeneration.current += 1
    }
  }, [selectedCabinId, fareBrandSearch, fareBrandCursor, fareBrandRequestNonce, mode])
  useEffect(() => {
    if (mode !== 'inventory') return
    const requestId = ++inventoryBucketRequestGeneration.current
    const state = selectedInventoryFlightState
    const selectedFlightId = authorizedInventoryFlightId
    if (state !== 'authorized' || !selectedFlightId || !inventoryActorCarrierId) {
      setInventoryBucketPage(emptyInventoryBucketWorklistPage(state === 'stale' ? 'stale' : state === 'unavailable' ? 'unavailable' : 'loading'))
      return () => { inventoryBucketRequestGeneration.current += 1 }
    }
    setInventoryBucketPage(emptyInventoryBucketWorklistPage('loading'))
    void readInventoryBucketPage(selectedFlightId, inventoryActorCarrierId, inventoryBucketCursor).then(page => {
      if (inventoryBucketRequestGeneration.current !== requestId) return
      setInventoryBucketPage(page)
      if (page.state === 'ready') setAuthorizations(current => Object.fromEntries(Object.entries(current).filter(([id,value]) => !page.items.some(bucket => bucket.id === id && String(bucket.authorized) === value))))
    })
    return () => {
      if (inventoryBucketRequestGeneration.current === requestId) inventoryBucketRequestGeneration.current += 1
    }
  }, [mode, selectedInventoryFlightState, authorizedInventoryFlightId, inventoryActorCarrierId, inventoryBucketCursor, inventoryBucketRequestNonce])
  const scheduleFlightState = flightWorklist ? {
    ...(flightWorklist.cursor ? { flightCursor: flightWorklist.cursor } : {}),
    flightFrom: flightWorklist.from,
  } : {}
  const flightScheduleState = {
    ...(scheduleWorklist?.cursor ? { scheduleCursor: scheduleWorklist.cursor } : {}),
    ...(scheduleId ? { scheduleId } : {}),
  }
  const scheduleNextHref = scheduleWorklist?.state === 'ready' && scheduleWorklist.nextCursor
    ? scheduleWorklistHref(detailBase, scheduleWorklist.nextCursor, scheduleId, scheduleFlightState)
    : null
  const scheduleFirstHref = scheduleWorklist?.cursor
    ? scheduleWorklistHref(detailBase, null, scheduleId, scheduleFlightState)
    : null
  const flightNextHref = flightWorklist?.state === 'ready' && flightWorklist.nextCursor
    ? flightWorklistHref(detailBase, flightWorklist.nextCursor, flightWorklist.from, flightScheduleState)
    : null
  const flightFirstHref = flightWorklist?.cursor
    ? flightWorklistHref(detailBase, null, flightWorklist.from, flightScheduleState)
    : null

  function selectSchedule(nextScheduleId: string) {
    setScheduleId(nextScheduleId)
    setScheduleSelectionInvalid(false)
    const url = new URL(window.location.href)
    if (nextScheduleId) url.searchParams.set('scheduleId', nextScheduleId)
    else url.searchParams.delete('scheduleId')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }

  function clearProvisioningCabin() {
    autoSelectFirstFareBrand.current = false
    setCabinId('')
    setFareBrandId('')
    setFareBrandPage(emptyFareBrandPage('loading'))
    setFareBrandCursor(null)
    setFareBrandCursorStack([])
  }

  function selectCabin(nextCabinId: string) {
    autoSelectFirstFareBrand.current = false
    setCabinId(resolveProvisioningCabinId(cabinPage.items, nextCabinId))
    setFareBrandId('')
    setFareBrandPage(emptyFareBrandPage('loading'))
    setFareBrandCursor(null)
    setFareBrandCursorStack([])
  }

  function searchCabins() {
    autoSelectFirstCabin.current = false
    clearProvisioningCabin()
    setCabinPage(emptyCabinWorklistPage('loading'))
    setCabinCursor(null)
    setCabinCursorStack([])
    setCabinSearch(normalizeCabinSearch(cabinSearchInput))
    setCabinRequestNonce(value => value + 1)
  }

  function nextCabinPage() {
    if (!cabinPage.hasNextPage || !cabinPage.nextCursor) return
    autoSelectFirstCabin.current = false
    clearProvisioningCabin()
    setCabinPage(emptyCabinWorklistPage('loading'))
    setCabinCursorStack(current => [...current, cabinCursor])
    setCabinCursor(cabinPage.nextCursor)
  }

  function previousCabinPage() {
    if (!cabinCursorStack.length) return
    autoSelectFirstCabin.current = false
    clearProvisioningCabin()
    setCabinPage(emptyCabinWorklistPage('loading'))
    setCabinCursor(cabinCursorStack.at(-1) ?? null)
    setCabinCursorStack(current => current.slice(0, -1))
  }

  function restartCabinList() {
    autoSelectFirstCabin.current = false
    clearProvisioningCabin()
    setCabinPage(emptyCabinWorklistPage('loading'))
    setCabinCursor(null)
    setCabinCursorStack([])
    setCabinRequestNonce(value => value + 1)
  }

  function searchFareBrands() {
    autoSelectFirstFareBrand.current = false
    setFareBrandId('')
    setFareBrandPage(emptyFareBrandPage('loading'))
    setFareBrandCursor(null)
    setFareBrandCursorStack([])
    setFareBrandSearch(normalizeFareBrandSearch(fareBrandSearchInput))
    setFareBrandRequestNonce(value => value + 1)
  }

  function nextFareBrandPage() {
    if (!fareBrandPage.hasNextPage || !fareBrandPage.nextCursor) return
    autoSelectFirstFareBrand.current = false
    setFareBrandId('')
    setFareBrandPage(emptyFareBrandPage('loading'))
    setFareBrandCursorStack(current => [...current, fareBrandCursor])
    setFareBrandCursor(fareBrandPage.nextCursor)
  }

  function previousFareBrandPage() {
    if (!fareBrandCursorStack.length) return
    autoSelectFirstFareBrand.current = false
    setFareBrandId('')
    setFareBrandPage(emptyFareBrandPage('loading'))
    setFareBrandCursor(fareBrandCursorStack.at(-1) ?? null)
    setFareBrandCursorStack(current => current.slice(0, -1))
  }

  function restartFareBrandList() {
    autoSelectFirstFareBrand.current = false
    setFareBrandId('')
    setFareBrandPage(emptyFareBrandPage('loading'))
    setFareBrandCursor(null)
    setFareBrandCursorStack([])
    setFareBrandRequestNonce(value => value + 1)
  }

  function selectInventoryFlight(nextFlightId: string) {
    if (inventoryWriteBusy.current) return
    if (Object.keys(authorizations).length && !window.confirm('Discard unsaved inventory authorization changes?')) return
    setInventoryFlightId(nextFlightId)
    setInventoryBucketPage(emptyInventoryBucketWorklistPage('loading'))
    setInventoryBucketCursor(null)
    setInventoryBucketCursorStack([])
    setAuthorizations({})
    setInventoryBucketRequestNonce(value => value + 1)
  }

  function nextInventoryBucketPage() {
    if (inventoryWriteBusy.current) return
    if (Object.keys(authorizations).length && !window.confirm('Discard unsaved inventory authorization changes?')) return
    if (!inventoryBucketPage.hasNextPage || !inventoryBucketPage.nextCursor) return
    setInventoryBucketPage(emptyInventoryBucketWorklistPage('loading'))
    setInventoryBucketCursorStack(current => [...current, inventoryBucketCursor])
    setInventoryBucketCursor(inventoryBucketPage.nextCursor)
    setAuthorizations({})
  }

  function previousInventoryBucketPage() {
    if (inventoryWriteBusy.current) return
    if (Object.keys(authorizations).length && !window.confirm('Discard unsaved inventory authorization changes?')) return
    if (!inventoryBucketCursorStack.length) return
    setInventoryBucketPage(emptyInventoryBucketWorklistPage('loading'))
    setInventoryBucketCursor(inventoryBucketCursorStack.at(-1) ?? null)
    setInventoryBucketCursorStack(current => current.slice(0, -1))
    setAuthorizations({})
  }

  function restartInventoryBucketList() {
    if (inventoryWriteBusy.current) return
    if (Object.keys(authorizations).length && !window.confirm('Discard unsaved inventory authorization changes?')) return
    setInventoryBucketPage(emptyInventoryBucketWorklistPage('loading'))
    setInventoryBucketCursor(null)
    setInventoryBucketCursorStack([])
    setAuthorizations({})
    setInventoryBucketRequestNonce(value => value + 1)
  }

  async function saveSelectedBucketAuthorization(bucketId: string, authorized: number) {
    const selected = resolveInventoryFlightSelection(flights, inventoryFlightId, inventoryActorCarrierId ?? '')
    const isAllowed = selected.state === 'authorized' && Boolean(selected.flightId) && canEditVisibleInventoryBucket({
      page: inventoryBucketPage,
      flightId: selected.flightId ?? '',
      carrierId: inventoryActorCarrierId ?? '',
      bucketId,
    })
    if (!isAllowed) {
      setMessage('This inventory bucket is no longer on the current carrier-authorized page or this role cannot manage inventory.')
      return
    }
    if (inventoryWriteBusy.current) return
    inventoryWriteBusy.current = true
    try {
    const saved = await run(bucketId, () => mutate(
      `mutation($bucket:ID!,$authorized:Int!,$key:String!){setInventoryAuthorization(inventoryBucketId:$bucket,authorized:$authorized,idempotencyKey:$key){status}}`,
      { bucket: bucketId, authorized, key: `authorize-${bucketId}-${crypto.randomUUID()}` },
    ), 'Inventory authorization saved. Reloading current counts…')
    if (saved) setInventoryBucketRequestNonce(value => value + 1)
    } finally { inventoryWriteBusy.current = false }
  }

  async function run(key: string, operation: () => Promise<unknown>, success: string) {
    setWorking(key); setMessageFailed(false); setMessage('')
    try { await operation(); setMessage(success); router.refresh(); return true }
    catch (error) { setMessageFailed(true); setMessage(error instanceof Error ? error.message : 'Network operation failed.'); return false }
    finally { setWorking(current => current === key ? null : current) }
  }

  async function provision(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedCabinId) {
      setMessage(cabinPage.state === 'denied'
        ? 'The current role cannot read carrier cabins; provisioning is unavailable.'
        : cabinPage.state === 'unavailable' || cabinPage.state === 'loading'
          ? 'The authorized carrier-cabin list or count is unavailable; provisioning is blocked.'
          : cabinPage.state === 'stale' || cabinPage.state === 'inconsistent'
            ? 'The carrier-cabin page is stale or inconsistent. Restart the list before provisioning.'
            : 'Select a carrier cabin from the current authorized page before provisioning.')
      return
    }
    if (!fareBrandBinding) {
      setMessage(fareBrandPage.state === 'denied'
        ? 'The current role cannot read fare brands; provisioning is unavailable.'
        : fareBrandPage.state === 'unavailable' || fareBrandPage.state === 'loading'
          ? 'The authorized cabin fare-brand list or count is unavailable; provisioning is blocked.'
          : fareBrandPage.state === 'stale' || fareBrandPage.state === 'inconsistent'
            ? 'The cabin fare-brand page is stale or inconsistent. Restart the list before provisioning.'
            : 'Select an active fare brand from the current cabin page before provisioning.')
      return
    }
    await run('provision', () => mutate(`mutation($schedule:ID!,$cabin:ID!,$brand:ID!,$date:String!,$departure:String!,$arrival:String!,$capacity:Int!,$base:Int!,$tax:Int!,$currency:String!,$key:String!){provisionDatedFlight(scheduleId:$schedule,cabinId:$cabin,fareBrandId:$brand,serviceDate:$date,scheduledDepartureAt:$departure,scheduledArrivalAt:$arrival,capacity:$capacity,baseAmount:$base,taxAmount:$tax,currencyCode:$currency,idempotencyKey:$key){resourceId status changed replayed}}`, {
      schedule: scheduleId, cabin: fareBrandBinding.cabinId, brand: fareBrandBinding.fareBrandId, date: serviceDate,
      departure, arrival, capacity: Number(capacity), base: Number(baseAmount), tax: Number(taxAmount), currency: currencyCode,
      key: fareBrandBinding.idempotencyKey,
    }), 'Dated flight, inventory bucket, and published seat map provisioned idempotently.')
  }

  const openOnPage = flights.filter(flight => flight.status === 'open_for_sale').length
  const closedOnPage = flights.filter(flight => flight.status === 'closed_for_sale').length
  const showReadouts = scheduleWorklist?.state === 'ready' || flightWorklist?.state === 'ready' || flights.length > 0

  const flightsSection = <DeskSection
    title={mode === 'schedules' ? 'Dated flights' : 'Dated inventory'}
    count={flightWorklist ? (flightWorklist.totalCount ?? undefined) : flights.length}
    actions={flightWorklist?.state === 'ready' ? <div className="flex flex-wrap items-center gap-2">
      <span className="tabular-nums text-xs  text-muted-foreground">{flightWorklist.pageItemCount} on page</span>
      <PageLinks firstHref={flightFirstHref} nextHref={flightNextHref} nextLabel="Next 50" />
    </div> : undefined}
  >
    <section aria-label="Future dated flight worklist" className="space-y-3">
      {flightWorklist && (flightWorklist.state === 'unavailable' ? <Notice tone="bad" role="alert">Future flights, inventory buckets, or their count are unavailable.</Notice>
        : flightWorklist.state === 'empty' ? <Well role="status">No future dated flights.</Well>
          : flightWorklist.state === 'stale' ? <StateNotice role="status" action={flightFirstHref && <Pill asChild><Link href={flightFirstHref}>First page</Link></Pill>}>Flight page is stale.</StateNotice>
            : flightWorklist.state === 'inconsistent' ? <StateNotice role="status" action={flightFirstHref && <Pill asChild><Link href={flightFirstHref}>Reload first page</Link></Pill>}>Flight rows and count disagree.</StateNotice>
              : null)}
      {flights.length > 0 && <Panel className="divide-y">
        <div aria-hidden="true" className={cn("hidden gap-x-4 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground md:grid", mode === 'inventory' ? 'md:grid-cols-[4rem_7.5rem_minmax(8rem,1fr)_auto]' : 'md:grid-cols-[4.5rem_8.5rem_minmax(9rem,1fr)_8rem_minmax(7rem,auto)_auto]')}><span>Flight</span><span>Route</span><span>Departs</span>{mode !== 'inventory' && <><span>State</span><span>Seats sold/cap</span></>}<span /></div>
        {flights.map(flight => {
          const inventoryFlightBinding = mode === 'inventory'
            ? resolveInventoryFlightSelection(flights, flight.id, inventoryActorCarrierId ?? '')
            : null
          const canSelectInventoryFlight = inventoryFlightBinding?.state === 'authorized'
          const isSelectedInventoryFlight = inventoryFlightId === flight.id && selectedInventoryFlight.state === 'authorized'
          const buckets = flight.inventoryBuckets ?? []
          return <article key={flight.id} className={cn('min-w-0 px-3 py-2', isSelectedInventoryFlight && 'bg-muted/40')}>
            {mode !== 'inventory' && flight.inventoryBucketsOverflow && <Notice tone="warn" role="status" className="mb-2">Over 25 buckets; showing 25. Authorization editing disabled.</Notice>}
            <div className={cn('grid min-w-0 items-center gap-x-3 gap-y-1 text-sm', mode === 'inventory' ? 'md:grid-cols-[4rem_7.5rem_minmax(8rem,1fr)_auto]' : 'md:grid-cols-[4.5rem_8.5rem_minmax(9rem,1fr)_8rem_minmax(7rem,auto)_auto]')}>
              <TitleLine as="p" tone={flightTone(flight.status)} status={flight.status.replaceAll('_', ' ')}>
                <Link href={mode === 'inventory' ? `/dashboard/platform/schedules/${flight.id}` : `${detailBase}/${flight.id}`} className={cn('font-semibold tabular-nums text-foreground', linkFocus)}>{flight.flightNumber}</Link>
              </TitleLine>
              <Route from={flight.origin.iataCode} to={flight.destination.iataCode} />
              <span className="whitespace-nowrap tabular-nums text-foreground/80">{departureDateTime.format(new Date(flight.scheduledDepartureAt))}{mode === 'inventory' && <span className="ml-2"><StatusLabel status={flight.status} /></span>}</span>
              {mode !== 'inventory' && <StatusLabel status={flight.status} />}
              {mode !== 'inventory' && <span className="flex flex-wrap gap-x-3 text-xs tabular-nums text-muted-foreground">{buckets.length ? buckets.map(bucket => <span key={bucket.id}><span className="font-semibold text-foreground">{bucket.bookingClassCode}</span> {bucket.sold + bucket.held}/{bucket.capacity}</span>) : '—'}</span>}
              {mode !== 'schedules' ? <div role="group" aria-label={`Actions for ${flight.flightNumber}`} className="flex flex-wrap items-center divide-x divide-border md:justify-end [&>*]:h-7 [&>*]:rounded-none [&>*]:border-0 [&>*]:bg-transparent [&>*]:px-2.5 [&>*]:text-xs [&>*:hover]:bg-transparent [&>*:hover]:underline [&>*]:underline-offset-4 [&>*:last-child]:pr-0">
                {mode === 'inventory' && <Pill disabled={!canSelectInventoryFlight} onClick={() => selectInventoryFlight(flight.id)}>
                  {isSelectedInventoryFlight ? 'Reload buckets' : 'View buckets'}
                </Pill>}
                {flight.status !== 'open_for_sale' && <Pill disabled={working === flight.id} onClick={() => run(flight.id, () => mutate(`mutation($flight:ID!,$status:AirlineSalesStatus!,,$key:String!){setDatedFlightSalesStatus(flightInstanceId:$flight,status:$status,idempotencyKey:$key){status}}`, { flight: flight.id, status: 'open_for_sale', key: `open-${flight.id}-${crypto.randomUUID()}` }), 'Flight sales opened.')}>Open sales</Pill>}
                {flight.status !== 'closed_for_sale' && <Pill disabled={working === flight.id} className="text-red-700 dark:text-red-400" onClick={() => window.confirm(`Close sales for ${flight.flightNumber}? Customers can no longer book it until sales reopen.`) && run(flight.id, () => mutate(`mutation($flight:ID!,$status:AirlineSalesStatus!,,$key:String!){setDatedFlightSalesStatus(flightInstanceId:$flight,status:$status,idempotencyKey:$key){status}}`, { flight: flight.id, status: 'closed_for_sale', key: `close-${flight.id}-${crypto.randomUUID()}` }), 'Flight sales closed without changing retained counts.')}>Close sales</Pill>}
              </div> : <span />}
            </div>
            {inventoryFlightBinding?.state === 'stale' && <p role="status" className="mt-1 text-xs text-muted-foreground">Outside carrier inventory scope.</p>}
            {inventoryActorCarrierId && inventoryFlightBinding?.state === 'unavailable' && <p role="alert" className="mt-1 text-xs text-muted-foreground">Carrier scope unavailable.</p>}
            {mode !== 'inventory' && buckets.length > 0 && <details className="group mt-1"><summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline [&::-webkit-details-marker]:hidden">Authorize seats by class</summary><div className="mt-2 divide-y border-t pl-4">
              {buckets.map(bucket => {
                const minimum = bucket.sold + bucket.held + bucket.blocked
                const value = authorizations[bucket.id] ?? String(bucket.authorized)
                return <div key={bucket.id} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
                  <div className="min-w-0 space-y-1">
                    <TitleLine as="p" tone={statusTone(bucket.status)} status={bucket.status} className="text-sm">
                      <Link href={`${detailBase}/${flight.id}`} className={cn('tabular-nums font-medium  text-foreground', linkFocus)}>Class {bucket.bookingClassCode}</Link>
                      <span className="ml-2 text-xs capitalize text-muted-foreground">{bucket.status.replaceAll('_', ' ')}</span>
                    </TitleLine>
                    <div className="pl-4"><BucketFigures sold={bucket.sold} held={bucket.held} blocked={bucket.blocked} capacity={bucket.capacity} /></div>
                  </div>
                  {mode !== 'schedules' && <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">Authorized<input type="number" min={minimum} max={bucket.capacity} value={value} disabled={flight.inventoryBucketsOverflow} onChange={event => setAuthorizations(values => ({ ...values, [bucket.id]: event.target.value }))} className={cn(deskInput, 'h-8 w-20 tabular-nums ')} /></label>
                    <Track><Pill disabled={flight.inventoryBucketsOverflow || working === bucket.id || Number(value) === bucket.authorized} onClick={() => run(bucket.id, () => mutate(`mutation($bucket:ID!,$authorized:Int!,$key:String!){setInventoryAuthorization(inventoryBucketId:$bucket,authorized:$authorized,idempotencyKey:$key){status}}`, { bucket: bucket.id, authorized: Number(value), key: `authorize-${bucket.id}-${crypto.randomUUID()}` }), 'Inventory authorization updated.')}>Save</Pill></Track>
                  </div>}
                </div>
              })}
            </div></details>}
          </article>
        })}
      </Panel>}
      {!flights.length && !flightWorklist && <Well>No dated flights provisioned.</Well>}
    </section>
  </DeskSection>

  const bucketsSection = mode === 'inventory' && <DeskSection
    title="Buckets"
    count={(inventoryBucketPage.state === 'ready' || inventoryBucketPage.state === 'overflow') ? (inventoryBucketPage.totalCount ?? undefined) : undefined}
    actions={inventoryFlightId ? <Track><Pill onClick={() => selectInventoryFlight('')}><X />Clear</Pill></Track> : undefined}
  >
    <section aria-label="Selected flight inventory bucket worklist" className="space-y-3">
      {selectedInventoryFlight.state === 'none' ? <Well role="status">Select a flight.</Well>
        : selectedInventoryFlight.state === 'stale' ? <Notice tone="warn" role="status">Selected flight is no longer in carrier inventory scope.</Notice>
          : selectedInventoryFlight.state === 'unavailable' ? <Notice tone="bad" role="alert">Selected flight carrier scope unavailable.</Notice>
            : <>
              {selectedInventoryFlightRecord && <TitleLine as="p" tone={flightTone(selectedInventoryFlightRecord.status)} status={selectedInventoryFlightRecord.status.replaceAll('_', ' ')} className="text-sm">
                <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="tabular-nums font-semibold  text-foreground">{selectedInventoryFlightRecord.flightNumber}</span>
                  <Route from={selectedInventoryFlightRecord.origin.iataCode} to={selectedInventoryFlightRecord.destination.iataCode} />
                </span>
              </TitleLine>}
              {inventoryBucketPage.state === 'loading' ? <Well role="status">Loading buckets…</Well>
                : inventoryBucketPage.state === 'denied' ? <Notice tone="bad" role="alert">No permission to read inventory buckets.</Notice>
                  : inventoryBucketPage.state === 'unavailable' ? <Notice tone="bad" role="alert">Buckets or their count are unavailable.</Notice>
                    : inventoryBucketPage.state === 'stale' ? <StateNotice role="status" action={<Pill onClick={restartInventoryBucketList}><RotateCcw />Reload first page</Pill>}>Bucket page is stale.</StateNotice>
                      : inventoryBucketPage.state === 'inconsistent' ? <StateNotice role="status" action={<Pill onClick={restartInventoryBucketList}><RotateCcw />Reload first page</Pill>}>Bucket rows and count disagree.</StateNotice>
                        : inventoryBucketPage.state === 'empty' ? <Well role="status">No buckets for this flight.</Well>
                          : <>
                            <p role="status" className="tabular-nums text-xs  text-muted-foreground">{inventoryBucketPage.items.length} of {inventoryBucketPage.totalCount}{inventoryBucketPage.state === 'overflow' ? ` · over ${INVENTORY_BUCKET_WORKLIST_PAGE_SIZE}, more on later pages` : ''}</p>
                            {!inventoryBucketPage.canManageInventory && <Notice role="status">Read-only</Notice>}
                            <Panel className="divide-y">{inventoryBucketPage.items.map(bucket => {
                              const minimum = bucket.sold + bucket.held + bucket.blocked
                              const value = authorizations[bucket.id] ?? String(bucket.authorized)
                              const canEdit = canEditVisibleInventoryBucket({ page: inventoryBucketPage, flightId: selectedInventoryFlight.flightId ?? '', carrierId: inventoryActorCarrierId ?? '', bucketId: bucket.id })
                              return <div key={bucket.id} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
                                <div className="min-w-0 space-y-1">
                                  <TitleLine as="p" tone={statusTone(bucket.status)} status={bucket.status} className="text-sm">
                                    <Link href={`${detailBase}/${bucket.id}`} className={cn('tabular-nums font-medium  text-foreground', linkFocus)}>Class {bucket.bookingClassCode}</Link>
                                    <span className="ml-2 text-xs capitalize text-muted-foreground">{bucket.status.replaceAll('_', ' ')}</span>
                                  </TitleLine>
                                  <div className="pl-4"><BucketFigures sold={bucket.sold} held={bucket.held} blocked={bucket.blocked} capacity={bucket.capacity} /></div>
                                </div>
                                {inventoryBucketPage.canManageInventory && <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">Authorized<input type="number" min={minimum} max={bucket.capacity} value={value} disabled={!canEdit} onChange={event => setAuthorizations(values => ({ ...values, [bucket.id]: event.target.value }))} className={cn(deskInput, 'h-8 w-20 tabular-nums ')} /></label>
                                  <Track><Pill variant="primary" disabled={!canEdit || working === bucket.id || Number(value) === bucket.authorized} onClick={() => saveSelectedBucketAuthorization(bucket.id, Number(value))}>Save</Pill></Track>
                                </div>}
                              </div>
                            })}</Panel>
                            {(inventoryBucketCursorStack.length > 0 || inventoryBucketPage.hasNextPage) && <Track>
                              {inventoryBucketCursorStack.length > 0 && <Pill onClick={previousInventoryBucketPage}><ChevronLeft />Previous {INVENTORY_BUCKET_WORKLIST_PAGE_SIZE}</Pill>}
                              {inventoryBucketPage.hasNextPage && <Pill onClick={nextInventoryBucketPage}>Next {INVENTORY_BUCKET_WORKLIST_PAGE_SIZE}<ChevronRight /></Pill>}
                            </Track>}
                          </>}
            </>}
    </section>
  </DeskSection>

  const provisionSection = mode !== 'inventory' && <DeskSection
    title="Provision dated flight"
    count={scheduleWorklist?.state === 'ready' ? (scheduleWorklist.totalCount ?? undefined) : undefined}
    actions={scheduleWorklist?.state === 'ready' ? <div className="flex flex-wrap items-center gap-2">
      <span className="tabular-nums text-xs  text-muted-foreground">{scheduleWorklist.pageItemCount} schedules on page</span>
      <PageLinks firstHref={scheduleFirstHref} nextHref={scheduleNextHref} nextLabel="Next 100" />
    </div> : undefined}
  >
    <div className="space-y-3">
      {scheduleWorklist && <section aria-label="Published schedule worklist">
        {scheduleWorklist.state === 'unavailable' ? <Notice tone="bad" role="alert">Published schedules or their count are unavailable. Provisioning blocked.</Notice>
          : scheduleWorklist.state === 'empty' ? <Well>No published schedules.</Well>
            : scheduleWorklist.state === 'stale' ? <StateNotice role="status" action={scheduleFirstHref && <Pill asChild><Link href={scheduleFirstHref}>First page</Link></Pill>}>Schedule page is stale.</StateNotice>
              : scheduleWorklist.state === 'inconsistent' ? <StateNotice role="status" action={scheduleFirstHref && <Pill asChild><Link href={scheduleFirstHref}>Reload first page</Link></Pill>}>Schedule rows and count disagree.</StateNotice>
                : null}
      </section>}
      {scheduleSelectionInvalid && <Notice tone="warn" role="alert">Selected schedule is no longer published. Choose another.</Notice>}
      {cabinPage.state === 'loading' ? <Notice role="status">Loading cabins…</Notice>
        : cabinPage.state === 'denied' ? <Notice tone="bad" role="alert">No permission to read cabins. Provisioning unavailable.</Notice>
          : cabinPage.state === 'unavailable' ? <Notice tone="bad" role="alert">Cabins or their count are unavailable.</Notice>
            : cabinPage.state === 'stale' ? <StateNotice role="status" action={<Pill onClick={restartCabinList}><RotateCcw />Restart cabin list</Pill>}>Cabin page is stale.</StateNotice>
              : cabinPage.state === 'inconsistent' ? <StateNotice role="status" action={<Pill onClick={restartCabinList}><RotateCcw />Reload first page</Pill>}>Cabin rows and count disagree.</StateNotice>
                : cabinPage.state === 'empty' ? <Notice role="status">No cabins match.</Notice>
                  : cabinPage.state === 'overflow' ? <Notice role="status">Over {CABIN_WORKLIST_PAGE_SIZE} cabins match. Showing {cabinPage.items.length} of {cabinPage.totalCount}.</Notice>
                    : null}
      {selectedCabinId && fareBrandPage.state === 'loading' ? <Notice role="status">Loading fare brands…</Notice>
        : selectedCabinId && fareBrandPage.state === 'denied' ? <Notice tone="bad" role="alert">No permission to read fare brands. Provisioning unavailable.</Notice>
          : selectedCabinId && fareBrandPage.state === 'unavailable' ? <Notice tone="bad" role="alert">Fare brands or their count are unavailable.</Notice>
            : selectedCabinId && fareBrandPage.state === 'stale' ? <StateNotice role="status" action={<Pill onClick={restartFareBrandList}><RotateCcw />Restart fare-brand list</Pill>}>Fare-brand page is stale.</StateNotice>
              : selectedCabinId && fareBrandPage.state === 'inconsistent' ? <StateNotice role="status" action={<Pill onClick={restartFareBrandList}><RotateCcw />Reload first page</Pill>}>Fare-brand rows and count disagree.</StateNotice>
                : selectedCabinId && fareBrandPage.state === 'empty' ? <Notice role="status">No active fare brands match.</Notice>
                  : selectedCabinId && fareBrandPage.state === 'overflow' ? <Notice role="status">Over {FARE_BRAND_WORKLIST_PAGE_SIZE} fare brands match. Showing {fareBrandPage.items.length} of {fareBrandPage.totalCount}.</Notice>
                    : null}
      <Panel>
        <form onSubmit={provision} className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className={cn(fieldLabel, 'sm:col-span-2')}>Published schedule
            <select value={scheduleId} onChange={event => selectSchedule(event.target.value)} required className={cn(deskInput, 'tabular-nums ')}>
              <option value="">Select a schedule</option>
              {schedules.map(schedule => <option key={schedule.id} value={schedule.id}>{schedule.flightNumber} · {schedule.route.origin.iataCode}–{schedule.route.destination.iataCode}</option>)}
            </select>
          </label>
          <div className={fieldLabel}>
            <label htmlFor="cabin-search">Search cabins</label>
            <div className="flex min-w-0 items-center gap-2">
              <input id="cabin-search" type="search" maxLength={80} value={cabinSearchInput} onChange={event => setCabinSearchInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); searchCabins() } }} className={cn(deskInput, 'flex-1')} />
              <Track><Pill aria-label="Search cabins" onClick={searchCabins} disabled={cabinPage.state === 'loading'}><Search /></Pill></Track>
            </div>
          </div>
          <div className={fieldLabel}>
            <label htmlFor="provisioning-cabin-select" className="flex items-baseline justify-between gap-2">Cabin
              {cabinPage.state === 'ready' && <span className="tabular-nums font-normal ">{cabinPage.items.length} of {cabinPage.totalCount}</span>}
            </label>
            <select id="provisioning-cabin-select" value={selectedCabinId} onChange={event => selectCabin(event.target.value)} disabled={cabinPage.state !== 'ready' && cabinPage.state !== 'overflow'} required className={deskInput}>
              <option value="">Select a cabin</option>
              {cabinPage.items.map(cabin => <option key={cabin.id} value={cabin.id}>{cabin.code} · {cabin.name}</option>)}
            </select>
            {(cabinCursorStack.length > 0 || cabinPage.hasNextPage) && <Track className="self-start">
              {cabinCursorStack.length > 0 && <Pill size="sm" onClick={previousCabinPage} disabled={cabinPage.state === 'loading'}><ChevronLeft />Previous {CABIN_WORKLIST_PAGE_SIZE}</Pill>}
              {cabinPage.hasNextPage && <Pill size="sm" onClick={nextCabinPage} disabled={cabinPage.state === 'loading'}>Next {CABIN_WORKLIST_PAGE_SIZE}<ChevronRight /></Pill>}
            </Track>}
          </div>
          <div className={fieldLabel}>
            <label htmlFor="fare-brand-search">Search fare brands</label>
            <div className="flex min-w-0 items-center gap-2">
              <input id="fare-brand-search" type="search" maxLength={80} value={fareBrandSearchInput} onChange={event => setFareBrandSearchInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); searchFareBrands() } }} className={cn(deskInput, 'flex-1')} />
              <Track><Pill aria-label="Search fare brands" onClick={searchFareBrands} disabled={fareBrandPage.state === 'loading'}><Search /></Pill></Track>
            </div>
          </div>
          <div className={fieldLabel}>
            <label htmlFor="fare-brand-select" className="flex items-baseline justify-between gap-2">Fare brand
              {selectedCabinId && fareBrandPage.state === 'ready' && <span className="tabular-nums font-normal ">{fareBrandPage.items.length} of {fareBrandPage.totalCount}</span>}
            </label>
            <select id="fare-brand-select" value={selectedFareBrandId} onChange={event => setFareBrandId(event.target.value)} disabled={!selectedCabinId || (fareBrandPage.state !== 'ready' && fareBrandPage.state !== 'overflow')} required className={deskInput}>
              <option value="">{!selectedCabinId && (cabinPage.state === 'ready' || cabinPage.state === 'overflow') ? 'Select a cabin first' : 'Select a fare brand'}</option>
              {compatibleBrands.map(brand => <option key={brand.id} value={brand.id}>{brand.code} · {brand.name}</option>)}
            </select>
            {staleFareBrandSelection && <span role="alert" className="text-xs font-normal text-red-700 dark:text-red-300">Previous fare brand is no longer on this page.</span>}
            {(fareBrandCursorStack.length > 0 || fareBrandPage.hasNextPage) && <Track className="self-start">
              {fareBrandCursorStack.length > 0 && <Pill size="sm" onClick={previousFareBrandPage} disabled={fareBrandPage.state === 'loading'}><ChevronLeft />Previous {FARE_BRAND_WORKLIST_PAGE_SIZE}</Pill>}
              {fareBrandPage.hasNextPage && <Pill size="sm" onClick={nextFareBrandPage} disabled={fareBrandPage.state === 'loading'}>Next {FARE_BRAND_WORKLIST_PAGE_SIZE}<ChevronRight /></Pill>}
            </Track>}
          </div>
          <label className={fieldLabel}>Service date<input type="date" value={serviceDate} onChange={event => { const next = event.target.value; setServiceDate(next); setDeparture(`${next}T09:00`); setArrival(`${next}T10:20`) }} required className={cn(deskInput, 'tabular-nums ')} /></label>
          <label className={fieldLabel}>Departure ({defaultTimezone})<input type="datetime-local" value={departure} onChange={event => setDeparture(event.target.value)} required className={cn(deskInput, 'tabular-nums ')} /></label>
          <label className={fieldLabel}>Arrival ({defaultTimezone})<input type="datetime-local" value={arrival} onChange={event => setArrival(event.target.value)} required className={cn(deskInput, 'tabular-nums ')} /></label>
          <label className={fieldLabel}>Capacity<input type="number" min={1} max={300} value={capacity} onChange={event => setCapacity(event.target.value)} required className={cn(deskInput, 'tabular-nums ')} /></label>
          <label className={fieldLabel}>Currency<input value={currencyCode} onChange={event => setCurrencyCode(event.target.value.toUpperCase())} maxLength={3} required className={cn(deskInput, 'tabular-nums uppercase ')} /></label>
          <label className={fieldLabel}>Base (minor units)<input type="number" min={0} value={baseAmount} onChange={event => setBaseAmount(event.target.value)} required className={cn(deskInput, 'tabular-nums ')} /></label>
          <label className={fieldLabel}>Tax (minor units)<input type="number" min={0} value={taxAmount} onChange={event => setTaxAmount(event.target.value)} required className={cn(deskInput, 'tabular-nums ')} /></label>
          <div className="flex items-end sm:col-span-2 sm:justify-end xl:col-span-1">
            <Track>
              <Pill type="submit" variant="primary" disabled={working === 'provision' || !scheduleId || scheduleSelectionInvalid || !schedules.length || !fareBrandBinding}>Provision dated flight</Pill>
            </Track>
          </div>
        </form>
      </Panel>
    </div>
  </DeskSection>

  return <div className="min-w-0 space-y-6">
    {message && <Notice tone={messageFailed ? 'bad' : 'ok'} role={messageFailed ? 'alert' : 'status'}>{message}</Notice>}
    {mode === 'inventory' && !inventoryActorCarrierId && <Notice tone="warn" role="alert">Carrier scope unavailable. Inventory reads and authorization blocked.</Notice>}
    {showReadouts && <ReadoutStrip>
      {mode !== 'inventory' && scheduleWorklist?.state === 'ready' && <Readout label="Schedules" value={<span className="tabular-nums">{scheduleWorklist.totalCount}</span>} />}
      {flightWorklist?.state === 'ready' && <Readout label="Future flights" value={<span className="tabular-nums">{flightWorklist.totalCount}</span>} />}
      <Readout label="Open for sale" tone="ok" value={<span className="tabular-nums">{openOnPage}</span>} sub="This page" />
      <Readout label="Closed for sale" tone="idle" value={<span className="tabular-nums">{closedOnPage}</span>} sub="This page" />
    </ReadoutStrip>}
    {mode === 'inventory'
      ? <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">{flightsSection}{bucketsSection}</div>
      : flightsSection}
    {provisionSection}
  </div>
}
