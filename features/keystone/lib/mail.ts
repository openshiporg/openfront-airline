import { createTransport, getTestMessageUrl } from "nodemailer";

// Utility function to get base URL for emails
function getBaseUrlForEmails(): string {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  
  if (process.env.NODE_ENV === 'production') throw new Error('SMTP_STORE_LINK is required in production.')
  console.warn('SMTP_STORE_LINK not set; password-reset links are unavailable outside configured environments.')
  return '';
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
  if (process.env.NODE_ENV === 'production' && (!process.env.SMTP_HOST || !process.env.SMTP_FROM || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !smtpPort)) {
    throw new Error('Complete SMTP configuration is required in production.')
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