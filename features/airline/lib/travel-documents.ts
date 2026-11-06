// Travel-document verification is an international-travel requirement: a flight that departs and lands in the same
// country (e.g. JFK–BOS) checks in without it, as every domestic carrier's online check-in does; identity is checked
// at security and the gate. An unknown country on either end is treated as international, so the check stays on.
export function travelDocumentsRequired(originCountryCode?: string | null, destinationCountryCode?: string | null) {
  const origin = originCountryCode?.trim().toUpperCase() ?? ''
  const destination = destinationCountryCode?.trim().toUpperCase() ?? ''
  if (!/^[A-Z]{2}$/.test(origin) || !/^[A-Z]{2}$/.test(destination)) return true
  return origin !== destination
}
