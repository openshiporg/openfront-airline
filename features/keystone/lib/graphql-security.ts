import { depthLimit } from "@graphile/depth-limit";

/**
 * Keystone 6.5 does not yet ship a query-depth ceiling. The served endpoint is
 * GraphQL Yoga (pages/api/graphql.ts), which adds this rule to its validation
 * pipeline so cyclic relationship queries are rejected before resolver or
 * database work starts. No Keystone Apollo server is started by this app.
 */
export const graphqlDepthLimitRule = depthLimit({
  maxDepth: 12,
  maxListDepth: 4,
  maxSelfReferentialDepth: 2,
  maxIntrospectionDepth: 20,
  maxIntrospectionListDepth: 4,
  // GraphQL's standard introspection query recursively follows __Type.ofType.
  maxIntrospectionSelfReferentialDepth: 15,
  maxDepthByFieldCoordinates: {
    // graphql@16.12's getIntrospectionQuery traverses __Type.ofType nine times.
    "__Type.ofType": 15,
  },
  revealDetails: false,
});
