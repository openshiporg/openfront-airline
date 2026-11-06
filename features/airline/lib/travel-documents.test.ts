import assert from 'node:assert/strict'
import test from 'node:test'

import { travelDocumentsRequired } from './travel-documents'

test('domestic flights check in without a travel-document verification', () => {
  assert.equal(travelDocumentsRequired('US', 'US'), false)
  assert.equal(travelDocumentsRequired(' us', 'US '), false)
})

test('international flights still require a verified travel document', () => {
  assert.equal(travelDocumentsRequired('US', 'GB'), true)
})

test('an unknown country on either end keeps the requirement', () => {
  assert.equal(travelDocumentsRequired(null, 'US'), true)
  assert.equal(travelDocumentsRequired('US', ''), true)
  assert.equal(travelDocumentsRequired('USA', 'US'), true)
})
