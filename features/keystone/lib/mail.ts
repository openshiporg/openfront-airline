import { createTransport, getTestMessageUrl } from "nodemailer";
import { emailButton, emailHeading, emailLayout, emailMuted, emailPanel, emailParagraph, emailTotals } from "./email-layout";

// Public origin for links in emails: SMTP_STORE_LINK when set, otherwise the Railway-provided public domain.
function getBaseUrlForEmails(): string {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK.replace(/\/+$/, '');
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  console.warn('SMTP_STORE_LINK not set. Email links will be relative.');
  return '';
}

// As in E-commerce, missing mail settings never stop the app from starting. Sending without an SMTP host fails
// loudly instead of pretending a message went out.
export function emailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

const smtpPort = process.env.SMTP_PORT
  ? Number.parseInt(process.env.SMTP_PORT, 10)
  : undefined;

const transport = createTransport({
  host: process.env.SMTP_HOST,
  port: Number.isSafeInteger(smtpPort) ? smtpPort : undefined,
  auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      }
    : undefined,
  // Password-reset mail is generated in process and never needs filesystem or
  // URL-backed content. Keep these attack surfaces closed at the transport.
  disableFileAccess: true,
  disableUrlAccess: true,
});

function safeCarrierName(value?: string | null) {
  const normalized = String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
  return normalized || 'Carrier operations'
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

export function passwordResetEmail({ url, carrierName }: { url: string; carrierName?: string | null }): string {
  return emailLayout({
    storeName: safeCarrierName(carrierName),
    preheader: "Use this link to choose a new password.",
    title: "Reset your password",
    body: `${emailParagraph("We received a request to reset the password for your account. Use the button below to choose a new one.")}
${emailButton("Reset password", url)}
${emailMuted("If you did not request this, you can safely ignore this email. Your password will not change.")}`,
  });
}

export async function sendPasswordResetEmail(resetToken: string, to: string, options: { baseUrl?: string; carrierName?: string | null } = {}): Promise<void> {
  if (!emailConfigured()) {
    console.warn('Password reset email not sent: SMTP_HOST and SMTP_FROM are not configured.')
    throw new Error('Email is not configured.')
  }
  // Use provided baseUrl or fall back to utility function
  const frontendUrl = options.baseUrl || getBaseUrlForEmails();
  
  // email the user a token
  const info = await transport.sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: `${safeCarrierName(options.carrierName)} password reset`,
    html: passwordResetEmail({
      url: `${frontendUrl}/dashboard/reset?token=${encodeURIComponent(resetToken)}`,
      carrierName: options.carrierName,
    }),
  });
  if (process.env.MAIL_USER?.includes("ethereal.email")) {
    console.log(`📧 Message Sent!  Preview it at ${getTestMessageUrl(info)}`);
  }
}

type BookingConfirmation = {
  to: string
  carrierName: string
  carrierCode: string
  recordLocator: string
  accessToken: string
  totalLabel: string
  segments: Array<{ flightNumber: string; originCode: string; destinationCode: string; departureLabel: string }>
  travelers: string[]
}

export function bookingConfirmationEmail(booking: BookingConfirmation, manageUrl: string): string {
  const flights = booking.segments.map(segment => `<strong>${escapeHtml(booking.carrierCode)} ${escapeHtml(segment.flightNumber)}</strong> &nbsp; ${escapeHtml(segment.originCode)} – ${escapeHtml(segment.destinationCode)}<br><span style="font-size:13px;">${escapeHtml(segment.departureLabel)}</span>`).join('<br><br>')
  return emailLayout({
    storeName: safeCarrierName(booking.carrierName),
    preheader: `Reservation ${booking.recordLocator}`,
    title: 'Your reservation',
    body: `${emailMuted('Record locator')}
${emailPanel(`<span style="font-family:Menlo,Consolas,monospace;font-size:28px;font-weight:700;letter-spacing:.16em;">${escapeHtml(booking.recordLocator)}</span>`, 'center')}
${emailHeading('Flights')}
${emailPanel(flights)}
${emailHeading('Travelers')}
${emailParagraph(booking.travelers.map(escapeHtml).join(', '))}
${emailTotals([{ label: 'Total', value: booking.totalLabel }])}
${emailHeading('Access code')}
${emailPanel(`<span style="font-family:Menlo,Consolas,monospace;font-size:13px;word-break:break-all;">${escapeHtml(booking.accessToken)}</span>`)}
${emailButton('Manage booking', manageUrl)}`,
  })
}

// Best effort: a booking never fails because mail is unavailable. Returns whether a message was handed to SMTP.
export async function sendBookingConfirmationEmail(booking: BookingConfirmation): Promise<boolean> {
  if (!emailConfigured()) {
    console.warn(`Booking confirmation for ${booking.recordLocator} not emailed: SMTP is not configured.`)
    return false
  }
  try {
    const manageUrl = `${getBaseUrlForEmails()}/manage-booking?ref=${encodeURIComponent(booking.recordLocator)}`
    await transport.sendMail({
      to: booking.to,
      from: process.env.SMTP_FROM,
      subject: `${safeCarrierName(booking.carrierName)} reservation ${booking.recordLocator}`,
      html: bookingConfirmationEmail(booking, manageUrl),
    })
    return true
  } catch (error) {
    console.error(`Booking confirmation for ${booking.recordLocator} could not be emailed:`, error instanceof Error ? error.message : 'unknown error')
    return false
  }
}

export type BookingNotice = { to: string; carrierName: string; recordLocator: string; subject: string; heading: string; lines: string[] }

export function bookingNoticeEmail(notice: BookingNotice, manageUrl: string): string {
  return emailLayout({
    storeName: safeCarrierName(notice.carrierName),
    preheader: notice.heading,
    title: notice.heading,
    body: `${emailMuted(`Reservation ${escapeHtml(notice.recordLocator)}`)}
${notice.lines.map(line => emailParagraph(escapeHtml(line))).join('')}
${emailButton('Manage booking', manageUrl)}`,
  })
}

// Service messages about an existing booking (cancelled, expired, delayed). Best effort, like the confirmation.
export async function sendBookingNoticeEmail(notice: BookingNotice): Promise<boolean> {
  if (!emailConfigured()) {
    console.warn(`Booking notice for ${notice.recordLocator} not emailed: SMTP is not configured.`)
    return false
  }
  try {
    const manageUrl = `${getBaseUrlForEmails()}/manage-booking?ref=${encodeURIComponent(notice.recordLocator)}`
    await transport.sendMail({ to: notice.to, from: process.env.SMTP_FROM, subject: `${safeCarrierName(notice.carrierName)}: ${notice.subject}`, html: bookingNoticeEmail(notice, manageUrl) })
    return true
  } catch (error) {
    console.error(`Booking notice for ${notice.recordLocator} could not be emailed:`, error instanceof Error ? error.message : 'unknown error')
    return false
  }
}
