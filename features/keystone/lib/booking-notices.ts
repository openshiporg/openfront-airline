import { sendBookingNoticeEmail, type BookingNotice } from './mail'

// One entry point for traveler service messages, so callers never fail because mail is down.
export async function sendBookingNotice(notice: BookingNotice) {
  try { return await sendBookingNoticeEmail(notice) } catch { return false }
}
