export type Offer = { id: string; offerNumber: string; status: string; totalAmount: number; currencyCode: string; passengers: Array<{ id: string; givenName: string; familyName: string }> }
export type Booking = { id: string; recordLocator: string; status: string; paymentStatus: string; ticketingStatus: string; totalAmount: number; currencyCode: string; metadata?: { paymentDueAt?: string } | null; paymentsCount?: number; payments?: Array<{ capturedAmount: number; refundedAmount: number; currencyCode: string }> }
export type CleanupSegment = { id: string; sequence: number; status: string; originCode: string; destinationCode: string }
export type RefundCleanupBooking = { id: string; recordLocator: string; status: string; paymentStatus: string; ticketingStatus: string; updatedAt: string; segmentsCount: number; segments: CleanupSegment[] }
export type Evidence = { id: string; status: string; purpose: string; externalReference: string; ledgerSource: string; evidenceDigest: string; amount: number; currencyCode: string; booking: { id: string; recordLocator: string }; submittedBy: { id: string; name: string }; approvedBy?: { id: string; name: string } | null }

