// Row and form shapes for the network desk.

export type AirportRow = {
  id: string
  iataCode: string
  icaoCode: string | null
  name: string
  city: string
  countryCode: string
  subdivisionCode: string | null
  timezone: string
  isActive: boolean
}

export type AirportOption = { id: string; iataCode: string; city: string; countryCode: string }

export type RouteRow = {
  id: string
  routeKey: string
  status: string
  distanceKilometers: number | null
  minimumConnectionMinutes: number | null
  isInternational: boolean
  origin: AirportOption | null
  destination: AirportOption | null
  schedulesCount: number | null
}

export type RouteOption = { id: string; routeKey: string; status: string; origin: { iataCode: string } | null; destination: { iataCode: string } | null }

export type ScheduleRow = {
  id: string
  scheduleKey: string
  flightNumber: string
  departureLocalTime: string
  arrivalLocalTime: string
  arrivalDayOffset: number | null
  daysOfWeek: unknown
  effectiveFrom: string | null
  effectiveTo: string | null
  status: string
  route: RouteOption | null
  instancesCount: number | null
}

export type AirportInput = {
  iataCode: string
  icaoCode: string
  name: string
  city: string
  countryCode: string
  subdivisionCode: string
  timezone: string
  idempotencyKey: string
}

export type RouteInput = {
  originId: string
  destinationId: string
  distanceKilometers: number | null
  minimumConnectionMinutes: number | null
  isInternational: boolean
}

export type ScheduleInput = {
  routeId: string
  flightNumber: string
  departureLocalTime: string
  arrivalLocalTime: string
  arrivalDayOffset: number
  daysOfWeek: number[]
  effectiveFrom: string
  effectiveTo: string
}

export type NetworkCarrier = { id: string; code: string; defaultCurrencyCode: string | null } | null
