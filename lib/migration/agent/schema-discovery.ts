// Schema Discovery Agent — Uses Claude to introspect GraphQL schemas,
// build queries, test them, fix errors, and cache results.
// PHI boundary: raw patient data NEVER goes to Claude.

import { AnthropicClient } from "./anthropic-client";
import { buildDiscoveryTools, type GraphQLExecutor } from "./tools";
import type { MigrationCredentials } from "../providers/types";
import type { CachedTypeInfo, CachedQueryPattern } from "./schema-cache";
import {
  readSchemaCache,
  readQueryPatterns,
  writeSchemaCache,
  writeQueryPatterns,
} from "./schema-cache";
import { SCHEMA_DISCOVERY_SYSTEM_PROMPT, buildDiscoveryUserPrompt } from "./prompts";

export interface SeedQuery {
  entityType: string;
  query: string;
  variables?: Record<string, unknown>;
}

export interface DiscoveryResult {
  queries: Record<string, CachedQueryPattern>;
  types: Record<string, CachedTypeInfo>;
  toolCallCount: number;
  fromCache: boolean;
}

/**
 * Run the schema discovery agent. Claude introspects the GraphQL schema,
 * builds queries for each entity type, tests them, fixes errors, and caches results.
 *
 * @param vendor - Vendor name (e.g., "Boulevard")
 * @param credentials - API credentials for the vendor
 * @param executor - Function to execute GraphQL queries against the vendor
 * @param entityTypes - Entity types to discover queries for (e.g., ["patients", "services"])
 * @param seedQueries - Existing hardcoded queries to use as hints
 */
export async function discoverAndBuildQueries(
  vendor: string,
  credentials: MigrationCredentials,
  executor: GraphQLExecutor,
  entityTypes: string[],
  seedQueries: SeedQuery[] = []
): Promise<DiscoveryResult> {
  // Check cache first
  const cachedSchema = await readSchemaCache(vendor);
  const cachedQueries = await readQueryPatterns(vendor);

  // If we have verified cached queries for all requested entity types, use them
  if (cachedQueries) {
    const allCovered = entityTypes.every(
      (et) => cachedQueries.patterns[et]?.verified
    );
    if (allCovered) {
      console.log(`[schema-discovery] Using cached queries for ${vendor} (${entityTypes.length} entities)`);
      return {
        queries: cachedQueries.patterns,
        types: cachedSchema?.types || {},
        toolCallCount: 0,
        fromCache: true,
      };
    }
  }

  // Run the discovery agent
  const client = new AnthropicClient();

  const discoveredTypes: Record<string, CachedTypeInfo> = cachedSchema?.types || {};
  const discoveredQueries: Record<string, CachedQueryPattern> = cachedQueries?.patterns || {};

  const tools = buildDiscoveryTools({
    vendor,
    credentials,
    executor,
    discoveredTypes,
    discoveredQueries,
  });

  const userPrompt = buildDiscoveryUserPrompt(vendor, entityTypes, seedQueries);

  console.log(`[schema-discovery] Starting discovery for ${vendor}: ${entityTypes.join(", ")}`);
  const startTime = Date.now();

  const result = await client.runToolLoop(
    SCHEMA_DISCOVERY_SYSTEM_PROMPT,
    userPrompt,
    tools,
    20, // max iterations
    8192
  );

  const elapsed = Date.now() - startTime;
  console.log(
    `[schema-discovery] Completed in ${elapsed}ms, ${result.toolCallCount} tool calls, ` +
    `${result.inputTokens} input tokens, ${result.outputTokens} output tokens`
  );

  // Persist to cache
  await writeSchemaCache(vendor, discoveredTypes);
  await writeQueryPatterns(vendor, discoveredQueries);

  return {
    queries: discoveredQueries,
    types: discoveredTypes,
    toolCallCount: result.toolCallCount,
    fromCache: false,
  };
}
