import { createTransport, getTestMessageUrl } from "nodemailer";
import { hashStorefrontToken, signBookingPass } from "./storefront-session";
import { emailButton, emailHeading, emailLayout, emailMuted, emailPanel, emailParagraph, emailTotals, storeNameFromEnv } from "./email-layout";

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
    body: `${emailMuted('Booking reference')}
${emailPanel(`<span style="font-family:Menlo,Consolas,monospace;font-size:28px;font-weight:700;letter-spacing:.16em;">${escapeHtml(booking.recordLocator)}</span>`, 'center')}
${emailHeading('Flights')}
${emailPanel(flights)}
${emailHeading('Travelers')}
${emailParagraph(booking.travelers.map(escapeHtml).join(', '))}
${emailTotals([{ label: 'Total', value: booking.totalLabel }])}
${emailButton('Manage booking', manageUrl)}
${emailParagraph('Or open Manage booking on our site with this reference and a traveler’s last name.')}`,
  })
}

// Best effort: a booking never fails because mail is unavailable. Returns whether a message was handed to SMTP.
export async function sendBookingConfirmationEmail(booking: BookingConfirmation): Promise<boolean> {
  if (!emailConfigured()) {
    console.warn(`Booking confirmation for ${booking.recordLocator} not emailed: SMTP is not configured.`)
    return false
  }
  try {
    // A signed booking pass rides in the fragment, which browsers never send to a server, so the link opens the booking in one tap.
    const manageUrl = `${getBaseUrlForEmails()}/manage-booking?ref=${encodeURIComponent(booking.recordLocator)}#pass=${encodeURIComponent(signBookingPass(hashStorefrontToken(booking.accessToken)))}`
    const info = await transport.sendMail({
      to: booking.to,
      from: process.env.SMTP_FROM,
      subject: `${safeCarrierName(booking.carrierName)} reservation ${booking.recordLocator}`,
      html: bookingConfirmationEmail(booking, manageUrl),
    })
    console.log(`Booking confirmation for ${booking.recordLocator} accepted by mail server: ${info.messageId} ${String(info.response ?? '').slice(0, 80)}`)
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

// Storefront traveler account emails: confirm the address (which shows the account's trips) or reset the password.
export async function sendCustomerAccountEmail(input: { to: string; kind: 'verify' | 'reset'; token: string; carrierName?: string | null }): Promise<boolean> {
  if (!emailConfigured()) {
    console.warn('Account email not sent: SMTP is not configured.')
    return false
  }
  const name = safeCarrierName(input.carrierName ?? storeNameFromEnv())
  const verify = input.kind === 'verify'
  const url = `${getBaseUrlForEmails()}/account?${verify ? 'confirm' : 'reset'}=${encodeURIComponent(input.token)}`
  try {
    const info = await transport.sendMail({
      to: input.to,
      from: process.env.SMTP_FROM,
      subject: verify ? `Confirm your ${name} account` : `Reset your ${name} password`,
      html: emailLayout({
        storeName: name,
        preheader: verify ? 'Confirm your email to see your trips' : 'Choose a new password',
        title: verify ? 'Confirm your email' : 'Reset your password',
        body: `${emailParagraph(verify ? 'Confirm this email address to see every trip booked with it under My trips.' : 'Use the button below to choose a new password. If you didn’t ask for this, ignore this email.')}
${emailButton(verify ? 'Confirm email' : 'Choose a new password', url)}
${emailParagraph('This link works for one hour.')}`,
      }),
    })
    console.log(`Account ${input.kind} email accepted by mail server: ${info.messageId}`)
    return true
  } catch (error) {
    console.error(`Account ${input.kind} email could not be sent:`, error instanceof Error ? error.message : 'unknown error')
    return false
  }
}

// Staff invitation: the link opens /dashboard/join, where the invitee chooses a name and password.
export async function sendStaffInviteEmail(input: { to: string; token: string; roleName: string; carrierName?: string | null; invitedBy?: string | null }): Promise<string | null> {
  if (!emailConfigured()) {
    console.warn('Staff invite email not sent: SMTP is not configured.')
    return null
  }
  const name = safeCarrierName(input.carrierName ?? storeNameFromEnv())
  const url = `${getBaseUrlForEmails()}/dashboard/join?token=${encodeURIComponent(input.token)}`
  const who = input.invitedBy ? `${escapeHtml(input.invitedBy)} invited you` : 'You are invited'
  try {
    const info = await transport.sendMail({
      to: input.to,
      from: process.env.SMTP_FROM,
      subject: `You're invited to the ${name} staff desk`,
      html: emailLayout({
        storeName: name,
        preheader: `Set a password to start as ${input.roleName}`,
        title: `Join ${name}`,
        body: `${emailParagraph(`${who} to the ${escapeHtml(name)} staff desk as <strong>${escapeHtml(input.roleName)}</strong>.`)}
${emailButton('Set your password', url)}
${emailParagraph('This link works for seven days and only once. If you weren’t expecting it, ignore this email.')}`,
      }),
    })
    console.log(`Staff invite email accepted by mail server: ${info.messageId}`)
    return String(info.messageId ?? '') || 'sent'
  } catch (error) {
    console.error('Staff invite email could not be sent:', error instanceof Error ? error.message : 'unknown error')
    return null
  }
}
