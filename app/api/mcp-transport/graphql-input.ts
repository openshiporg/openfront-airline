import {
  type GraphQLSchema,
  Kind,
  parse,
} from "graphql";

export function assertGraphQLOperation(
  schema: GraphQLSchema,
  operation: unknown,
  root: "query" | "mutation",
) {
  if (
    typeof operation !== "string" ||
    operation.length > 128 ||
    !/^[_A-Za-z][_0-9A-Za-z]*$/.test(operation)
  ) {
    throw new Error(`Invalid GraphQL ${root} operation.`);
  }

  const rootType = root === "query" ? schema.getQueryType() : schema.getMutationType();
  if (!rootType?.getFields()[operation]) {
    throw new Error(`Unknown GraphQL ${root} operation.`);
  }
  return operation;
}

/**
 * Selection strings are a deliberate MCP convenience, but they must remain
 * inside one synthetic field. Closing the field or injecting another document
 * definition is rejected before a request reaches GraphQL.
 */
export function assertGraphQLSelection(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.length > 10_000) {
    throw new Error("A bounded GraphQL field selection is required.");
  }

  let document;
  try {
    document = parse(`query __McpSelection { __mcpPlaceholder { ${value} } }`);
  } catch {
    throw new Error("Invalid GraphQL field selection.");
  }

  const definition = document.definitions[0];
  const rootSelection = definition?.kind === Kind.OPERATION_DEFINITION
    ? definition.selectionSet.selections[0]
    : undefined;
  if (
    document.definitions.length !== 1 ||
    definition?.kind !== Kind.OPERATION_DEFINITION ||
    definition.operation !== "query" ||
    definition.selectionSet.selections.length !== 1 ||
    rootSelection?.kind !== Kind.FIELD ||
    rootSelection.name.value !== "__mcpPlaceholder" ||
    !rootSelection.selectionSet
  ) {
    throw new Error("GraphQL field selection escaped its operation boundary.");
  }
  return value.trim();
}

export function graphqlStringLiteral(value: unknown) {
  if (typeof value !== "string" || value.length > 2_000) {
    throw new Error("A bounded search string is required.");
  }
  // JSON string escaping is a subset of GraphQL string escaping.
  return JSON.stringify(value);
}

export function boundedSearchLimit(value: unknown, fallback = 10) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value)) throw new Error("Search limit must be an integer.");
  return Math.max(1, Math.min(Number(value), 100));
}
