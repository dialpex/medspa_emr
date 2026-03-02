// Mapping Memory — Cross-run cache for successful mapping patterns.
// Stores in .migration-cache/{vendor}/mapping-memory.json (gitignored).
// 30-day staleness, max 5 entries per vendor.

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const CACHE_BASE = join(process.cwd(), ".migration-cache");
const STALENESS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_ENTRIES = 5;

export interface MappingMemoryEntry {
  runId: string;
  vendor: string;
  createdAt: string;
  entityMappings: Array<{
    sourceEntity: string;
    targetEntity: string;
    fieldMappings: Array<{
      sourceField: string;
      targetField: string;
      transform: string | null;
      transformContext?: Record<string, unknown>;
    }>;
    enumMaps: Record<string, Record<string, string>>;
  }>;
  correctionHistory: Array<{
    attempt: number;
    errorsByCode: Record<string, number>;
    fixed: boolean;
  }>;
}

export interface MappingMemoryCache {
  entries: MappingMemoryEntry[];
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

function memoryPath(vendor: string): string {
  return join(vendorDir(vendor), "mapping-memory.json");
}

// --- Public API ---

export async function readMappingMemory(vendor: string): Promise<MappingMemoryCache | null> {
  const cache = await readJSON<MappingMemoryCache>(memoryPath(vendor));
  if (!cache) return null;
  if (isStale(cache.updatedAt)) {
    console.log(`[mapping-memory] Cache for ${vendor} is stale (>30 days), ignoring`);
    return null;
  }
  return cache;
}

export async function writeMappingMemory(
  vendor: string,
  entry: MappingMemoryEntry
): Promise<void> {
  const existing = await readJSON<MappingMemoryCache>(memoryPath(vendor));
  const entries = existing?.entries || [];

  // Add new entry at the front
  entries.unshift(entry);

  // Trim to max entries, keeping most recent
  while (entries.length > MAX_ENTRIES) {
    entries.pop();
  }

  const cache: MappingMemoryCache = {
    entries,
    updatedAt: new Date().toISOString(),
  };

  await writeJSON(memoryPath(vendor), cache);
  console.log(
    `[mapping-memory] Persisted mapping memory for ${vendor} (${entries.length} entries)`
  );
}

/**
 * Build a human-readable summary of mapping memory for AI agent consumption.
 * Returns undefined if no memory exists.
 */
export async function readMemoryForAgent(vendor: string): Promise<string | undefined> {
  const cache = await readMappingMemory(vendor);
  if (!cache || cache.entries.length === 0) return undefined;

  const parts: string[] = [];
  parts.push(`Found ${cache.entries.length} previous successful mapping(s) for "${vendor}":\n`);

  for (const entry of cache.entries) {
    parts.push(`--- Run ${entry.runId} (${entry.createdAt}) ---`);
    for (const em of entry.entityMappings) {
      parts.push(`  ${em.sourceEntity} → ${em.targetEntity}:`);
      for (const fm of em.fieldMappings) {
        const transform = fm.transform ? ` [${fm.transform}]` : "";
        parts.push(`    ${fm.sourceField} → ${fm.targetField}${transform}`);
      }
      if (Object.keys(em.enumMaps).length > 0) {
        for (const [field, map] of Object.entries(em.enumMaps)) {
          parts.push(`    enumMap(${field}): ${JSON.stringify(map)}`);
        }
      }
    }

    if (entry.correctionHistory.length > 0) {
      parts.push(`  Corrections needed: ${entry.correctionHistory.length}`);
      for (const c of entry.correctionHistory) {
        parts.push(
          `    Attempt ${c.attempt}: ${JSON.stringify(c.errorsByCode)} → fixed=${c.fixed}`
        );
      }
    }
    parts.push("");
  }

  return parts.join("\n");
}
