import { visit, type DocumentNode } from 'graphql'

// True when an operation asks for __schema or __type (not __typename). pages/api/graphql.ts refuses these for
// anonymous callers.
export function requestsIntrospection(document: DocumentNode) {
  let found = false
  visit(document, {
    Field(node) {
      if (node.name.value === '__schema' || node.name.value === '__type') found = true
    },
  })
  return found
}
