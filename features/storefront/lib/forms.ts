export type StorefrontSearchInput = {
  originCode: string
  destinationCode: string
  serviceDate: string
  passengerCount: number
}

export type StorefrontPassengerInput = {
  givenName: string
  familyName: string
  dateOfBirth: string
  email: string
  phone: string
}

function formText(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeAirportCode(value: string, label: string) {
  const code = value.trim().toUpperCase()
  if (!/^[A-Z0-9]{3}$/.test(code)) throw new Error(`${label} must be a three-character airport code.`)
  return code
}

export function parseStorefrontSearchForm(formData: FormData): StorefrontSearchInput {
  const serviceDate = formText(formData, 'serviceDate')
  const passengerCount = Number(formText(formData, 'passengerCount'))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) throw new Error('Choose a valid departure date.')
  if (!Number.isInteger(passengerCount) || passengerCount < 1 || passengerCount > 9) throw new Error('Travelers must be between 1 and 9.')
  return {
    originCode: normalizeAirportCode(formText(formData, 'originCode'), 'Origin'),
    destinationCode: normalizeAirportCode(formText(formData, 'destinationCode'), 'Destination'),
    serviceDate,
    passengerCount,
  }
}

export function parseStorefrontPassengers(formData: FormData, passengerCount: number): StorefrontPassengerInput[] {
  if (!Number.isInteger(passengerCount) || passengerCount < 1 || passengerCount > 9) throw new Error('Travelers must be between 1 and 9.')
  return Array.from({ length: passengerCount }, (_, index) => ({
    givenName: formText(formData, `passenger.${index}.givenName`),
    familyName: formText(formData, `passenger.${index}.familyName`),
    dateOfBirth: formText(formData, `passenger.${index}.dateOfBirth`),
    email: formText(formData, `passenger.${index}.email`),
    phone: formText(formData, `passenger.${index}.phone`),
  }))
}

export function parseBookingAccessForm(formData: FormData) {
  const recordLocator = formText(formData, 'recordLocator').toUpperCase()
  const accessToken = formText(formData, 'accessToken')
  if (!/^[A-Z0-9]{5,10}$/.test(recordLocator)) throw new Error('Enter the reservation record locator.')
  return { recordLocator, accessToken }
}
