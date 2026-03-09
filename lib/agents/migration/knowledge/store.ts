// Knowledge Store — The Migration Agent's long-term memory
//
// Principles:
// - Opinionated: facts are convictions, not suggestions. High-confidence facts
//   are used deterministically without AI. The agent doesn't ask "what should I do?"
//   when it already knows the answer.
// - Self-healing: contradictions don't delete knowledge — they reduce confidence
//   and trigger healing entries. The agent tracks WHY it was wrong, not just THAT
//   it was wrong.
// - Pragmatic: not every observation becomes a fact. The store has signal thresholds
//   to filter noise from genuine patterns.
// - Cross-vendor: facts carry a scope flag. A fact confirmed across 2+ vendors
//   gets elevated to cross-vendor scope automatically.

import { createHash } from "crypto";
import { join } from "path";
import {
  CACHE_BASE,
  readJSON,
  writeJSON,
  ensureDir,
} from "@/lib/agents/_shared/memory/base";
import type {
  KnowledgeFact,
  KnowledgeType,
  KnowledgeFile,
  KnowledgeQuery,
  KnowledgeMetrics,
  HealingEntry,
  ConfirmationSource,
  ContradictionSource,
} from "./types";
import {
  DETERMINISTIC_THRESHOLD,
  DISPUTED_THRESHOLD,
  DECAY_GRACE_DAYS,
  DECAY_RATE,
  Conviction,
} from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWLEDGE_DIR = join(CACHE_BASE, "_knowledge");

const FILE_MAP: Record<KnowledgeType, string> = {
  mapping_pattern: "mapping-patterns.json",
  form_archetype: "form-archetypes.json",
  field_semantic: "field-semantics.json",
  api_quirk: "api-quirks.json",
  error_pattern: "error-patterns.json",
};

/** Confidence boost per confirmation */
const CONFIRMATION_BOOST = 0.05;

/** Confidence penalty per contradiction */
const CONTRADICTION_PENALTY = 0.15;

/** Max healing log entries per fact (prevent unbounded growth) */
const MAX_HEALING_LOG = 20;

/** Cross-vendor promotion: minimum distinct vendors to auto-elevate scope */
const CROSS_VENDOR_MIN = 2;

// ---------------------------------------------------------------------------
// KnowledgeStore
// ---------------------------------------------------------------------------

export class KnowledgeStore {
  private cache = new Map<KnowledgeType, KnowledgeFile>();
  private dirty = new Set<KnowledgeType>();

  // -------------------------------------------------------------------------
  // Read operations
  // -------------------------------------------------------------------------

  /**
   * Query facts by type, vendor, confidence, etc.
   * Returns facts sorted by confidence (highest first).
   */
  async query<T = unknown>(q: KnowledgeQuery): Promise<KnowledgeFact<T>[]> {
    const file = await this.loadFile(q.type);
    let facts = Object.values(file.facts) as KnowledgeFact<T>[];

    // Apply decay before filtering
    facts = facts.map((f) => ({ ...f, confidence: this.decayedConfidence(f) }));

    if (q.vendor) {
      facts = facts.filter(
        (f) => f.vendors.includes(q.vendor!) || f.scope === "cross-vendor"
      );
    }

    if (q.minConfidence !== undefined) {
      facts = facts.filter((f) => f.confidence >= q.minConfidence!);
    }

    if (q.excludeDisputed) {
      facts = facts.filter((f) => f.confidence >= DISPUTED_THRESHOLD);
    }

    if (q.key) {
      facts = facts.filter((f) => f.key === q.key);
    } else if (q.keyPattern) {
      facts = facts.filter((f) => f.key.includes(q.keyPattern!));
    }

    // Sort by confidence descending
    facts.sort((a, b) => b.confidence - a.confidence);

    if (q.limit) {
      facts = facts.slice(0, q.limit);
    }

    return facts;
  }

  /**
   * Get a single fact by type and key.
   */
  async get<T = unknown>(
    type: KnowledgeType,
    key: string
  ): Promise<KnowledgeFact<T> | null> {
    const file = await this.loadFile(type);
    const id = factId(type, key);
    const fact = file.facts[id] as KnowledgeFact<T> | undefined;
    if (!fact) return null;
    return { ...fact, confidence: this.decayedConfidence(fact) };
  }

