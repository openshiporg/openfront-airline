import { GraphQLError, visit, type DocumentNode } from 'graphql'
import type { ApolloServerPlugin } from '@apollo/server'

export function requestsIntrospection(document: DocumentNode) {
  let found = false
  visit(document, {
    Field(node) {
      if (node.name.value === '__schema' || node.name.value === '__type') found = true
    },
  })
  return found
}

// Schema introspection is for signed-in operators (the AI assistant's MCP route forwards their session).
// Anonymous callers can still use every public storefront query; they just can't map the whole schema.
export const anonymousIntrospectionGuard: ApolloServerPlugin<any> = {
  async requestDidStart() {
    return {
      async didResolveOperation({ contextValue, document }) {
        if (!contextValue?.session && requestsIntrospection(document)) {
          throw new GraphQLError('Introspection requires a signed-in operator.', { extensions: { code: 'FORBIDDEN' } })
        }
      },
    }
  },
}
