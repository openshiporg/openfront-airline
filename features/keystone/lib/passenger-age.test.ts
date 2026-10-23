import assert from 'node:assert/strict'
import test from 'node:test'

import { ageOn, hasAccompanyingAdult, passengerTypeOn, travelerDateOfBirth } from './passenger-age'

const departure = new Date('2026-12-01T00:00:00.000Z')

test('age counts whole years on the departure date', () => {
  assert.equal(ageOn(new Date('2008-12-01T00:00:00.000Z'), departure), 18)
  assert.equal(ageOn(new Date('2008-12-02T00:00:00.000Z'), departure), 17)
})

test('fare type follows infant, child and adult bands', () => {
  assert.equal(passengerTypeOn('2025-06-01', departure), 'infant_with_seat')
  assert.equal(passengerTypeOn('2020-01-01', departure), 'child')
  assert.equal(passengerTypeOn('2014-11-30', departure), 'adult')
})

test('dates of birth must be real and not after departure', () => {
  assert.equal(travelerDateOfBirth('2026-02-30', departure), null)
  assert.equal(travelerDateOfBirth('2027-01-01', departure), null)
  assert.ok(travelerDateOfBirth('2026-11-30', departure))
})

test('a party needs one traveler 18 or over', () => {
  assert.equal(hasAccompanyingAdult([new Date('2015-01-01T00:00:00.000Z')], departure), false)
  assert.equal(hasAccompanyingAdult([new Date('2015-01-01T00:00:00.000Z'), new Date('1990-01-01T00:00:00.000Z')], departure), true)
})
