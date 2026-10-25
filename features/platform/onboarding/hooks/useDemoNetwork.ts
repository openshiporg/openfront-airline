'use client'

import { useCallback, useRef, useState } from 'react'

import { decimalToMinorUnits } from '@/features/keystone/lib/money'
import demoSeed from '../lib/seed.json'

// The "Full demo network" template. Every write goes through the same authority-checked operations an operator
// uses by hand: storefront settings, the carrier record, carrier launch setup (one call per route, which creates the
// airports, route, schedule, launch cabin and Standard fare, station access and settlement providers), then
// provisionDatedFlight for the remaining service days. Every step is idempotent, so a rerun only fills gaps.

export type DemoRoute = (typeof demoSeed.routes)[number]
export type DemoNetworkProgress = { phase: 'idle' | 'running' | 'done' | 'failed'; label: string; done: number; total: number; failures: string[] }

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7]

async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch('/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload || payload.errors?.length) throw new Error(payload?.errors?.[0]?.message || `Request failed (${response.status}).`)
  return payload.data as T
}

// Calendar date in the carrier timezone, offset by whole days.
function carrierDate(timezone: string, daysAhead: number) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const date = new Date(`${today}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + daysAhead)
  return date.toISOString().slice(0, 10)
}

const minor = (value: string) => decimalToMinorUnits(value, demoSeed.carrier.currencyCode)

export function demoNetworkSummary() {
  const airports = new Set(demoSeed.routes.flatMap(route => [route.origin, route.destination]))
  return { carrier: demoSeed.carrier, storefront: demoSeed.storefront, routes: demoSeed.routes, airports: [...airports], serviceDays: demoSeed.serviceDays, flights: demoSeed.routes.length * demoSeed.serviceDays }
}

export function useDemoNetwork(carrierId: string) {
  const [progress, setProgress] = useState<DemoNetworkProgress>({ phase: 'idle', label: '', done: 0, total: 0, failures: [] })
  const running = useRef(false)

  const run = useCallback(async () => {
    if (running.current) return
    running.current = true
    const { carrier, storefront, routes, serviceDays } = demoSeed
    const dates = Array.from({ length: serviceDays }, (_, index) => carrierDate(carrier.timezone, index + 1))
    const total = 2 + routes.length * 2 + routes.length * (dates.length - 1)
    let done = 0
    const failures: string[] = []
    const step = (label: string) => setProgress({ phase: 'running', label, done, total, failures: [...failures] })
    const attempt = async (label: string, action: () => Promise<unknown>) => {
      step(label)
      // Serializable setup transactions can collide on shared carrier rows; those are retried a few times.
      for (let tries = 1; ; tries++) {
        try { await action(); break } catch (error) {
          const message = error instanceof Error ? error.message : 'failed'
          if (tries < 4 && /changed concurrently|retry the request/i.test(message)) { await new Promise(resolve => setTimeout(resolve, 400 * tries + Math.random() * 400)); continue }
          failures.push(`${label}: ${message}`)
          break
        }
      }
      done += 1
      step(label)
    }

    try {
      await attempt('Storefront brand and contact details', () => graphql(`mutation($name:String!,$legalName:String!,$color:String!,$title:String!,$description:String!,$email:String,$phone:String,$hours:String){updateCarrierStorefrontSettings(name:$name,legalName:$legalName,storefrontBrandColor:$color,storefrontHomepageTitle:$title,storefrontHomepageDescription:$description,storefrontContactEmail:$email,storefrontContactPhone:$phone,storefrontServiceHours:$hours){id}}`, {
        name: carrier.name, legalName: carrier.legalName, color: storefront.brandColor, title: storefront.homepageTitle, description: storefront.homepageDescription,
        email: storefront.contactEmail, phone: storefront.contactPhone, hours: storefront.serviceHours,
      }))
      await attempt('Direct sales', () => graphql(`mutation($id:ID!){updateCarrier(where:{id:$id},data:{directSalesEnabled:true}){id directSalesEnabled}}`, { id: carrierId }))

      // Launch setup per route on the first service day. It locks the carrier row, so these run one at a time.
      const scheduleIds = new Map<string, string>()
      for (const route of routes) {
        await attempt(`${carrier.code}${route.flightNumber} ${route.origin}–${route.destination} launch`, () => graphql(`mutation($name:String!,$legalName:String!,$code:String!,$currencyCode:String!,$timezone:String!,$originCode:String!,$destinationCode:String!,$flightNumber:String!,$serviceDate:String!,$scheduledDepartureAt:String!,$scheduledArrivalAt:String!,$capacity:Int!,$baseAmount:Int!,$taxAmount:Int!){completeCarrierOnboarding(name:$name,legalName:$legalName,code:$code,currencyCode:$currencyCode,timezone:$timezone,originCode:$originCode,destinationCode:$destinationCode,flightNumber:$flightNumber,serviceDate:$serviceDate,scheduledDepartureAt:$scheduledDepartureAt,scheduledArrivalAt:$scheduledArrivalAt,capacity:$capacity,baseAmount:$baseAmount,taxAmount:$taxAmount){completed}}`, {
          name: carrier.name, legalName: carrier.legalName, code: carrier.code, currencyCode: carrier.currencyCode, timezone: carrier.timezone,
          originCode: route.origin, destinationCode: route.destination, flightNumber: route.flightNumber, serviceDate: dates[0],
          scheduledDepartureAt: `${dates[0]}T${route.departure}`, scheduledArrivalAt: `${dates[0]}T${route.arrival}`,
          capacity: route.capacity, baseAmount: minor(route.baseFare), taxAmount: minor(route.tax),
        }))
        // Launch setup publishes the schedule for one weekday; the demo flies daily.
        await attempt(`${carrier.code}${route.flightNumber} daily schedule`, async () => {
          const data = await graphql<{ flightSchedule: { id: string } | null }>(`query($key:String!){flightSchedule(where:{scheduleKey:$key}){id}}`, { key: `${carrier.code}:${route.flightNumber}` })
          if (!data.flightSchedule) throw new Error('Schedule was not created.')
          await graphql(`mutation($id:ID!,$days:JSON!){updateFlightSchedule(where:{id:$id},data:{daysOfWeek:$days}){id}}`, { id: data.flightSchedule.id, days: ALL_DAYS })
          scheduleIds.set(route.flightNumber, data.flightSchedule.id)
        })
      }

      // Remaining service days, a few routes at a time.
      const jobs = routes.flatMap(route => dates.slice(1).map(serviceDate => ({ route, serviceDate })))
      let cursor = 0
      const worker = async () => {
        while (cursor < jobs.length) {
          const { route, serviceDate } = jobs[cursor++]
          await attempt(`${carrier.code}${route.flightNumber} ${serviceDate}`, async () => {
            const scheduleId = scheduleIds.get(route.flightNumber)
            if (!scheduleId) throw new Error('No published schedule for this route.')
            await graphql(`mutation($scheduleId:ID!,$cabinId:ID!,$fareBrandId:ID!,$serviceDate:String!,$dep:String!,$arr:String!,$capacity:Int!,$base:Int!,$tax:Int!,$currency:String!,$key:String!){provisionDatedFlight(scheduleId:$scheduleId,cabinId:$cabinId,fareBrandId:$fareBrandId,serviceDate:$serviceDate,scheduledDepartureAt:$dep,scheduledArrivalAt:$arr,capacity:$capacity,baseAmount:$base,taxAmount:$tax,currencyCode:$currency,idempotencyKey:$key){resourceId status}}`, {
              scheduleId, cabinId: `${carrierId}:launch-cabin-y`, fareBrandId: `${carrierId}:launch-fare-standard`, serviceDate,
              dep: `${serviceDate}T${route.departure}`, arr: `${serviceDate}T${route.arrival}`, capacity: route.capacity,
              base: minor(route.baseFare), tax: minor(route.tax), currency: carrier.currencyCode,
              key: `demo-network:${carrier.code}:${route.flightNumber}:${serviceDate}`,
            })
          })
        }
      }
      await Promise.all([worker(), worker()])
      setProgress({ phase: failures.length ? 'failed' : 'done', label: failures.length ? `${failures.length} step(s) need attention` : 'Demo network loaded', done, total, failures })
    } finally {
      running.current = false
    }
  }, [carrierId])

  return { progress, run }
}
