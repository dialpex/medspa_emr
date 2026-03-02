// Tool definitions for the schema discovery agent.
// Five tools for GraphQL schema introspection and query building.

import type { ToolHandler } from "./anthropic-client";
import type { MigrationCredentials } from "../providers/types";
import { redactPHI, redactGraphQLErrors } from "./phi-redactor";
import { readCacheForAgent } from "./schema-cache";
import type { CachedTypeInfo, CachedQueryPattern } from "./schema-cache";
import type { CapturedDiscoveryError } from "./discovery-memory";

export type GraphQLExecutor = (
  credentials: MigrationCredentials,
  query: string,
  variables?: Record<string, unknown>
) => Promise<{ data?: Record<string, unknown>; errors?: Array<{ message: string }> }>;

export interface ToolContext {
  vendor: string;
  credentials: MigrationCredentials;
  executor: GraphQLExecutor;
  // Mutable accumulators for the discovery session
  discoveredTypes: Record<string, CachedTypeInfo>;
  discoveredQueries: Record<string, CachedQueryPattern>;
  // Error accumulator for discovery memory
  discoveryErrors: CapturedDiscoveryError[];
}

/**
 * Build the five tool handlers for schema discovery.
 */
export function buildDiscoveryTools(ctx: ToolContext): ToolHandler[] {
  return [
    introspectTypeHandler(ctx),
    introspectSchemaHandler(ctx),
    executeGraphQLHandler(ctx),
    readCachedSchemaHandler(ctx),
    storeArtifactHandler(ctx),
  ];
}

// --- Tool 1: Introspect a single type ---

function introspectTypeHandler(ctx: ToolContext): ToolHandler {
  return {
    name: "introspect_type",
    description:
      "Introspect a single GraphQL type by name using __type. Returns field names, types, " +
      "enum values, and union possible types. Use this to discover the shape of types " +
      "before building queries.",
    input_schema: {
      type: "object",
      properties: {
        type_name: {
          type: "string",
          description: "The GraphQL type name to introspect (e.g., 'Client', 'Business', 'Query')",
        },
      },
      required: ["type_name"],
    },
    handler: async (input) => {
      const typeName = input.type_name as string;
      const query = `query IntrospectType {
        __type(name: "${typeName}") {
          name
          kind
          fields {
            name
            type {
              name
              kind
              ofType { name kind ofType { name kind ofType { name kind } } }
            }
          }
          enumValues { name }
          possibleTypes { name }
        }
      }`;

      const result = await ctx.executor(ctx.credentials, query);

      if (result.errors?.length) {
        return { error: result.errors.map((e) => e.message).join("; ") };
      }

      const typeInfo = result.data?.__type as Record<string, unknown> | null;
      if (!typeInfo) {
        return { error: `Type "${typeName}" not found in schema` };
      }

      // Cache the discovered type info
      const fields = (typeInfo.fields as Array<Record<string, unknown>> | null)?.map((f) => {
        const fieldType = resolveType(f.type as Record<string, unknown>);
        return {
          name: f.name as string,
          type: fieldType.name,
          kind: fieldType.kind,
          isList: fieldType.isList,
          isNonNull: fieldType.isNonNull,
        };
      });

      const cached: CachedTypeInfo = {
        name: typeName,
        kind: typeInfo.kind as string,
        fields,
        enumValues: (typeInfo.enumValues as Array<{ name: string }> | null)?.map((e) => e.name),
        possibleTypes: (typeInfo.possibleTypes as Array<{ name: string }> | null)?.map((t) => t.name),
        cachedAt: new Date().toISOString(),
      };

      ctx.discoveredTypes[typeName] = cached;

      return cached;
    },
  };
}

// --- Tool 2: Introspect root schema queries ---

function introspectSchemaHandler(ctx: ToolContext): ToolHandler {
  return {
    name: "introspect_schema",
    description:
      "Introspect the root Query type to discover all available top-level queries. " +
      "Returns query names with their argument and return types.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
    handler: async () => {
      const query = `query IntrospectSchema {
        __schema {
          queryType {
            fields {
              name
              args {
                name
                type {
                  name
                  kind
                  ofType { name kind ofType { name kind } }
                }
              }
              type {
                name
                kind
                ofType { name kind ofType { name kind ofType { name kind } } }
              }
            }
          }
        }
      }`;

      const result = await ctx.executor(ctx.credentials, query);

      if (result.errors?.length) {
        return { error: result.errors.map((e) => e.message).join("; ") };
      }

      const schema = result.data?.__schema as Record<string, unknown> | null;
      const queryType = schema?.queryType as { fields: Array<Record<string, unknown>> } | null;

      if (!queryType?.fields) {
        return { error: "Could not introspect schema root queries" };
      }

      // Summarize for Claude — return field names with type info
      const queries = queryType.fields.map((f) => ({
        name: f.name,
        args: (f.args as Array<Record<string, unknown>>)?.map((a) => ({
          name: a.name,
          type: formatType(a.type as Record<string, unknown>),
        })),
        returnType: formatType(f.type as Record<string, unknown>),
      }));

      return { queries };
    },
  };
}

// --- Tool 3: Execute a GraphQL query (PHI-redacted results) ---

