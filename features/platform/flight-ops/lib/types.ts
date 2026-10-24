export type FlightOperationsInput = {
  flightInstanceId: string
  departureTerminal?: string | null
  departureGate?: string | null
  arrivalTerminal?: string | null
  arrivalGate?: string | null
  estimatedDepartureAt?: string | null
  estimatedArrivalAt?: string | null
  actualDepartureAt?: string | null
  actualArrivalAt?: string | null
  status?: 'delayed' | 'departed' | 'arrived' | null
  idempotencyKey: string
}

export type FlightOperationsResult = { success: true; status: string; replayed: boolean } | { success: false; error: string }
