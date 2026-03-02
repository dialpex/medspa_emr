// Discovery Memory — Cross-run error learning + cross-vendor pattern extraction.
// Per-vendor: .migration-cache/{vendor}/discovery-memory.json (90-day TTL, max 50 errors + 20 quirks)
// Cross-vendor: .migration-cache/_shared/discovery-patterns.json (180-day TTL, max 30 patterns)

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const CACHE_BASE = join(process.cwd(), ".migration-cache");
const VENDOR_STALENESS_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const SHARED_STALENESS_MS = 180 * 24 * 60 * 60 * 1000; // 180 days
const MAX_ERRORS = 50;
const MAX_QUIRKS = 20;
const MAX_PATTERNS = 30;

// --- Types ---

export interface DiscoveryErrorEntry {
  errorMessage: string;
  correction: string | null;
  typeName: string | null;
  fieldName: string | null;
  querySnippet: string | null;
  hitCount: number;
  firstSeen: string;
  lastSeen: string;
}

export interface VendorSchemaQuirk {
  note: string;
  category: "arguments" | "type_shape" | "naming" | "pagination" | "other";
  entityTypes: string[];
  addedAt: string;
}

export interface VendorDiscoveryMemory {
  errors: DiscoveryErrorEntry[];
  quirks: VendorSchemaQuirk[];
  updatedAt: string;
}

export interface CrossVendorPattern {
  pattern: string;
  category: "pagination" | "date_filtering" | "nesting" | "naming" | "other";
  confirmedByVendors: string[];
  confidence: number;
  addedAt: string;
  lastConfirmed: string;
}

export interface CrossVendorDiscoveryPatterns {
  patterns: CrossVendorPattern[];
  updatedAt: string;
}

/** Raw error captured during a discovery run, before persistence. */
export interface CapturedDiscoveryError {
  errorMessage: string;
  query: string;
  typeName: string | null;
  fieldName: string | null;
}

// --- File helpers ---

function vendorDir(vendor: string): string {
  return join(CACHE_BASE, vendor.toLowerCase().replace(/[^a-z0-9]/g, "-"));
}

