import assert from 'node:assert/strict'
import test from 'node:test'
import { parse } from 'graphql'

import { requestsIntrospection } from './anonymous-introspection'

test('schema and type introspection are detected', () => {
  assert.equal(requestsIntrospection(parse('{ __schema { queryType { name } } }')), true)
  assert.equal(requestsIntrospection(parse('{ __type(name: "Query") { name } }')), true)
})

test('ordinary queries, including __typename, are not introspection', () => {
  assert.equal(requestsIntrospection(parse('query($c: String!) { publicCarrierIdentity(carrierCode: $c) { name __typename } }')), false)
})
