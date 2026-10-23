import { createTransport, getTestMessageUrl } from "nodemailer";

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
  const brandName = escapeHtml(safeCarrierName(carrierName));
  const backgroundColor = "#f9f9f9";
  const textColor = "#444444";
  const mainBackgroundColor = "#ffffff";
  const buttonBackgroundColor = "#346df1";
  const buttonBorderColor = "#346df1";
  const buttonTextColor = "#ffffff";

  return `
    <body style="background: ${backgroundColor};">
      <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: ${mainBackgroundColor}; max-width: 600px; margin: auto; border-radius: 10px;">
        <tr>
          <td align="center" style="padding: 10px 0px 0px 0px; font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            <strong>${brandName}</strong><br />Please click below to reset your password
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: 5px;" bgcolor="${buttonBackgroundColor}"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${buttonTextColor}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${buttonBorderColor}; display: inline-block; font-weight: bold;">Reset Password</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            If you did not request this email you can safely ignore it.
          </td>
        </tr>
      </table>
    </body>
  `;
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
  const brandName = escapeHtml(safeCarrierName(booking.carrierName))
  const rows = booking.segments.map(segment => `<tr><td style="padding:6px 0;font-family:Menlo,Consolas,monospace;">${escapeHtml(booking.carrierCode)} ${escapeHtml(segment.flightNumber)}</td><td style="padding:6px 0;font-family:Menlo,Consolas,monospace;">${escapeHtml(segment.originCode)} – ${escapeHtml(segment.destinationCode)}</td><td style="padding:6px 0;">${escapeHtml(segment.departureLabel)}</td></tr>`).join('')
  return `
    <body style="background:#f5f2eb;margin:0;padding:24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:auto;background:#fffdf8;border-radius:16px;font-family:Helvetica,Arial,sans-serif;color:#0f1b2d;">
        <tr><td style="padding:24px 28px 8px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#6b7689;">${brandName} · Reservation</td></tr>
        <tr><td style="padding:0 28px;font-family:Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:.18em;">${escapeHtml(booking.recordLocator)}</td></tr>
        <tr><td style="padding:16px 28px 0;"><table width="100%" style="font-size:14px;">${rows}</table></td></tr>
        <tr><td style="padding:12px 28px 0;font-size:14px;">${booking.travelers.map(escapeHtml).join(', ')}</td></tr>
        <tr><td style="padding:12px 28px 0;font-size:16px;font-weight:700;">${escapeHtml(booking.totalLabel)}</td></tr>
        <tr><td style="padding:20px 28px 0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6b7689;">Access code</td></tr>
        <tr><td style="padding:6px 28px 0;font-family:Menlo,Consolas,monospace;font-size:12px;word-break:break-all;">${escapeHtml(booking.accessToken)}</td></tr>
        <tr><td style="padding:24px 28px 28px;"><a href="${escapeHtml(manageUrl)}" style="background:#0f1b2d;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700;display:inline-block;">Manage booking</a></td></tr>
      </table>
    </body>
  `
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