function executeGraphQLHandler(ctx: ToolContext): ToolHandler {
  return {
    name: "execute_graphql",
    description:
      "Execute a GraphQL query and return the PHI-redacted response structure. " +
      "All string values are replaced with [string len=N], numbers with 0, IDs with [id]. " +
      "Use this to test queries and see response shapes without seeing actual patient data.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The GraphQL query string to execute",
        },
        variables: {
          type: "object",
          description: "Optional query variables",
        },
      },
      required: ["query"],
    },
    handler: async (input) => {
      const queryStr = input.query as string;
      const variables = input.variables as Record<string, unknown> | undefined;

      try {
        const result = await ctx.executor(ctx.credentials, queryStr, variables);

        if (result.errors?.length) {
          // Capture errors for discovery memory
          for (const err of result.errors) {
            const parsed = parseGraphQLError(err.message);
            ctx.discoveryErrors.push({
              errorMessage: err.message,
              query: queryStr,
              typeName: parsed.typeName,
              fieldName: parsed.fieldName,
            });
          }

          return {
            errors: redactGraphQLErrors(result.errors),
            data: result.data ? redactPHI(result.data) : null,
          };
        }

        return { data: redactPHI(result.data) };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { error: msg };
      }
    },
  };
}

// --- Tool 4: Read cached schema ---

function readCachedSchemaHandler(ctx: ToolContext): ToolHandler {
  return {
    name: "read_cached_schema",
    description:
      "Read previously cached schema types and query patterns for this vendor. " +
      "Use this at the start of discovery to avoid re-introspecting known types.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
    handler: async () => {
      return readCacheForAgent(ctx.vendor);
    },
  };
}

// --- Tool 5: Store a working artifact (query pattern or type info) ---

function storeArtifactHandler(ctx: ToolContext): ToolHandler {
  return {
    name: "store_artifact",
    description:
      "Store a verified working query pattern or type info in the cache. " +
      "Call this after you've confirmed a query works correctly.",
    input_schema: {
      type: "object",
      properties: {
        artifact_type: {
          type: "string",
          enum: ["query_pattern", "type_info"],
          description: "Type of artifact to store",
        },
        entity_type: {
          type: "string",
          description: "Entity type this artifact is for (e.g., 'patients', 'services')",
        },
        query: {
          type: "string",
          description: "The working GraphQL query (for query_pattern type)",
        },
        variables: {
          type: "object",
          description: "Default variables template (for query_pattern type)",
        },
      },
      required: ["artifact_type", "entity_type"],
    },
    handler: async (input) => {
      const artifactType = input.artifact_type as string;
      const entityType = input.entity_type as string;

      if (artifactType === "query_pattern") {
        const queryStr = input.query as string;
        if (!queryStr) return { error: "query is required for query_pattern" };

        ctx.discoveredQueries[entityType] = {
          entityType,
          query: queryStr,
          variables: input.variables as Record<string, unknown> | undefined,
          verified: true,
          cachedAt: new Date().toISOString(),
        };

        return { stored: true, entityType, type: "query_pattern" };
      }

      return { stored: true, entityType, type: artifactType };
    },
  };
}

// --- Error Parsing ---

/**
 * Parse a GraphQL error message to extract type and field names.
 * Handles common GraphQL error formats.
 */
export function parseGraphQLError(message: string): {
  typeName: string | null;
  fieldName: string | null;
} {
  // "Cannot query field 'X' on type 'Y'"
  let match = message.match(/Cannot query field ['"](\w+)['"] on type ['"](\w+)['"]/);
  if (match) {
    return { fieldName: match[1], typeName: match[2] };
  }

  // "Unknown argument 'X' on field 'Y.Z'"
  match = message.match(/Unknown argument ['"](\w+)['"] on field ['"](\w+)\.(\w+)['"]/);
  if (match) {
    return { fieldName: match[1], typeName: match[2] };
  }

  // "Field 'X' doesn't exist on type 'Y'"
  match = message.match(/Field ['"](\w+)['"] doesn't exist on type ['"](\w+)['"]/);
  if (match) {
    return { fieldName: match[1], typeName: match[2] };
  }

  // 'In argument "X": Expected type "Y!", found Z'
  match = message.match(/In argument ['"](\w+)['"]/);
  if (match) {
    return { fieldName: match[1], typeName: null };
  }

  return { typeName: null, fieldName: null };
}

// --- Helpers ---

function resolveType(typeObj: Record<string, unknown>): {
  name: string;
  kind: string;
  isList: boolean;
  isNonNull: boolean;
} {
  let isList = false;
  let isNonNull = false;
  let current = typeObj;

  // Unwrap NON_NULL and LIST wrappers
  while (current) {
    const kind = current.kind as string;
    if (kind === "NON_NULL") {
      isNonNull = true;
      current = current.ofType as Record<string, unknown>;
    } else if (kind === "LIST") {
      isList = true;
      current = current.ofType as Record<string, unknown>;
    } else {
      break;
    }
  }

  return {
    name: (current?.name as string) || "Unknown",
    kind: (current?.kind as string) || "SCALAR",
    isList,
    isNonNull,
  };
}

function formatType(typeObj: Record<string, unknown>): string {
  const resolved = resolveType(typeObj);
  let result = resolved.name;
  if (resolved.isList) result = `[${result}]`;
  if (resolved.isNonNull) result += "!";
  return result;
}
