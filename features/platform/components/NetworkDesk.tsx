'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
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
          bucketCursorId: cursor ?? '',
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
          cabinCursorId: cursor ?? '',
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
          fareBrandCursorId: cursor ?? '',
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

  return <div className="space-y-6">
    {message && <p role={messageFailed ? 'alert' : 'status'} className={`rounded-lg px-3 py-2 text-sm ${messageFailed ? 'bg-destructive/10 text-destructive' : 'bg-primary/10'}`}>{message}</p>}
    {mode !== 'inventory' && scheduleWorklist && <section aria-label="Published schedule worklist" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm">
      {scheduleWorklist.state === 'unavailable' ? <p role="alert">Carrier-authorized published schedules or their count are denied or incomplete. No empty state is inferred; schedule provisioning is unavailable.</p>
        : scheduleWorklist.state === 'empty' ? <p>No carrier-authorized published schedules are available to provision.</p>
          : scheduleWorklist.state === 'stale' ? <div role="status"><p>This schedule continuation returned no published schedules; its cursor may be stale or the authorized set may have changed.</p>{scheduleFirstHref && <Link href={scheduleFirstHref} className="mt-1 inline-flex font-medium underline">Return to first schedule page</Link>}</div>
            : scheduleWorklist.state === 'inconsistent' ? <div role="status"><p>Published schedule rows and their carrier-authorized count disagree; the separate reads may have observed concurrent changes.</p>{scheduleFirstHref && <Link href={scheduleFirstHref} className="mt-1 inline-flex font-medium underline">Reload first schedule page</Link>}</div>
              : <><p>{scheduleWorklist.pageItemCount} published schedules on this page · {scheduleWorklist.totalCount} carrier-authorized schedules total.</p><div className="flex gap-3">{scheduleFirstHref && <Link href={scheduleFirstHref} className="font-medium underline">First page</Link>}{scheduleNextHref && <Link href={scheduleNextHref} className="font-medium underline">Next 100 schedules →</Link>}</div></>}
    </section>}
    {mode === 'inventory' && !inventoryActorCarrierId && <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">The current operator carrier scope is unavailable. Inventory bucket reads and authorization controls are blocked.</p>}
    {flightWorklist && <section aria-label="Future dated flight worklist" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm">
      {flightWorklist.state === 'unavailable' ? <p role="alert">Carrier-authorized future flights, nested inventory buckets, or their count are denied or incomplete. No empty state is inferred; verify network and inventory read scope.</p>
        : flightWorklist.state === 'empty' ? <p>No carrier-authorized future dated flights match this worklist.</p>
          : flightWorklist.state === 'stale' ? <div role="status"><p>This flight continuation returned no rows; its cursor may be stale or the authorized future-flight set may have changed.</p>{flightFirstHref && <Link href={flightFirstHref} className="mt-1 inline-flex font-medium underline">Return to first flight page</Link>}</div>
            : flightWorklist.state === 'inconsistent' ? <div role="status"><p>Dated-flight rows and their carrier-authorized count disagree; the separate reads may have observed concurrent changes.</p>{flightFirstHref && <Link href={flightFirstHref} className="mt-1 inline-flex font-medium underline">Reload first flight page</Link>}</div>
              : <><p>{flightWorklist.pageItemCount} future flights on this page · {flightWorklist.totalCount} carrier-authorized future flights total.</p><div className="flex gap-3">{flightFirstHref && <Link href={flightFirstHref} className="font-medium underline">First page</Link>}{flightNextHref && <Link href={flightNextHref} className="font-medium underline">Next 50 flights →</Link>}</div></>}
    </section>}
    {mode !== 'inventory' && scheduleSelectionInvalid && <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">The previously selected schedule is no longer published or carrier-authorized. Choose an available schedule before provisioning.</p>}
    {mode !== 'inventory' && <form onSubmit={provision} className="grid gap-4 rounded-2xl border bg-card p-5 md:grid-cols-2 xl:grid-cols-4">
      <div className="md:col-span-2 xl:col-span-4"><h2 className="font-semibold">Provision sellable dated service</h2><p className="mt-1 text-sm text-muted-foreground">Creates one immutable dated-flight identity, one bounded fare bucket, and a standard published seat map. Replays never overwrite retained service.</p>
        {cabinPage.state === 'loading' ? <p role="status" className="mt-2 text-sm text-muted-foreground">Loading carrier-authorized cabins…</p>
          : cabinPage.state === 'denied' ? <p role="alert" className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">The current role lacks Cabin read permission. No cabin rows are shown and provisioning is unavailable.</p>
            : cabinPage.state === 'unavailable' ? <p role="alert" className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">The session, carrier scope, authorized cabin rows, or count is unavailable. No empty cabin list is inferred.</p>
              : cabinPage.state === 'stale' ? <div role="status" className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm"><p>This carrier-cabin continuation is stale or outside the authorized result. No rows are shown.</p><button type="button" onClick={restartCabinList} className="mt-1 font-medium underline">Restart the cabin list</button></div>
                : cabinPage.state === 'inconsistent' ? <div role="status" className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm"><p>Cabin rows and their carrier-authorized count disagree; separate reads may have observed concurrent changes. No rows are shown.</p><button type="button" onClick={restartCabinList} className="mt-1 font-medium underline">Reload first cabin page</button></div>
                  : cabinPage.state === 'empty' ? <p role="status" className="mt-2 text-sm text-muted-foreground">No carrier-authorized cabins match this search.</p>
                    : cabinPage.state === 'overflow' ? <p role="status" className="mt-2 text-sm text-muted-foreground">More than {CABIN_WORKLIST_PAGE_SIZE} carrier-authorized cabins match this search. Showing {cabinPage.items.length} on this page of {cabinPage.totalCount}; continue through the bounded list.</p>
                      : <p className="mt-2 text-sm text-muted-foreground">{cabinPage.items.length} carrier-authorized cabins on this page · {cabinPage.totalCount} total.</p>}
        {!selectedCabinId && (cabinPage.state === 'ready' || cabinPage.state === 'overflow') ? <p className="mt-1 text-sm text-muted-foreground">Choose a cabin to load its active fare brands.</p>
          : selectedCabinId && fareBrandPage.state === 'loading' ? <p role="status" className="mt-2 text-sm text-muted-foreground">Loading active fare brands for the selected cabin…</p>
            : selectedCabinId && fareBrandPage.state === 'denied' ? <p role="alert" className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">The current role lacks FareBrand read permission. No brand rows are shown and provisioning is unavailable.</p>
              : selectedCabinId && fareBrandPage.state === 'unavailable' ? <p role="alert" className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">The selected-cabin fare-brand rows or count are unavailable. No empty catalog is inferred and provisioning is blocked.</p>
                : selectedCabinId && fareBrandPage.state === 'stale' ? <div role="status" className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm"><p>This cabin/search continuation is stale or outside the authorized result. No rows are shown.</p><button type="button" onClick={restartFareBrandList} className="mt-1 font-medium underline">Restart this fare-brand list</button></div>
                  : selectedCabinId && fareBrandPage.state === 'inconsistent' ? <div role="status" className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm"><p>Fare-brand rows and their selected-cabin count disagree; separate reads may have observed concurrent changes. No rows are shown.</p><button type="button" onClick={restartFareBrandList} className="mt-1 font-medium underline">Reload first fare-brand page</button></div>
                    : selectedCabinId && fareBrandPage.state === 'empty' ? <p role="status" className="mt-2 text-sm text-muted-foreground">No active fare brands match this cabin and search.</p>
                      : selectedCabinId && fareBrandPage.state === 'overflow' ? <p role="status" className="mt-2 text-sm text-muted-foreground">More than {FARE_BRAND_WORKLIST_PAGE_SIZE} active fare brands match this cabin/search. Showing {fareBrandPage.items.length} on this page of {fareBrandPage.totalCount}; continue through the bounded list.</p>
                        : selectedCabinId && fareBrandPage.state === 'ready' ? <p className="mt-2 text-sm text-muted-foreground">{fareBrandPage.items.length} matching active fare brands on this page · {fareBrandPage.totalCount} total.</p> : null}
      </div>
      <label className="text-sm font-medium">Published schedule<select value={scheduleId} onChange={event => selectSchedule(event.target.value)} required className="mt-2 w-full rounded-lg border bg-background px-3 py-2"><option value="">Select a published schedule</option>{schedules.map(schedule => <option key={schedule.id} value={schedule.id}>{schedule.route.origin.iataCode}–{schedule.route.destination.iataCode} · {schedule.flightNumber}</option>)}</select></label>
      <div className="text-sm font-medium"><label htmlFor="provisioning-cabin-select">Cabin<select id="provisioning-cabin-select" value={selectedCabinId} onChange={event => selectCabin(event.target.value)} disabled={cabinPage.state !== 'ready' && cabinPage.state !== 'overflow'} required className="mt-2 w-full rounded-lg border bg-background px-3 py-2"><option value="">Select a carrier-authorized cabin</option>{cabinPage.items.map(cabin => <option key={cabin.id} value={cabin.id}>{cabin.code} · {cabin.name}</option>)}</select></label><span className="mt-1 block text-xs text-muted-foreground">Paging or searching clears the cabin and fare-brand selection; choose from the current authorized page.</span><div className="mt-2 flex flex-wrap gap-3 text-xs">{cabinCursorStack.length > 0 && <button type="button" onClick={previousCabinPage} disabled={cabinPage.state === 'loading'} className="font-medium underline disabled:opacity-50">Previous {CABIN_WORKLIST_PAGE_SIZE} cabins</button>}{cabinPage.hasNextPage && <button type="button" onClick={nextCabinPage} disabled={cabinPage.state === 'loading'} className="font-medium underline disabled:opacity-50">Next {CABIN_WORKLIST_PAGE_SIZE} cabins →</button>}</div></div>
      <div className="text-sm font-medium"><label htmlFor="cabin-search">Search carrier cabins</label><div className="mt-2 flex gap-2"><input id="cabin-search" type="search" maxLength={80} value={cabinSearchInput} onChange={event => setCabinSearchInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); searchCabins() } }} className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2" /><button type="button" onClick={searchCabins} disabled={cabinPage.state === 'loading'} className="rounded-lg border px-3 py-2 disabled:opacity-50">Search</button></div></div>
      <div className="text-sm font-medium"><label htmlFor="fare-brand-search">Search active fare brands in this cabin</label><div className="mt-2 flex gap-2"><input id="fare-brand-search" type="search" maxLength={80} value={fareBrandSearchInput} onChange={event => setFareBrandSearchInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); searchFareBrands() } }} className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2" /><button type="button" onClick={searchFareBrands} disabled={fareBrandPage.state === 'loading'} className="rounded-lg border px-3 py-2 disabled:opacity-50">Search</button></div></div>
      <div className="text-sm font-medium"><label htmlFor="fare-brand-select">Fare brand<select id="fare-brand-select" value={selectedFareBrandId} onChange={event => setFareBrandId(event.target.value)} disabled={!selectedCabinId || (fareBrandPage.state !== 'ready' && fareBrandPage.state !== 'overflow')} required className="mt-2 w-full rounded-lg border bg-background px-3 py-2"><option value="">Select an active fare brand</option>{compatibleBrands.map(brand => <option key={brand.id} value={brand.id}>{brand.code} · {brand.name}</option>)}</select></label>
        <span className="mt-1 block text-xs text-muted-foreground">Cabin changes and list navigation clear the selection; choose from the current authorized page.</span>
        {staleFareBrandSelection && <span role="alert" className="mt-1 block text-xs text-destructive">The prior fare-brand selection is no longer on this active cabin page. No replacement was selected.</span>}
        <div className="mt-2 flex flex-wrap gap-3 text-xs">{fareBrandCursorStack.length > 0 && <button type="button" onClick={previousFareBrandPage} disabled={fareBrandPage.state === 'loading'} className="font-medium underline disabled:opacity-50">Previous {FARE_BRAND_WORKLIST_PAGE_SIZE} brands</button>}{fareBrandPage.hasNextPage && <button type="button" onClick={nextFareBrandPage} disabled={fareBrandPage.state === 'loading'} className="font-medium underline disabled:opacity-50">Next {FARE_BRAND_WORKLIST_PAGE_SIZE} brands →</button>}</div>
      </div>
      <label className="text-sm font-medium">Service date<input type="date" value={serviceDate} onChange={event => { const next = event.target.value; setServiceDate(next); setDeparture(`${next}T09:00`); setArrival(`${next}T10:20`) }} required className="mt-2 w-full rounded-lg border bg-background px-3 py-2" /></label>
      <label className="text-sm font-medium">Departure ({defaultTimezone} local)<input type="datetime-local" value={departure} onChange={event => setDeparture(event.target.value)} required className="mt-2 w-full rounded-lg border bg-background px-3 py-2" /></label>
      <label className="text-sm font-medium">Arrival ({defaultTimezone} local)<input type="datetime-local" value={arrival} onChange={event => setArrival(event.target.value)} required className="mt-2 w-full rounded-lg border bg-background px-3 py-2" /></label>
      <label className="text-sm font-medium">Capacity<input type="number" min={1} max={300} value={capacity} onChange={event => setCapacity(event.target.value)} required className="mt-2 w-full rounded-lg border bg-background px-3 py-2" /></label>
      <label className="text-sm font-medium">Currency<input value={currencyCode} onChange={event => setCurrencyCode(event.target.value.toUpperCase())} maxLength={3} required className="mt-2 w-full rounded-lg border bg-background px-3 py-2 uppercase" /></label>
      <label className="text-sm font-medium">Base amount (minor units)<input type="number" min={0} value={baseAmount} onChange={event => setBaseAmount(event.target.value)} required className="mt-2 w-full rounded-lg border bg-background px-3 py-2" /></label>
      <label className="text-sm font-medium">Tax amount (minor units)<input type="number" min={0} value={taxAmount} onChange={event => setTaxAmount(event.target.value)} required className="mt-2 w-full rounded-lg border bg-background px-3 py-2" /></label>
      <button disabled={working === 'provision' || !scheduleId || scheduleSelectionInvalid || !schedules.length || !fareBrandBinding} className="self-end rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">Provision dated flight</button>
    </form>}
    <section className="space-y-3">
      <div><h2 className="font-semibold">{mode === 'schedules' ? 'Provisioned dated flights' : 'Maintained dated inventory'}</h2><p className="text-sm text-muted-foreground">Open or close sales and change authorization without reducing it below sold, held, and blocked inventory.</p></div>
      {flights.map(flight => {
        const inventoryFlightBinding = mode === 'inventory'
          ? resolveInventoryFlightSelection(flights, flight.id, inventoryActorCarrierId ?? '')
          : null
        const canSelectInventoryFlight = inventoryFlightBinding?.state === 'authorized'
        return <article key={flight.id} className="rounded-2xl border bg-card p-5">
          {mode !== 'inventory' && flight.inventoryBucketsOverflow && <p role="status" className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">More than 25 inventory buckets exist; only the first 25 are shown and authorization editing is unavailable for this incomplete projection.</p>}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div><Link href={mode === 'inventory' ? `/dashboard/platform/schedules/${flight.id}` : `${detailBase}/${flight.id}`} className="font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{flight.origin.iataCode} → {flight.destination.iataCode} · Flight {flight.flightNumber}</Link><p className="text-sm text-muted-foreground">{departureDateTime.format(new Date(flight.scheduledDepartureAt))} · {flight.status}</p>{inventoryFlightBinding?.state === 'stale' && <p role="status" className="mt-1 text-xs text-muted-foreground">This flight is outside the current carrier-authorized inventory scope; bucket access is stale.</p>}{inventoryActorCarrierId && inventoryFlightBinding?.state === 'unavailable' && <p role="alert" className="mt-1 text-xs text-muted-foreground">The flight carrier scope is unavailable; bucket access is blocked.</p>}</div>
            <div className="flex flex-wrap gap-2">
              {mode === 'inventory' && <button type="button" disabled={!canSelectInventoryFlight} aria-pressed={inventoryFlightId === flight.id && selectedInventoryFlight.state === 'authorized'} onClick={() => selectInventoryFlight(flight.id)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{inventoryFlightId === flight.id && selectedInventoryFlight.state === 'authorized' ? 'Reload buckets' : 'View buckets'}</button>}
              {mode !== 'schedules' && <><button disabled={working === flight.id || flight.status === 'open_for_sale'} onClick={() => run(flight.id, () => mutate(`mutation($flight:ID!,$status:AirlineSalesStatus!,,$key:String!){setDatedFlightSalesStatus(flightInstanceId:$flight,status:$status,idempotencyKey:$key){status}}`, { flight: flight.id, status: 'open_for_sale', key: `open-${flight.id}-${crypto.randomUUID()}` }), 'Flight sales opened.')} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Open sales</button><button disabled={working === flight.id || flight.status === 'closed_for_sale'} onClick={() => window.confirm(`Close sales for ${flight.flightNumber}? Customers can no longer book it until sales reopen.`) && run(flight.id, () => mutate(`mutation($flight:ID!,$status:AirlineSalesStatus!,,$key:String!){setDatedFlightSalesStatus(flightInstanceId:$flight,status:$status,idempotencyKey:$key){status}}`, { flight: flight.id, status: 'closed_for_sale', key: `close-${flight.id}-${crypto.randomUUID()}` }), 'Flight sales closed without changing retained counts.')} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Close sales</button></>}
            </div>
          </div>
          {mode === 'inventory'
            ? <p className="mt-3 text-xs text-muted-foreground">Bucket details load only for one selected flight at a time under the current inventory-read scope.</p>
            : <div className="mt-4 grid gap-3 md:grid-cols-2">{(flight.inventoryBuckets ?? []).map(bucket => { const minimum = bucket.sold + bucket.held + bucket.blocked; const value = authorizations[bucket.id] ?? String(bucket.authorized); return <div key={bucket.id} className="flex flex-col gap-2 rounded-xl bg-muted/40 p-3 sm:flex-row sm:items-end sm:justify-between"><div><Link href={`${detailBase}/${flight.id}`} className="text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Class {bucket.bookingClassCode} · {bucket.status}</Link><p className="text-xs text-muted-foreground">{bucket.sold} sold · {bucket.held} held · {bucket.blocked} blocked · {bucket.capacity} capacity</p></div>{mode !== 'schedules' && <div className="flex items-end gap-2"><label className="text-xs font-medium">Authorized<input type="number" min={minimum} max={bucket.capacity} value={value} disabled={flight.inventoryBucketsOverflow} onChange={event => setAuthorizations(values => ({ ...values, [bucket.id]: event.target.value }))} className="mt-1 w-24 rounded-lg border bg-background px-3 py-2 text-sm" /></label><button disabled={flight.inventoryBucketsOverflow || working === bucket.id || Number(value) === bucket.authorized} onClick={() => run(bucket.id, () => mutate(`mutation($bucket:ID!,$authorized:Int!,$key:String!){setInventoryAuthorization(inventoryBucketId:$bucket,authorized:$authorized,idempotencyKey:$key){status}}`, { bucket: bucket.id, authorized: Number(value), key: `authorize-${bucket.id}-${crypto.randomUUID()}` }), 'Inventory authorization updated.')} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Save</button></div>}</div> })}</div>}
        </article>
      })}
      {!flights.length && !flightWorklist && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No dated flights are provisioned yet.</p>}
    </section>
    {mode === 'inventory' && <section aria-label="Selected flight inventory bucket worklist" className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Inventory buckets for one flight</h2><p className="text-sm text-muted-foreground">Only one carrier-owned flight is paged at a time; authorization controls bind to the visible bucket IDs on this page.</p></div>{inventoryFlightId && <button type="button" onClick={() => selectInventoryFlight('')} className="rounded-lg border px-3 py-2 text-sm">Clear selected flight</button>}</div>
      {selectedInventoryFlight.state === 'none' ? <p role="status" className="text-sm text-muted-foreground">Choose “View buckets” on a flight to inspect its bounded bucket pages.</p>
        : selectedInventoryFlight.state === 'stale' ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">The selected flight is no longer on the current carrier-authorized inventory page or belongs to another carrier. No bucket rows are shown.</div>
          : selectedInventoryFlight.state === 'unavailable' ? <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">The selected flight’s carrier scope is unavailable. No bucket query or edit control is enabled.</p>
            : <>
              {selectedInventoryFlightRecord && <p className="text-sm font-medium">Flight {selectedInventoryFlightRecord.flightNumber} · {selectedInventoryFlightRecord.origin.iataCode} → {selectedInventoryFlightRecord.destination.iataCode}</p>}
              {inventoryBucketPage.state === 'loading' ? <p role="status" className="text-sm text-muted-foreground">Loading carrier-authorized bucket rows and count…</p>
                : inventoryBucketPage.state === 'denied' ? <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">The current role lacks InventoryBucket read permission. No rows are shown.</p>
                  : inventoryBucketPage.state === 'unavailable' ? <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">The carrier/inventory scope, bucket rows, or count is unavailable. No empty worklist is inferred.</p>
                    : inventoryBucketPage.state === 'stale' ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm"><p>This bucket cursor is stale or outside the selected flight/carrier filter. No rows are shown.</p><button type="button" onClick={restartInventoryBucketList} className="mt-1 font-medium underline">Reload first bucket page</button></div>
                      : inventoryBucketPage.state === 'inconsistent' ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm"><p>Bucket rows and their selected-flight count disagree or returned a foreign row. No rows are shown.</p><button type="button" onClick={restartInventoryBucketList} className="mt-1 font-medium underline">Reload first bucket page</button></div>
                        : inventoryBucketPage.state === 'empty' ? <p role="status" className="text-sm text-muted-foreground">No carrier-authorized inventory buckets exist for this flight.</p>
                          : <>
                            <p role="status" className="text-sm text-muted-foreground">{inventoryBucketPage.items.length} buckets on this page · {inventoryBucketPage.totalCount} carrier-authorized buckets for this flight.{inventoryBucketPage.state === 'overflow' ? ` More than ${INVENTORY_BUCKET_WORKLIST_PAGE_SIZE} results; continue to later buckets.` : ''}</p>
                            {!inventoryBucketPage.canManageInventory && <p role="status" className="text-sm text-muted-foreground">Read-only: this role can inspect inventory buckets but cannot manage authorization.</p>}
                            <div className="grid gap-3 md:grid-cols-2">{inventoryBucketPage.items.map(bucket => {
                              const minimum = bucket.sold + bucket.held + bucket.blocked
                              const value = authorizations[bucket.id] ?? String(bucket.authorized)
                              const canEdit = canEditVisibleInventoryBucket({ page: inventoryBucketPage, flightId: selectedInventoryFlight.flightId ?? '', carrierId: inventoryActorCarrierId ?? '', bucketId: bucket.id })
                              return <div key={bucket.id} className="flex flex-col gap-2 rounded-xl bg-muted/40 p-3 sm:flex-row sm:items-end sm:justify-between"><div><Link href={`${detailBase}/${bucket.id}`} className="text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Class {bucket.bookingClassCode} · {bucket.status}</Link><p className="text-xs text-muted-foreground">{bucket.sold} sold · {bucket.held} held · {bucket.blocked} blocked · {bucket.capacity} capacity</p></div>{inventoryBucketPage.canManageInventory && <div className="flex items-end gap-2"><label className="text-xs font-medium">Authorized<input type="number" min={minimum} max={bucket.capacity} value={value} disabled={!canEdit} onChange={event => setAuthorizations(values => ({ ...values, [bucket.id]: event.target.value }))} className="mt-1 w-24 rounded-lg border bg-background px-3 py-2 text-sm" /></label><button disabled={!canEdit || working === bucket.id || Number(value) === bucket.authorized} onClick={() => saveSelectedBucketAuthorization(bucket.id, Number(value))} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Save</button></div>}</div>
                            })}</div>
                            <div className="flex gap-3 text-sm">{inventoryBucketCursorStack.length > 0 && <button type="button" onClick={previousInventoryBucketPage} className="font-medium underline">Previous {INVENTORY_BUCKET_WORKLIST_PAGE_SIZE} buckets</button>}{inventoryBucketPage.hasNextPage && <button type="button" onClick={nextInventoryBucketPage} className="font-medium underline">Next {INVENTORY_BUCKET_WORKLIST_PAGE_SIZE} buckets →</button>}</div>
                          </>}
            </>}
    </section>}
  </div>
}