  /**
   * Check if a fact exists with sufficient confidence for deterministic use.
   * This is the primary "do I know this?" check.
   */
  async knows(type: KnowledgeType, key: string): Promise<boolean> {
    const fact = await this.get(type, key);
    return fact !== null && fact.confidence >= DETERMINISTIC_THRESHOLD;
  }

  /**
   * Get a fact if it's strong enough to use as a hint (lower threshold).
   */
  async hint<T = unknown>(
    type: KnowledgeType,
    key: string
  ): Promise<KnowledgeFact<T> | null> {
    const fact = await this.get<T>(type, key);
    if (!fact || fact.confidence < Conviction.HYPOTHESIS) return null;
    return fact;
  }

  // -------------------------------------------------------------------------
  // Write operations
  // -------------------------------------------------------------------------

  /**
   * Record a fact — create or confirm.
   * If the fact exists and values match, confirm (boost confidence).
   * If the fact exists and values differ, this is a contradiction + update.
   * If the fact doesn't exist, create at initial confidence.
   */
  async record<T>(
    type: KnowledgeType,
    key: string,
    value: T,
    source: ConfirmationSource,
    options?: {
      scope?: "vendor" | "cross-vendor";
      initialConfidence?: number;
    }
  ): Promise<KnowledgeFact<T>> {
    const file = await this.loadFile(type);
    const id = factId(type, key);
    const now = new Date().toISOString();
    const existing = file.facts[id] as KnowledgeFact<T> | undefined;

    if (existing) {
      // Fact exists — confirm or update
      const valuesMatch = deepEqual(existing.value, value);

      if (valuesMatch) {
        return this.confirm(type, key, source);
      } else {
        // Values differ — this is a correction, not a contradiction.
        // Record healing, update value, keep accumulated confidence.
        return this.update(type, key, value, source, "value_updated");
      }
    }

    // New fact — create with initial confidence
    const initialConfidence = options?.initialConfidence ?? Conviction.HYPOTHESIS;
    const scope = options?.scope ?? "vendor";

    const fact: KnowledgeFact<T> = {
      id,
      type,
      key,
      value,
      confidence: initialConfidence,
      confirmations: 1,
      contradictions: 0,
      lastConfirmedAt: now,
      scope,
      vendorOrigin: source.vendor,
      vendors: [source.vendor],
      clinicCount: 1,
      createdAt: now,
      updatedAt: now,
    };

    file.facts[id] = fact;
    file.updatedAt = now;
    this.dirty.add(type);

    return fact;
  }

  /**
   * Confirm an existing fact — boost confidence.
   */
  async confirm<T = unknown>(
    type: KnowledgeType,
    key: string,
    source: ConfirmationSource
  ): Promise<KnowledgeFact<T>> {
    const file = await this.loadFile(type);
    const id = factId(type, key);
    const fact = file.facts[id] as KnowledgeFact<T>;
    if (!fact) throw new Error(`Cannot confirm non-existent fact: ${type}:${key}`);

    const now = new Date().toISOString();
    fact.confirmations++;
    fact.confidence = Math.min(1.0, fact.confidence + CONFIRMATION_BOOST);
    fact.lastConfirmedAt = now;
    fact.updatedAt = now;

    // Track vendor diversity
    if (!fact.vendors.includes(source.vendor)) {
      fact.vendors.push(source.vendor);
      // Auto-elevate to cross-vendor if confirmed by multiple vendors
      if (fact.vendors.length >= CROSS_VENDOR_MIN) {
        fact.scope = "cross-vendor";
        // Cross-vendor confirmation is a stronger signal
        fact.confidence = Math.min(1.0, fact.confidence + CONFIRMATION_BOOST);
      }
    }

    // Track clinic diversity (approximate via source)
    // clinicCount is incremented per unique clinic, but we don't store all clinic IDs
    // to keep the knowledge file lean. A confirmation from a different run implies
    // potential different clinic.
    if (source.clinicId) {
      fact.clinicCount = Math.max(fact.clinicCount, fact.vendors.length);
    }

    file.updatedAt = now;
    this.dirty.add(type);

    return fact;
  }

