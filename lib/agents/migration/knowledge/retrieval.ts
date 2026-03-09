// Knowledge Retrieval — Context-aware knowledge injection for AI prompts
//
// This module is the bridge between the knowledge store and the AI calls.
// Instead of raw memory dumps, it builds targeted context strings that
// tell the AI what the agent already knows, what it's unsure about,
// and what it should focus on.
//
// The key insight: AI calls should only work on genuinely unknown problems.
// Everything else should come from accumulated knowledge.

import type { KnowledgeStore } from "./store";
import type {
  KnowledgeFact,
  MappingPatternValue,
  FormArchetypeValue,
  FieldSemanticValue,
  ErrorPatternValue,
  KnowledgeMetrics,
} from "./types";
import { DETERMINISTIC_THRESHOLD, HINT_THRESHOLD, Conviction } from "./types";

// ---------------------------------------------------------------------------
// Mapping knowledge retrieval
// ---------------------------------------------------------------------------

export interface MappingKnowledge {
  /** Fields the agent is confident about — can be used deterministically */
  knownMappings: MappingPatternValue[];
  /** Fields the agent has seen but isn't sure about — hints for AI */
  hintMappings: MappingPatternValue[];
  /** Error patterns to avoid */
  errorPatterns: ErrorPatternValue[];
  /** Coverage ratio: knownMappings / (knownMappings + unknowns) */
  coverage: number;
  /** Prompt context string for AI injection */
  promptContext: string;
}

/**
 * Retrieve mapping knowledge for a vendor.
 * Used by draft-mapping phase to build deterministic + AI-assisted mapping.
 *
 * @param sourceFields - field names from the source profile (to measure coverage)
 */
export async function getMappingKnowledge(
  store: KnowledgeStore,
  vendor: string,
  sourceFields?: string[]
): Promise<MappingKnowledge> {
  // Get vendor-specific + cross-vendor mapping facts
  const allFacts = await store.query<MappingPatternValue>({
    type: "mapping_pattern",
    vendor,
    excludeDisputed: true,
  });

  const known: MappingPatternValue[] = [];
  const hints: MappingPatternValue[] = [];

  for (const fact of allFacts) {
    if (fact.confidence >= DETERMINISTIC_THRESHOLD) {
      known.push(fact.value);
    } else if (fact.confidence >= HINT_THRESHOLD) {
      hints.push(fact.value);
    }
  }

  // Get error patterns to inject as warnings
  const errors = await store.query<ErrorPatternValue>({
    type: "error_pattern",
    vendor,
    minConfidence: HINT_THRESHOLD,
    excludeDisputed: true,
  });
  const errorPatterns = errors.map((f) => f.value);

  // Calculate coverage if source fields provided
  const coverage = sourceFields
    ? known.filter((m) =>
        sourceFields.some((sf) => sf === m.sourceField)
      ).length / Math.max(1, sourceFields.length)
    : 0;

  // Build prompt context
  const promptContext = buildMappingPromptContext(known, hints, errorPatterns, coverage);

  return { knownMappings: known, hintMappings: hints, errorPatterns, coverage, promptContext };
}