function sharedDir(): string {
  return join(CACHE_BASE, "_shared");
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function readJSON<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function writeJSON(filePath: string, data: unknown): Promise<void> {
  const dir = filePath.substring(0, filePath.lastIndexOf("/"));
  await ensureDir(dir);
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function isStale(timestamp: string, maxAge: number): boolean {
  const age = Date.now() - new Date(timestamp).getTime();
  return age > maxAge;
}

function discoveryMemoryPath(vendor: string): string {
  return join(vendorDir(vendor), "discovery-memory.json");
}

function crossVendorPatternsPath(): string {
  return join(sharedDir(), "discovery-patterns.json");
}

// --- Per-Vendor Memory ---

export async function readVendorDiscoveryMemory(
  vendor: string
): Promise<VendorDiscoveryMemory | null> {
  const cache = await readJSON<VendorDiscoveryMemory>(discoveryMemoryPath(vendor));
  if (!cache) return null;
  if (isStale(cache.updatedAt, VENDOR_STALENESS_MS)) {
    console.log(`[discovery-memory] Cache for ${vendor} is stale (>90 days), ignoring`);
    return null;
  }
  return cache;
}

export async function writeVendorDiscoveryMemory(
  vendor: string,
  memory: VendorDiscoveryMemory
): Promise<void> {
  await writeJSON(discoveryMemoryPath(vendor), memory);
}

/**
 * Upsert a discovery error. Deduplicates by errorMessage — if the same error
 * already exists, increments hitCount and updates lastSeen. Enforces max 50 errors.
 */
export async function addDiscoveryError(
  vendor: string,
  error: CapturedDiscoveryError,
  correction?: string
): Promise<void> {
  const existing = await readJSON<VendorDiscoveryMemory>(discoveryMemoryPath(vendor));
  const memory: VendorDiscoveryMemory = existing || {
    errors: [],
    quirks: [],
    updatedAt: new Date().toISOString(),
  };

  const now = new Date().toISOString();

  // Dedup by errorMessage
  const idx = memory.errors.findIndex((e) => e.errorMessage === error.errorMessage);
  if (idx >= 0) {
    memory.errors[idx].hitCount += 1;
    memory.errors[idx].lastSeen = now;
    if (correction) {
      memory.errors[idx].correction = correction;
    }
  } else {
    memory.errors.push({
      errorMessage: error.errorMessage,
      correction: correction || null,
      typeName: error.typeName,
      fieldName: error.fieldName,
      querySnippet: error.query.length > 200 ? error.query.substring(0, 200) : error.query,
      hitCount: 1,
      firstSeen: now,
      lastSeen: now,
    });
  }

  // Enforce max — drop oldest (by lastSeen) entries
  if (memory.errors.length > MAX_ERRORS) {
    memory.errors.sort(
      (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
    );
    memory.errors = memory.errors.slice(0, MAX_ERRORS);
  }

  memory.updatedAt = now;
  await writeJSON(discoveryMemoryPath(vendor), memory);
}

/**
 * Add a schema quirk note. Deduplicates by note text. Enforces max 20 quirks.
 */
export async function addSchemaQuirk(
  vendor: string,
  quirk: Omit<VendorSchemaQuirk, "addedAt">
): Promise<void> {
  const existing = await readJSON<VendorDiscoveryMemory>(discoveryMemoryPath(vendor));
  const memory: VendorDiscoveryMemory = existing || {
    errors: [],
    quirks: [],
    updatedAt: new Date().toISOString(),
  };

  // Dedup by note
  if (memory.quirks.some((q) => q.note === quirk.note)) return;

  memory.quirks.push({ ...quirk, addedAt: new Date().toISOString() });

  // Enforce max
  if (memory.quirks.length > MAX_QUIRKS) {
    memory.quirks = memory.quirks.slice(-MAX_QUIRKS);
  }

  memory.updatedAt = new Date().toISOString();
  await writeJSON(discoveryMemoryPath(vendor), memory);
}

// --- Cross-Vendor Patterns ---

export async function readCrossVendorPatterns(): Promise<CrossVendorDiscoveryPatterns | null> {
  const cache = await readJSON<CrossVendorDiscoveryPatterns>(crossVendorPatternsPath());
  if (!cache) return null;
  if (isStale(cache.updatedAt, SHARED_STALENESS_MS)) {
    console.log("[discovery-memory] Cross-vendor patterns are stale (>180 days), ignoring");
    return null;
  }
  return cache;
}

/**
 * Add or update a cross-vendor pattern. If the same pattern text exists,
 * adds the vendor to confirmedByVendors and bumps confidence.
 */
export async function addCrossVendorPattern(
  vendor: string,
  pattern: Omit<CrossVendorPattern, "confirmedByVendors" | "confidence" | "addedAt" | "lastConfirmed">
): Promise<void> {
  const existing = await readJSON<CrossVendorDiscoveryPatterns>(crossVendorPatternsPath());
  const store: CrossVendorDiscoveryPatterns = existing || {
    patterns: [],
    updatedAt: new Date().toISOString(),
  };

  const now = new Date().toISOString();
  const idx = store.patterns.findIndex((p) => p.pattern === pattern.pattern);

  if (idx >= 0) {
    const p = store.patterns[idx];
    if (!p.confirmedByVendors.includes(vendor)) {
      p.confirmedByVendors.push(vendor);
    }
    p.confidence = Math.min(1.0, 0.5 + p.confirmedByVendors.length * 0.15);
    p.lastConfirmed = now;
  } else {
    store.patterns.push({
      pattern: pattern.pattern,
      category: pattern.category,
      confirmedByVendors: [vendor],
      confidence: 0.5,
      addedAt: now,
      lastConfirmed: now,
    });
  }

  // Enforce max — keep highest confidence
  if (store.patterns.length > MAX_PATTERNS) {
    store.patterns.sort((a, b) => b.confidence - a.confidence);
    store.patterns = store.patterns.slice(0, MAX_PATTERNS);
  }

  store.updatedAt = now;
  await writeJSON(crossVendorPatternsPath(), store);
}

/**
 * Heuristic extraction of cross-vendor patterns from working queries.
 * Looks for pagination, date filtering, and nesting patterns.
 */
export async function extractCrossVendorPatterns(
  vendor: string,
  workingQueries: Record<string, { query: string }>,
  _discoveredTypes: Record<string, { kind: string; fields?: Array<{ name: string }> }>
): Promise<void> {
  const queries = Object.values(workingQueries).map((q) => q.query);

  // Detect relay cursor pagination
  if (queries.some((q) => /pageInfo\s*\{/.test(q) && /hasNextPage/.test(q))) {
    await addCrossVendorPattern(vendor, {
      pattern:
        "Relay cursor pagination: pageInfo { hasNextPage, endCursor } with 'after' argument",
      category: "pagination",
    });
  }

  // Detect limit/offset pagination
  if (queries.some((q) => /\blimit\b/i.test(q) && /\boffset\b/i.test(q))) {
    await addCrossVendorPattern(vendor, {
      pattern: "Limit/offset pagination: limit and offset arguments",
      category: "pagination",
    });
  }

  // Detect from/to date filtering
  if (queries.some((q) => /\bfrom\s*:/.test(q) && /\bto\s*:/.test(q))) {
    await addCrossVendorPattern(vendor, {
      pattern: "Date range filters commonly use 'from'/'to' arguments",
      category: "date_filtering",
    });
  }

  // Detect edges/node connection pattern
  if (queries.some((q) => /edges\s*\{/.test(q) && /node\s*\{/.test(q))) {
    await addCrossVendorPattern(vendor, {
      pattern: "Connection types use edges { node { ... } } pattern",
      category: "nesting",
    });
  }
}

// --- Agent-Readable Output ---

/**
 * Build a formatted string for prompt injection into the discovery agent.
 * Returns undefined if no memory exists for this vendor and no cross-vendor patterns.
 */
export async function readDiscoveryMemoryForAgent(
  vendor: string
): Promise<string | undefined> {
  const vendorMemory = await readVendorDiscoveryMemory(vendor);
  const crossVendor = await readCrossVendorPatterns();

  const hasVendorData =
    vendorMemory &&
    (vendorMemory.errors.length > 0 || vendorMemory.quirks.length > 0);
  const hasCrossVendor = crossVendor && crossVendor.patterns.length > 0;

  if (!hasVendorData && !hasCrossVendor) return undefined;

  const parts: string[] = [];

  if (hasVendorData) {
    parts.push(`## Known Issues for "${vendor}" (from previous discovery runs)\n`);

    if (vendorMemory.errors.length > 0) {
      parts.push("### Field/Type Errors (avoid repeating these):");
      // Sort by hitCount descending so most common errors are first
      const sorted = [...vendorMemory.errors].sort((a, b) => b.hitCount - a.hitCount);
      for (const err of sorted) {
        const correction = err.correction
          ? ` → Use "${err.correction}" instead`
          : "";
        const typePart = err.typeName ? `${err.typeName}.` : "";
        const fieldPart = err.fieldName || err.errorMessage;
        parts.push(
          `- ${typePart}${fieldPart} does NOT exist${correction} (seen ${err.hitCount}x)`
        );
      }
      parts.push("");
    }

    if (vendorMemory.quirks.length > 0) {
      parts.push("### Schema Quirks:");
      for (const quirk of vendorMemory.quirks) {
        parts.push(`- [${quirk.category}] ${quirk.note}`);
      }
      parts.push("");
    }
  }

  if (hasCrossVendor) {
    parts.push("## Common GraphQL Patterns (cross-vendor):\n");
    // Sort by confidence descending
    const sorted = [...crossVendor.patterns].sort((a, b) => b.confidence - a.confidence);
    for (const p of sorted) {
      parts.push(`- [${p.category}] ${p.pattern}`);
    }
    parts.push("");
  }

  return parts.join("\n");
}