  /**
   * Contradict a fact — reduce confidence, record healing entry.
   * The fact is NOT deleted. The agent remembers what went wrong.
   */
  async contradict<T = unknown>(
    type: KnowledgeType,
    key: string,
    source: ContradictionSource
  ): Promise<KnowledgeFact<T> | null> {
    const file = await this.loadFile(type);
    const id = factId(type, key);
    const fact = file.facts[id] as KnowledgeFact<T>;
    if (!fact) return null;

    const now = new Date().toISOString();
    fact.contradictions++;
    fact.confidence = Math.max(0, fact.confidence - CONTRADICTION_PENALTY);
    fact.lastContradictedAt = now;
    fact.updatedAt = now;

    // Record healing entry — the agent's memory of being wrong
    const healing: HealingEntry = {
      timestamp: now,
      runId: source.runId,
      vendor: source.vendor,
      trigger: "contradiction",
      description: source.error,
      action: fact.confidence < DISPUTED_THRESHOLD ? "fact_deprecated" : "confidence_reduced",
    };
    fact.healingLog = [...(fact.healingLog || []).slice(-(MAX_HEALING_LOG - 1)), healing];

    file.updatedAt = now;
    this.dirty.add(type);

    return fact;
  }

  /**
   * Update a fact's value — when the correct answer changes.
   * Preserves history via healing log.
   */
  private async update<T>(
    type: KnowledgeType,
    key: string,
    newValue: T,
    source: ConfirmationSource,
    action: HealingEntry["action"]
  ): Promise<KnowledgeFact<T>> {
    const file = await this.loadFile(type);
    const id = factId(type, key);
    const fact = file.facts[id] as KnowledgeFact<T>;
    const now = new Date().toISOString();

    const healing: HealingEntry = {
      timestamp: now,
      runId: source.runId,
      vendor: source.vendor,
      trigger: "user_correction",
      description: `Value updated from ${JSON.stringify(fact.value)} to ${JSON.stringify(newValue)}`,
      action,
      previousValue: fact.value,
      newValue,
    };

    fact.value = newValue;
    fact.confirmations++;
    fact.lastConfirmedAt = now;
    fact.updatedAt = now;
    fact.healingLog = [...(fact.healingLog || []).slice(-(MAX_HEALING_LOG - 1)), healing];

    if (!fact.vendors.includes(source.vendor)) {
      fact.vendors.push(source.vendor);
      if (fact.vendors.length >= CROSS_VENDOR_MIN) {
        fact.scope = "cross-vendor";
      }
    }

    file.updatedAt = now;
    this.dirty.add(type);

    return fact;
  }

  /**
   * Record a user correction — highest-confidence learning signal.
   * Creates or updates a fact with elevated initial confidence.
   */
  async recordUserCorrection<T>(
    type: KnowledgeType,
    key: string,
    value: T,
    source: ConfirmationSource & { previousValue?: unknown }
  ): Promise<KnowledgeFact<T>> {
    const file = await this.loadFile(type);
    const id = factId(type, key);
    const existing = file.facts[id] as KnowledgeFact<T> | undefined;
    const now = new Date().toISOString();

    if (existing) {
      // User is correcting an existing fact — record what was wrong
      const healing: HealingEntry = {
        timestamp: now,
        runId: source.runId,
        vendor: source.vendor,
        trigger: "user_correction",
        description: `User corrected: ${JSON.stringify(existing.value)} → ${JSON.stringify(value)}`,
        action: "value_updated",
        previousValue: existing.value,
        newValue: value,
      };

      existing.value = value;
      existing.confidence = Math.max(existing.confidence, Conviction.CANONICAL);
      existing.confirmations++;
      existing.lastConfirmedAt = now;
      existing.updatedAt = now;
      existing.healingLog = [
        ...(existing.healingLog || []).slice(-(MAX_HEALING_LOG - 1)),
        healing,
      ];

      file.updatedAt = now;
      this.dirty.add(type);
      return existing;
    }

    // New fact from user — starts at CANONICAL confidence
    return this.record(type, key, value, source, {
      initialConfidence: Conviction.CANONICAL,
    });
  }

