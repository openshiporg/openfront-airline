export type BagAction = 'load' | 'transfer' | 'arrive' | 'deliver' | 'delay' | 'mishandle' | 'close'

export type RecordBagEventInput = {
  bagId: string
  action: BagAction
  airportCode?: string | null
  note?: string | null
  idempotencyKey: string
}

export type RecordBagEventResult = { success: true; status: string; replayed: boolean } | { success: false; error: string }
