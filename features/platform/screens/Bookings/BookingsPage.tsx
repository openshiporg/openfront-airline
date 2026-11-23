import Link from 'next/link'

import { cn } from '@/lib/utils'
import { DeskHeader, Field, FilterBar, Notice, Pill, Track, deskInput } from '@/features/platform/components/desk'
import { readBookingWorkspace } from '@/features/platform/lib/booking-workspace'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { BookingDesk } from '@/features/platform/components/BookingDesk'
import {
  BOOKING_WORKLIST_QUERY,
  bookingWorklistNextHref,
  bookingWorklistWhere,
  VISIBLE_BOOKING,
  bookingWorklistPage,
  normalizeBookingWorklistCursor,
} from '@/features/platform/lib/booking-worklist'

export default async function BookingsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {}
  const locator = (typeof params.q === 'string' ? params.q : typeof params.locator === 'string' ? params.locator : '').trim()
  const { where: searchWhere } = bookingWorklistWhere(locator)
  const bookingCursor = normalizeBookingWorklistCursor(params.bookingCursor)
  const cleanupWhere = { AND: [{ OR: [{ paymentStatus: { equals: 'refunded' } }, { ticketingStatus: { equals: 'voided' } }] }, VISIBLE_BOOKING, ...(locator ? [searchWhere] : [])] }
  const response = await readBookingWorkspace({
    where: searchWhere,
    cleanupWhere,
    bookingCursor: bookingCursor ? { id: bookingCursor } : null,
    bookingSkip: bookingCursor ? 1 : 0,
  })
  const bookingPage = response.success ? bookingWorklistPage(response.data.bookings, response.data.bookingsCount) : null
  const bookingNextHref = bookingPage?.nextCursor
    ? bookingWorklistNextHref('/dashboard/bookings', locator, bookingPage.nextCursor)
    : null
  return <PageContainer title="Booking desk" header={<DeskHeader eyebrow="Servicing" title="Offers and bookings" />} breadcrumbs={[{ type: 'link' as const, label: 'Operations', href: '/dashboard/operations' }, { type: 'page' as const, label: 'Booking desk' }]}>
    <div className="min-w-0 space-y-5 px-4 pb-6 md:px-6">
      <FilterBar action="/dashboard/bookings">
        <Field label="Booking, name or email" className="sm:flex-1"><input name="q" type="search" defaultValue={locator} placeholder="628A33, Castellanos or name@email.com" className={cn(deskInput)} /></Field>
        <Track><Pill type="submit">Find booking</Pill>{locator && <Pill asChild><Link href="/dashboard/bookings">Clear</Link></Pill>}</Track>
      </FilterBar>
      {response.success ? <BookingDesk offers={response.data.offers} bookings={bookingPage?.items ?? []} bookingCount={bookingPage?.totalCount ?? 0} bookingHasNextPage={bookingPage?.hasNextPage ?? false} bookingNextHref={bookingNextHref} refundCleanupBookings={response.data.refundCleanupBookings.slice(0, 100)} refundCleanupTruncated={response.data.refundCleanupBookingsCount > 100} evidences={response.data.manualPaymentEvidences} sectionErrors={response.sectionErrors} /> : <Notice tone="bad">Bookings could not be loaded</Notice>}
    </div>
  </PageContainer>
}
