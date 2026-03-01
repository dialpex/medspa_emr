// Schema Cache — File-based cache for discovered schemas and working queries.
// Stores in .migration-cache/{vendor}/ (gitignored).
// 7-day staleness detection, manual invalidation.

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const CACHE_BASE = join(process.cwd(), ".migration-cache");
const STALENESS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface CachedTypeInfo {
  name: string;
  kind: string;
  fields?: Array<{
    name: string;
    type: string;
    kind: string;
    isList: boolean;
    isNonNull: boolean;
  }>;
  enumValues?: string[];
  possibleTypes?: string[];
  cachedAt: string;
}

export interface CachedQueryPattern {
  entityType: string;
  query: string;
  variables?: Record<string, unknown>;
  verified: boolean;
  cachedAt: string;
}

export interface SchemaCache {
  types: Record<string, CachedTypeInfo>;
  updatedAt: string;
}

export interface QueryPatternCache {
  patterns: Record<string, CachedQueryPattern>;
  updatedAt: string;
}

function vendorDir(vendor: string): string {
  return join(CACHE_BASE, vendor.toLowerCase().replace(/[^a-z0-9]/g, "-"));
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function readJSON<T>(path: string): Promise<T | null> {
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function writeJSON(path: string, data: unknown): Promise<void> {
  const dir = path.substring(0, path.lastIndexOf("/"));
  await ensureDir(dir);
  await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
}

function isStale(timestamp: string): boolean {
  const age = Date.now() - new Date(timestamp).getTime();
  return age > STALENESS_MS;
}

// --- Public API ---

export async function readSchemaCache(vendor: string): Promise<SchemaCache | null> {
  const cache = await readJSON<SchemaCache>(join(vendorDir(vendor), "schema-cache.json"));
  if (!cache) return null;
  if (isStale(cache.updatedAt)) {
    console.log(`[schema-cache] Cache for ${vendor} is stale (>7 days), will re-discover`);
    return null;
  }
  return cache;
}

export async function writeSchemaCache(vendor: string, types: Record<string, CachedTypeInfo>): Promise<void> {
  const cache: SchemaCache = { types, updatedAt: new Date().toISOString() };
  await writeJSON(join(vendorDir(vendor), "schema-cache.json"), cache);
}

export async function readQueryPatterns(vendor: string): Promise<QueryPatternCache | null> {
  const cache = await readJSON<QueryPatternCache>(join(vendorDir(vendor), "query-patterns.json"));
  if (!cache) return null;
  if (isStale(cache.updatedAt)) return null;
  return cache;
}

export async function writeQueryPatterns(vendor: string, patterns: Record<string, CachedQueryPattern>): Promise<void> {
  const cache: QueryPatternCache = { patterns, updatedAt: new Date().toISOString() };
  await writeJSON(join(vendorDir(vendor), "query-patterns.json"), cache);
}

export async function invalidateCache(vendor: string): Promise<void> {
  const dir = vendorDir(vendor);
  try {
    const { rm } = await import("fs/promises");
    await rm(dir, { recursive: true, force: true });
  } catch {
    // Directory might not exist
  }
}

/**
 * Read the full cache as a single string for the AI agent to consume.
 */
export async function readCacheForAgent(vendor: string): Promise<string> {
  const schema = await readSchemaCache(vendor);
  const queries = await readQueryPatterns(vendor);

  if (!schema && !queries) return "No cached schema or query patterns found.";

  const parts: string[] = [];
  if (schema) {
    const typeCount = Object.keys(schema.types).length;
    parts.push(`Schema cache: ${typeCount} types cached (updated ${schema.updatedAt})`);
    for (const [name, info] of Object.entries(schema.types)) {
      const fieldList = info.fields?.map((f) => `${f.name}: ${f.type}${f.isList ? "[]" : ""}${f.isNonNull ? "!" : ""}`).join(", ") || "";
      parts.push(`  ${info.kind} ${name}: { ${fieldList} }`);
    }
  }

  if (queries) {
    const patternCount = Object.keys(queries.patterns).length;
    parts.push(`\nQuery patterns: ${patternCount} cached (updated ${queries.updatedAt})`);
    for (const [key, pattern] of Object.entries(queries.patterns)) {
      parts.push(`  ${key} (verified=${pattern.verified}): ${pattern.query.substring(0, 200)}...`);
    }
  }

  return parts.join("\n");
}
