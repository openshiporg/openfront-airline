// Public contact details come from Store settings. Placeholder values (reserved example domains, the fictional
// 555-0100 to 555-0199 numbers) are hidden rather than shown to travelers; the settings themselves are untouched.

type ContactSettings = {
  storefrontContactEmail?: string | null
  storefrontContactPhone?: string | null
  storefrontServiceHours?: string | null
}

const RESERVED_EMAIL_DOMAIN = /@(?:[^@]+\.)?(?:example|test|invalid|localhost)$|@example\.(?:com|net|org)$/i
const FICTIONAL_PHONE = /555[\s.-]?01\d\d$/

export function carrierContact(carrier: ContactSettings | null | undefined) {
  const email = carrier?.storefrontContactEmail?.trim() ?? ''
  const phone = carrier?.storefrontContactPhone?.trim() ?? ''
  const hours = carrier?.storefrontServiceHours?.trim() ?? ''
  const digits = phone.replace(/[^\d+]/g, '')
  return {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !RESERVED_EMAIL_DOMAIN.test(email) ? email : null,
    phone: digits.replace(/\D/g, '').length >= 7 && !FICTIONAL_PHONE.test(digits) ? { label: phone, href: `tel:${digits}` } : null,
    hours: hours || null,
  }
}