function buildMappingPromptContext(
  known: MappingPatternValue[],
  hints: MappingPatternValue[],
  errors: ErrorPatternValue[],
  coverage: number
): string {
  const parts: string[] = [];

  if (known.length > 0) {
    parts.push(`## Confirmed Mappings (${known.length} fields, ${Math.round(coverage * 100)}% coverage)`);
    parts.push("These mappings are confirmed from previous successful migrations. Use them as-is:");
    for (const m of known) {
      const transform = m.transform ? ` [${m.transform}]` : "";
      parts.push(`  ${m.sourceEntity}.${m.sourceField} → ${m.targetEntity}.${m.targetField}${transform}`);
    }
  }

  if (hints.length > 0) {
    parts.push(`\n## Probable Mappings (${hints.length} fields — verify these)`);
    parts.push("These were seen before but are not fully confirmed. Use as starting points:");
    for (const m of hints) {
      const transform = m.transform ? ` [${m.transform}]` : "";
      parts.push(`  ${m.sourceEntity}.${m.sourceField} → ${m.targetEntity}.${m.targetField}${transform} (unconfirmed)`);
    }
  }

  if (errors.length > 0) {
    parts.push(`\n## Known Pitfalls (avoid these)`);
    for (const e of errors) {
      parts.push(`  - ${e.rootCause}: ${e.fix}`);
    }
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Classification knowledge retrieval
// ---------------------------------------------------------------------------

export interface ClassificationKnowledge {
  /** Templates the agent knows how to classify — skip AI for these */
  knownArchetypes: Map<string, FormArchetypeValue>;
  /** Templates the agent has seen but isn't sure about */
  hintArchetypes: Map<string, FormArchetypeValue>;
  /** Prompt context for unknown templates */
  promptContext: string;
}

/**
 * Retrieve form classification knowledge.
 * Used by classifyForms() to short-circuit known templates.
 */
export async function getClassificationKnowledge(
  store: KnowledgeStore,
  vendor: string
): Promise<ClassificationKnowledge> {
  const allFacts = await store.query<FormArchetypeValue>({
    type: "form_archetype",
    vendor, // includes cross-vendor facts
    excludeDisputed: true,
  });

  const known = new Map<string, FormArchetypeValue>();
  const hints = new Map<string, FormArchetypeValue>();

  for (const fact of allFacts) {
    if (fact.confidence >= DETERMINISTIC_THRESHOLD) {
      known.set(fact.value.namePattern, fact.value);
    } else if (fact.confidence >= HINT_THRESHOLD) {
      hints.set(fact.value.namePattern, fact.value);
    }
  }

  const promptContext = buildClassificationPromptContext(known, hints);

  return { knownArchetypes: known, hintArchetypes: hints, promptContext };
}

function buildClassificationPromptContext(
  known: Map<string, FormArchetypeValue>,
  hints: Map<string, FormArchetypeValue>
): string {
  if (known.size === 0 && hints.size === 0) return "";

  const parts: string[] = [];

  if (known.size > 0) {
    parts.push("## Known Form Types (from previous migrations)");
    for (const [, arch] of known) {
      parts.push(`  "${arch.namePattern}" → ${arch.classification}`);
    }
  }

  if (hints.size > 0) {
    parts.push("\n## Probable Form Types (verify these)");
    for (const [, arch] of hints) {
      parts.push(`  "${arch.namePattern}" → ${arch.classification} (unconfirmed)`);
    }
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Field semantic knowledge retrieval
// ---------------------------------------------------------------------------

export interface FieldSemanticKnowledge {
  /** Fields the agent knows — skip AI for these */
  knownFields: Map<string, FieldSemanticValue>;
  /** Fields the agent has hints about */
  hintFields: Map<string, FieldSemanticValue>;
  /** How many fields can be resolved from knowledge */
  knownCount: number;
  /** Prompt context for unknown fields */
  promptContext: string;
}

/**
 * Retrieve field semantic knowledge.
 * Used by analyzeFields() to short-circuit known field patterns.
 *
 * @param fieldLabels - the actual field labels to match against
 */
export async function getFieldSemanticKnowledge(
  store: KnowledgeStore,
  vendor: string,
  fieldLabels?: Array<{ label: string; sourceType: string }>
): Promise<FieldSemanticKnowledge> {
  const allFacts = await store.query<FieldSemanticValue>({
    type: "field_semantic",
    vendor, // includes cross-vendor
    excludeDisputed: true,
  });

  const known = new Map<string, FieldSemanticValue>();
  const hints = new Map<string, FieldSemanticValue>();

  for (const fact of allFacts) {
    const lookupKey = `${fact.value.labelPattern}|${fact.value.sourceType || "any"}`;
    if (fact.confidence >= DETERMINISTIC_THRESHOLD) {
      known.set(lookupKey, fact.value);
    } else if (fact.confidence >= HINT_THRESHOLD) {
      hints.set(lookupKey, fact.value);
    }
  }

  // Count how many of the requested fields are known
  let knownCount = 0;
  if (fieldLabels) {
    for (const { label, sourceType } of fieldLabels) {
      const normalizedLabel = label.toLowerCase().trim();
      const exactKey = `${normalizedLabel}|${sourceType}`;
      const anyKey = `${normalizedLabel}|any`;
      if (known.has(exactKey) || known.has(anyKey)) {
        knownCount++;
      }
    }
  }

  const promptContext = buildFieldPromptContext(known, hints);

  return { knownFields: known, hintFields: hints, knownCount, promptContext };
}

/**
 * Look up a specific field's semantic meaning from knowledge.
 * Returns the value if confidence is high enough, null otherwise.
 */
export function lookupFieldSemantic(
  knowledge: FieldSemanticKnowledge,
  label: string,
  sourceType: string
): FieldSemanticValue | null {
  const normalized = label.toLowerCase().trim();
  // Try exact match first, then any-type match
  return (
    knowledge.knownFields.get(`${normalized}|${sourceType}`) ??
    knowledge.knownFields.get(`${normalized}|any`) ??
    null
  );
}

/**
 * Look up a specific form template's classification from knowledge.
 * Returns the archetype if confidence is high enough, null otherwise.
 */
export function lookupFormArchetype(
  knowledge: ClassificationKnowledge,
  templateName: string
): FormArchetypeValue | null {
  const normalized = templateName.toLowerCase().trim();
  return knowledge.knownArchetypes.get(normalized) ?? null;
}

function buildFieldPromptContext(
  known: Map<string, FieldSemanticValue>,
  hints: Map<string, FieldSemanticValue>
): string {
  if (known.size === 0 && hints.size === 0) return "";

  const parts: string[] = [];

  if (known.size > 0) {
    parts.push("## Known Field Semantics (from previous migrations)");
    for (const [, field] of Array.from(known.entries()).slice(0, 30)) {
      const detail = field.patientField
        ? `${field.category}.${field.patientField}`
        : field.templateKey
          ? `${field.category} (key: ${field.templateKey})`
          : field.category;
      parts.push(`  "${field.labelPattern}" → ${detail}`);
    }
    if (known.size > 30) {
      parts.push(`  ... and ${known.size - 30} more`);
    }
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Run-start intelligence summary
// ---------------------------------------------------------------------------

/**
 * Build a summary of the agent's intelligence state for logging.
 * Called at the start of each migration run.
 */
export async function getIntelligenceSummary(
  store: KnowledgeStore,
  vendor: string
): Promise<string> {
  const metrics = await store.getMetrics();
  const vendorFacts = metrics.byVendor[vendor] || 0;

  const parts = [
    `[knowledge] Agent intelligence: ${metrics.totalFacts} facts total, ${vendorFacts} for ${vendor}`,
    `  Confidence avg: ${(metrics.avgConfidence * 100).toFixed(0)}%`,
    `  Cross-vendor: ${metrics.crossVendorFacts} facts`,
    `  Self-healed: ${metrics.autoHealedCount} errors`,
  ];

  if (metrics.disputedFacts > 0) {
    parts.push(`  Disputed: ${metrics.disputedFacts} facts (below threshold)`);
  }

  // Per-type breakdown
  for (const [type, count] of Object.entries(metrics.byType)) {
    if (count > 0) parts.push(`  ${type}: ${count}`);
  }

  return parts.join("\n");
}
