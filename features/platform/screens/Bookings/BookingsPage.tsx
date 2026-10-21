import { readBookingWorkspace } from '@/features/platform/lib/booking-workspace'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { BookingDesk } from '@/features/platform/components/BookingDesk'
import {
  BOOKING_WORKLIST_QUERY,
  bookingWorklistNextHref,
  bookingWorklistPage,
  normalizeBookingWorklistCursor,
} from '@/features/platform/lib/booking-worklist'

export default async function BookingsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {}
  const locator = typeof params.locator === 'string' ? params.locator.trim().toUpperCase() : ''
  const locatorFilter = locator ? /^[A-Z0-9]{5,8}$/.test(locator) ? { equals: locator } : { contains: locator } : null
  const locatorWhere = locatorFilter ? { recordLocator: locatorFilter } : {}
  const bookingCursor = normalizeBookingWorklistCursor(params.bookingCursor)
  const cleanupWhere = { AND: [{ OR: [{ paymentStatus: { equals: 'refunded' } }, { ticketingStatus: { equals: 'voided' } }] }, ...(locatorFilter ? [locatorWhere] : [])] }
  const response = await readBookingWorkspace({
    where: locatorWhere,
    cleanupWhere,
    bookingCursor: bookingCursor ? { id: bookingCursor } : null,
    bookingSkip: bookingCursor ? 1 : 0,
  })
  const bookingPage = response.success ? bookingWorklistPage(response.data.bookings, response.data.bookingsCount) : null
  const bookingNextHref = bookingPage?.nextCursor
    ? bookingWorklistNextHref('/dashboard/bookings', locator, bookingPage.nextCursor)
    : null
  return <PageContainer title="Booking desk" header={<div><p className="text-sm font-medium text-primary">Servicing workspace</p><h1 className="text-2xl font-semibold tracking-tight">Offers and bookings</h1><p className="mt-1 text-sm text-muted-foreground">Accept held offers, reconcile externally evidenced payments, issue ticket documents, refund, and cancel through aggregate commands.</p></div>} breadcrumbs={[{ type: 'link' as const, label: 'Operations', href: '/dashboard/operations' }, { type: 'page' as const, label: 'Booking desk' }]}>
    <div className="space-y-5 p-4 md:p-6">
      <form action="/dashboard/bookings" className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-medium">Record locator search<input name="locator" defaultValue={locator} placeholder="Exact or partial locator" className="mt-2 w-full rounded-lg border bg-background px-3 py-2 uppercase" /></label><button className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground">Find booking</button></form>
      {response.success ? <BookingDesk offers={response.data.offers} bookings={bookingPage?.items ?? []} bookingCount={bookingPage?.totalCount ?? 0} bookingHasNextPage={bookingPage?.hasNextPage ?? false} bookingNextHref={bookingNextHref} refundCleanupBookings={response.data.refundCleanupBookings.slice(0, 100)} refundCleanupTruncated={response.data.refundCleanupBookingsCount > 100} evidences={response.data.manualPaymentEvidences} sectionErrors={response.sectionErrors} /> : <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm">{'Bookings could not be loaded'}</p>}
    </div>
  </PageContainer>
}
