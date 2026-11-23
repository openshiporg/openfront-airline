// Public terms describe the existing booking and servicing paths, not promised capabilities. The airline's name,
// legal name and contact email come from Store settings, so the terms read right for any carrier.

export type PolicyContext = { airline: string; operator: string; email: string | null }
type Sections = ReadonlyArray<readonly [string, string]>

const reach = (ctx: PolicyContext) => ctx.email ? `Email ${ctx.email}` : 'Contact the airline'

export const policies = {
  fares: { title: 'Fares and booking', sections: (ctx: PolicyContext): Sections => [
    ['Your price', 'The flight results show the price per traveler. Review the itinerary, travelers, currency and total before confirming. The accepted booking receipt records your fare and included services.'],
    ['Fare holds and payment', 'A held fare is only available until the expiry shown on screen. Confirming creates a booking, not a paid ticket. Pay before the payment deadline shown for your booking. Unpaid bookings can expire and release their seats. A ticket is issued after payment is confirmed.'],
    ['Seats and changes', `Standard fares include standard seat selection once tickets are issued, subject to availability. A selected seat may change for operational reasons. Paid seat upgrades are not available online. ${reach(ctx)} for itinerary changes; do not cancel a non-refundable trip expecting an automatic credit.`],
  ] },
  baggage: { title: 'Baggage', sections: (ctx: PolicyContext): Sections => [
    ['Included bags', 'The current Standard fare includes one checked bag up to 23 kg per traveler. Check your booking receipt for the allowance attached to your purchased fare; it is the record of what you bought.'],
    ['At the airport', `Bring your booking reference and identification to the ${ctx.airline} service desk at your departure airport for bag acceptance. Online check-in does not check a bag. Ask the desk about additional, oversized or special baggage before handing it over; extra baggage cannot be purchased on this website.`],
    ['Missing or damaged bags', `Report a missing or damaged checked bag to the airport service desk as soon as possible. ${reach(ctx)} with your booking reference and bag-tag number. Do not send payment-card details or identity-document images.`],
  ] },
  refunds: { title: 'Refunds', sections: (ctx: PolicyContext): Sections => [
    ['See the amount first', 'Manage booking shows whether online cancellation is available and the refund amount before you confirm. Refundable fares may carry a cancellation fee recorded in the fare rules. The quoted amount accounts for airfare already refunded.'],
    ['Back to the original card', 'Eligible online card payments are refunded to the original card, not to a different card or account. After a successful refund, your booking shows its updated payment status. Card refunds usually appear within 5–10 business days; your bank controls when the credit appears.'],
    ['Other payments or a problem', `${reach(ctx)} if you paid by another method, your booking cannot be cancelled online, or a refund has not arrived. Include the booking reference, but never your full card number.`],
  ] },
  cancellation: { title: 'Cancellation', sections: (): Sections => [
    ['Within 24 hours', 'Before departure, airfare is fully refundable online when you cancel within 24 hours of booking and booked at least 48 hours before the first departure.'],
    ['After that window', 'A refundable fare can be cancelled online before the first departure, less any cancellation fee in its fare rules. Non-refundable fares outside the 24-hour window cannot be cancelled online; contact the airline. Online refunds are not available after the first scheduled departure.'],
    ['What cancellation does', 'Open Manage booking with your reference and last name. Review the cancellation quote before confirming. Successful cancellation releases seats and voids tickets. An unpaid booking can be cancelled without a refund because no money was captured. If service has already begun or an operational issue prevents cancellation, contact the airline.'],
  ] },
  privacy: { title: 'Privacy', sections: (ctx: PolicyContext): Sections => [
    ['Who handles your information', `${ctx.operator} uses this booking service to handle travel reservations. ${reach(ctx)} with privacy questions or requests to access or correct your information.`],
    ['What we collect and why', 'We store traveler names, dates of birth, contact details, itineraries, booking and ticket records, seat choices, check-in records and payment references to sell and service your trip. If you create an account, we store your email, a password hash and the traveler details you choose to save. We also keep operational and security logs to prevent misuse and reconcile transactions.'],
    ['Payments and email', 'Stripe collects card details on its hosted payment page. This service stores payment and refund references, not your full card number or card security code. Our email provider delivers booking and account messages. Authorized airline staff can access the information needed for their work.'],
    ['Cookies and booking access', 'An essential signed, HttpOnly cookie keeps your account signed in. Your browser may also store booking access and an unfinished booking request so you can resume it. Booking email links grant access to that booking: keep them private and do not forward them. Sign out on shared devices.'],
    ['Your choices and record retention', `You can update saved traveler details in My trips. ${ctx.email ? 'Email us' : 'Contact us'} for other corrections, account deletion or privacy requests. Some transaction, safety and audit records may need to be retained for legal or operational obligations; deletion is not an automatic erasure of those records. We do not promise a fixed retention period that the service does not enforce.`],
  ] },
} as const

export type PolicySlug = keyof typeof policies
