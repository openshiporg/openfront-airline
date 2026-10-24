import 'server-only'
import { Kind, parse, print, visit, type OperationDefinitionNode } from 'graphql'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { BOOKING_WORKLIST_QUERY } from './booking-worklist'

import type { Offer, Booking, RefundCleanupBooking, Evidence } from '@/features/airline/lib/operator-bookings'

type BookingWorkspaceData = { offers: Offer[]; bookings: Booking[]; bookingsCount: number; refundCleanupBookings: RefundCleanupBooking[]; refundCleanupBookingsCount: number; manualPaymentEvidences: Evidence[] }
type Section = 'offers' | 'bookings' | 'cleanup' | 'evidence'
const fields: Record<Section, readonly string[]> = {
  offers: ['offers'], bookings: ['bookings','bookingsCount'],
  cleanup: ['refundCleanupBookings','refundCleanupBookingsCount'], evidence: ['manualPaymentEvidences'],
}

// All selections are owned by this module. Splitting preserves each independent Keystone read gate and prevents a
// denial in an auxiliary payment/offer section from discarding an authorized booking result.
function sectionDocument(section: Section) {
  const document = parse(BOOKING_WORKLIST_QUERY)
  const operation = document.definitions[0] as OperationDefinitionNode
  const selectionSet = { ...operation.selectionSet, selections: operation.selectionSet.selections.filter(selection => selection.kind === Kind.FIELD && fields[section].includes(selection.alias?.value ?? selection.name.value)) }
  const used = new Set<string>()
  visit(selectionSet,{ Variable(node) { used.add(node.name.value) } })
  return print({ ...document, definitions: [{ ...operation, name: { kind: Kind.NAME, value: `BookingWorkspace_${section}` }, selectionSet, variableDefinitions: operation.variableDefinitions?.filter(variable => used.has(variable.variable.name.value)) }] })
}

export async function readBookingWorkspace(variables: Record<string,unknown>) {
  const entries = await Promise.all((Object.keys(fields) as Section[]).map(async section => {
    try { return { section, result: await keystoneClient<Partial<BookingWorkspaceData>>(sectionDocument(section),variables) } }
    catch { return { section, result: { success: false as const } } }
  }))
  const data: BookingWorkspaceData = { offers: [], bookings: [], bookingsCount: 0, refundCleanupBookings: [], refundCleanupBookingsCount: 0, manualPaymentEvidences: [] }
  const sectionErrors: Partial<Record<Section,string>> = {}
  for (const {section,result} of entries) {
    const complete = result.success && fields[section].every(field => { const value = result.data[field as keyof BookingWorkspaceData]; return field.endsWith('Count') ? typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 : Array.isArray(value) })
    if (complete && result.success) Object.assign(data,result.data)
    else sectionErrors[section] = 'This section is unavailable under your current access. Check your permissions and try again.'
  }
  if (data.bookings.length) {
    try {
      const balances = await keystoneClient<{ bookings: Array<Pick<Booking,'id'|'payments'|'paymentsCount'>> }>(`query BookingRefundBalances($ids:[ID!]!){bookings(where:{id:{in:$ids}},take:51){id paymentsCount payments(take:101,orderBy:[{id:asc}]){capturedAmount refundedAmount currencyCode}}}`, { ids: data.bookings.map(booking => booking.id) })
      if (balances.success) {
        const byId = new Map(balances.data.bookings.map(booking => [booking.id,booking]))
        data.bookings = data.bookings.map(booking => ({ ...booking, ...byId.get(booking.id) }))
      }
    } catch { /* A denied balance leaves the readable booking intact; refund remains unavailable. */ }
    // Approved settlement evidence, so the desk can mark a booking paid with the reference the checker approved.
    try {
      const approved = await keystoneClient<{ manualPaymentEvidences: Array<{ id: string; purpose: string; externalReference: string; amount: number; booking: { id: string } | null }> }>(`query BookingApprovedEvidence($ids:[ID!]!){manualPaymentEvidences(where:{booking:{id:{in:$ids}},status:{equals:approved}},take:100,orderBy:[{approvedAt:desc}]){id purpose externalReference amount booking{id}}}`, { ids: data.bookings.map(booking => booking.id) })
      if (approved.success) {
        data.bookings = data.bookings.map(booking => ({ ...booking, approvedEvidence: approved.data.manualPaymentEvidences.filter(evidence => evidence.booking?.id === booking.id).map(({ booking: _booking, ...evidence }) => evidence) }))
      }
    } catch { /* Without payment read access the desk asks for the approved reference instead. */ }
  }
  return { success: true as const, data, sectionErrors }
}
