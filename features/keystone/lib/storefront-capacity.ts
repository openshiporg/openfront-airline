export function anonymousHoldQuota(authorized: number, requestedPartySize: number) {
  const baseline = Math.max(1, Math.floor(authorized * 0.25))
  return Math.min(10, Math.max(requestedPartySize, baseline))
}
