import crypto from 'node:crypto'

export type CouponTransformation = 'alternative' | 'split' | 'consolidation'
export type CouponState = {
  id: string
  serviceObligationId: string
  serviceObligationVersion: number
  status: string
  bookingPassengerId: string
}

const spendable = (coupon: CouponState) => coupon.status === 'open' || coupon.status === 'checked_in'

export function createServiceObligationKey() {
  return `svo_${crypto.randomBytes(24).toString('base64url')}`
}

/** Validate the immutable parent→child coupon graph before persisting its edges. */
export function validateCouponTransformation(
  transformation: CouponTransformation,
  parents: CouponState[],
  children: CouponState[],
) {
  if (!parents.length || !children.length) throw new Error('A coupon transformation requires parent and child coupons.')
  if ([...parents, ...children].some(coupon => !coupon.id || !coupon.serviceObligationId || !Number.isInteger(coupon.serviceObligationVersion) || coupon.serviceObligationVersion < 1 || !coupon.bookingPassengerId)) {
    throw new Error('Coupon lineage requires persisted coupons with versioned service obligations.')
  }
  if (new Set([...parents, ...children].map(coupon => coupon.bookingPassengerId)).size !== 1) {
    throw new Error('Coupon lineage cannot cross booking passengers.')
  }
  if (parents.some(coupon => coupon.status !== 'exchanged') || children.some(coupon => !spendable(coupon))) {
    throw new Error('Retire every parent as exchanged before activating spendable child coupons.')
  }

  if (transformation === 'alternative') {
    if (parents.length !== 1 || children.length !== 1) throw new Error('An alternative must replace exactly one coupon with one coupon.')
    if (parents[0].serviceObligationId !== children[0].serviceObligationId || children[0].serviceObligationVersion !== parents[0].serviceObligationVersion + 1) {
      throw new Error('An alternative must advance the same service obligation by exactly one version.')
    }
    return
  }

  if (transformation === 'split') {
    if (parents.length !== 1 || children.length < 2) throw new Error('A connection split requires one parent and at least two child coupons.')
    const childObligations = children.map(coupon => coupon.serviceObligationId)
    if (new Set(childObligations).size !== children.length || childObligations.includes(parents[0].serviceObligationId) || children.some(coupon => coupon.serviceObligationVersion !== 1)) {
      throw new Error('Every split child requires its own new service obligation at version one.')
    }
    return
  }

  if (parents.length < 2 || children.length !== 1) throw new Error('A consolidation requires at least two parent coupons and exactly one child coupon.')
  const parentObligations = parents.map(coupon => coupon.serviceObligationId)
  if (new Set(parentObligations).size !== parents.length || parentObligations.includes(children[0].serviceObligationId) || children[0].serviceObligationVersion !== 1) {
    throw new Error('A consolidation must retire distinct parent obligations and create a new child obligation at version one.')
  }
}
