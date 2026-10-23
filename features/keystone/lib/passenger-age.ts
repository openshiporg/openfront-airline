// Fare types by age on the departure date, following the usual airline convention: infant under 2 (sold with
// their own seat online), child 2–11, adult 12 and over. Every online party needs one traveler 18 or over.
export type OnlinePassengerType = 'adult' | 'child' | 'infant_with_seat'

export function ageOn(dateOfBirth: Date, on: Date) {
  let age = on.getUTCFullYear() - dateOfBirth.getUTCFullYear()
  const beforeBirthday = on.getUTCMonth() < dateOfBirth.getUTCMonth() || (on.getUTCMonth() === dateOfBirth.getUTCMonth() && on.getUTCDate() < dateOfBirth.getUTCDate())
  if (beforeBirthday) age -= 1
  return age
}

export function passengerTypeOn(dateOfBirth: Date | string | null | undefined, on: Date): OnlinePassengerType {
  const birth = dateOfBirth ? new Date(dateOfBirth) : null
  if (!birth || Number.isNaN(birth.getTime())) return 'adult'
  const age = ageOn(birth, on)
  return age < 2 ? 'infant_with_seat' : age < 12 ? 'child' : 'adult'
}

// Parses a YYYY-MM-DD date of birth for a traveler on the given departure date (any age from birth to 120).
export function travelerDateOfBirth(value: string, departure: Date) {
  const dateOfBirth = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date('invalid')
  if (Number.isNaN(dateOfBirth.getTime()) || dateOfBirth.toISOString().slice(0, 10) !== value) return null
  const age = ageOn(dateOfBirth, departure)
  if (age < 0 || age > 120) return null
  return dateOfBirth
}

export function hasAccompanyingAdult(datesOfBirth: Date[], departure: Date) {
  return datesOfBirth.some(dateOfBirth => ageOn(dateOfBirth, departure) >= 18)
}
