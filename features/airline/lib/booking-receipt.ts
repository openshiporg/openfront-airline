export type BookingReceipt = {
  version: number
  state?: string
  message?: string
  accessState?: string
  acceptedStatus?: string
  accepted?: { allocationState?: 'supported_v1' | 'legacy_unversioned'; serviceAllocation?: { version: number; type: string; passengerCount: number; legCount: number } | null; offerNumber: string; totalAmount: number; currencyCode: string; expiresAt: string; items: Array<{ description: string; quantity: number; totalAmount: number; currencyCode: string; includedBaggage?: { pieces: number; maxWeightGrams: number }; fareName?: string | null }> }
  current?: { status: string; paymentStatus: string; ticketingStatus: string }
}