  /**
   * Record an error pattern — the agent learns what goes wrong and how to fix it.
   */
  async recordError(
    key: string,
    value: import("./types").ErrorPatternValue,
    source: ConfirmationSource
  ): Promise<KnowledgeFact<import("./types").ErrorPatternValue>> {
    return this.record("error_pattern", key, value, source, {
      scope: value.autoHealed ? "cross-vendor" : "vendor",
      initialConfidence: value.autoHealed ? Conviction.EMERGING : Conviction.HYPOTHESIS,
    });
  }

  // -------------------------------------------------------------------------
  // Metrics & observability
  // -------------------------------------------------------------------------

  /**
   * Get intelligence metrics — how smart is the agent right now?
   */
  async getMetrics(): Promise<KnowledgeMetrics> {
    const types = Object.keys(FILE_MAP) as KnowledgeType[];
    let totalFacts = 0;
    let totalConfidence = 0;
    let disputedFacts = 0;
    let crossVendorFacts = 0;
    let totalHealingEvents = 0;
    let autoHealedCount = 0;
    const byType: Record<string, number> = {};
    const byVendor: Record<string, number> = {};

    for (const type of types) {
      const file = await this.loadFile(type);
      const facts = Object.values(file.facts);
      byType[type] = facts.length;
      totalFacts += facts.length;

      for (const fact of facts) {
        const conf = this.decayedConfidence(fact);
        totalConfidence += conf;
        if (conf < DISPUTED_THRESHOLD) disputedFacts++;
        if (fact.scope === "cross-vendor") crossVendorFacts++;
        totalHealingEvents += fact.healingLog?.length ?? 0;

        for (const vendor of fact.vendors) {
          byVendor[vendor] = (byVendor[vendor] || 0) + 1;
        }
      }
    }

    // Count auto-healed error patterns
    const errorFile = await this.loadFile("error_pattern");
    for (const fact of Object.values(errorFile.facts)) {
      const ep = fact.value as import("./types").ErrorPatternValue;
      if (ep.autoHealed) autoHealedCount++;
    }

    return {
      totalFacts,
      byType: byType as Record<KnowledgeType, number>,
      byVendor,
      avgConfidence: totalFacts > 0 ? totalConfidence / totalFacts : 0,
      disputedFacts,
      crossVendorFacts,
      totalHealingEvents,
      autoHealedCount,
    };
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  /**
   * Flush all dirty files to disk.
   * Call this after a batch of operations (e.g., post-distillation).
   */
  async flush(): Promise<void> {
    for (const type of this.dirty) {
      const file = this.cache.get(type);
      if (file) {
        await ensureDir(KNOWLEDGE_DIR);
        await writeJSON(join(KNOWLEDGE_DIR, FILE_MAP[type]), file);
      }
    }
    this.dirty.clear();
  }

  /**
   * Clear the in-memory cache (for testing or after long pauses).
   */
  clearCache(): void {
    this.cache.clear();
    this.dirty.clear();
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private async loadFile(type: KnowledgeType): Promise<KnowledgeFile> {
    if (this.cache.has(type)) return this.cache.get(type)!;

    const path = join(KNOWLEDGE_DIR, FILE_MAP[type]);
    const data = await readJSON<KnowledgeFile>(path);

    const file: KnowledgeFile = data ?? {
      version: 1,
      facts: {},
      updatedAt: new Date().toISOString(),
    };

    this.cache.set(type, file);
    return file;
  }

  /**
   * Apply confidence decay based on staleness.
   * Facts not confirmed in DECAY_GRACE_DAYS start losing confidence.
   */
  private decayedConfidence(fact: KnowledgeFact): number {
    const lastConfirmed = new Date(fact.lastConfirmedAt).getTime();
    const daysSinceConfirmed = (Date.now() - lastConfirmed) / (1000 * 60 * 60 * 24);

    if (daysSinceConfirmed <= DECAY_GRACE_DAYS) return fact.confidence;

    const decayPeriods = Math.floor(
      (daysSinceConfirmed - DECAY_GRACE_DAYS) / 30
    );
    return Math.max(0, fact.confidence - decayPeriods * DECAY_RATE);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a deterministic fact ID from type + key */
function factId(type: KnowledgeType, key: string): string {
  const hash = createHash("sha256")
    .update(`${type}:${key}`)
    .digest("hex")
    .slice(0, 12);
  return `${type.slice(0, 2)}_${hash}`;
}

/** Deep equality check for fact values (JSON-level) */
function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
