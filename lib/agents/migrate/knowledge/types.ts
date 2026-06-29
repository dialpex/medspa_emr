// Knowledge Store — Core Types
//
// The Migration Agent's intelligence system. Every fact the agent learns
// is typed, scored, and traceable. The agent is opinionated: it forms
// convictions from experience and defends them until contradicted.
//
// Design principles:
// - Pragmatic: learn high-signal knowledge, ignore noise
// - Opinionated: strong defaults that grow from experience
// - Self-healing: errors are learning signals, not just failures
// - Transferable: cross-vendor patterns accelerate new vendor onboarding

// ---------------------------------------------------------------------------
// Knowledge Types — the 5 kinds of things the agent can learn
// ---------------------------------------------------------------------------

export type KnowledgeType =
  | "mapping_pattern"    // field A in source → field B in target (with transform)
  | "form_archetype"     // template name pattern → classification
  | "field_semantic"     // field label + type → category + patient field
  | "api_quirk"          // vendor-specific API behavior
  | "error_pattern";     // recurring error → known fix

// ---------------------------------------------------------------------------
// The Knowledge Fact — atomic unit of agent intelligence
// ---------------------------------------------------------------------------

export interface KnowledgeFact<T = unknown> {
  id: string;                          // deterministic hash of type + key
  type: KnowledgeType;
  key: string;                         // unique within type
  value: T;                            // type-specific payload

  // Confidence model — the agent's conviction in this fact
  confidence: number;                  // 0.0–1.0
  confirmations: number;               // total times confirmed
  contradictions: number;              // total times contradicted
  lastConfirmedAt: string;
  lastContradictedAt?: string;

  // Provenance — where this knowledge came from
  scope: "vendor" | "cross-vendor";    // does this transfer?
  vendorOrigin: string;                // first vendor that produced it
  vendors: string[];                   // all vendors that confirmed it
  clinicCount: number;                 // distinct clinics that confirmed it

  // Lifecycle
  createdAt: string;
  updatedAt: string;

  // Self-healing: track when this fact was wrong and what we learned
  healingLog?: HealingEntry[];
}

// ---------------------------------------------------------------------------
// Type-specific value payloads
// ---------------------------------------------------------------------------

/** A learned field mapping: source field → target field with optional transform */
export interface MappingPatternValue {
  sourceEntity: string;                // e.g., "patients", "photos"
  sourceField: string;                 // e.g., "email", "url"
  targetEntity: string;                // e.g., "patient", "photo"
  targetField: string;                 // e.g., "email", "downloadUrl"
  transform?: string;                  // e.g., "normalizeEmail", "parseDate"
  transferable: boolean;               // safe to apply to other vendors?
}

/** A learned form template → classification mapping */
export interface FormArchetypeValue {
  /** Normalized pattern (lowercase, trimmed) */
  namePattern: string;                 // e.g., "hipaa authorization"
  /** Regex pattern for flexible matching */
  matchRegex?: string;                 // e.g., "hipaa|health\\s*insurance"
  classification: "consent" | "clinical_chart" | "intake" | "skip";
  reasoning: string;
  /** Field indicators that strengthen this classification */
  fieldIndicators?: string[];          // e.g., ["injection_site", "units", "dosage"]
}

/** A learned field label → semantic meaning */
export interface FieldSemanticValue {
  /** Normalized label (lowercase) */
  labelPattern: string;                // e.g., "first name"
  sourceType?: string;                 // e.g., "connected_text"
  category: "patient_demographic" | "patient_medical" | "clinical_content" | "administrative";
  patientField?: string;               // e.g., "firstName"
  templateKey?: string;                // e.g., "treatment_notes"
  fieldType?: string;                  // inferred Neuvvia field type
}

/** A vendor-specific API behavior the agent has observed */
export interface ApiQuirkValue {
  vendor: string;
  area: string;                        // e.g., "orders", "services", "pagination"
  description: string;
  /** The wrong assumption and the correct behavior */
  wrongAssumption?: string;
  correctBehavior: string;
  /** GraphQL-specific: field name corrections */
  fieldCorrections?: Array<{ wrong: string; correct: string; type?: string }>;
}

/** A recurring error and the agent's learned fix */
export interface ErrorPatternValue {
  /** Error signature — what makes this error recognizable */
  errorSignature: string;              // e.g., "V006:photo:canonicalPatientId"
  errorCode?: string;
  entityType?: string;
  /** What the agent learned to do about it */
  rootCause: string;
  fix: string;
  /** Which layer(s) the fix belongs to (per 5-layer principle) */
  fixLayers: FixLayer[];
  /** Was this fix applied automatically (self-healing) or manually? */
  autoHealed: boolean;
}

export type FixLayer =
  | "ai_prompts"
  | "vendor_knowledge"
  | "heuristic_fallback"
  | "structural_code"
  | "cross_run_memory";

// ---------------------------------------------------------------------------
// Self-Healing — the agent's record of learning from mistakes
// ---------------------------------------------------------------------------

export interface HealingEntry {
  timestamp: string;
  runId: string;
  vendor: string;
  trigger: "contradiction" | "error" | "user_correction" | "quality_signal";
  description: string;
  /** What the agent did to recover */
  action: "confidence_reduced" | "value_updated" | "fact_deprecated" | "new_fact_created";
  previousValue?: unknown;
  newValue?: unknown;
}

// ---------------------------------------------------------------------------
// Confirmation & Contradiction records
// ---------------------------------------------------------------------------

export interface ConfirmationSource {
  runId: string;
  vendor: string;
  clinicId: string;
  phase: string;                       // which pipeline phase confirmed
  timestamp: string;
}

export interface ContradictionSource {
  runId: string;
  vendor: string;
  clinicId: string;
  error: string;
  correctedTo?: unknown;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Confidence levels — the agent's conviction scale
// ---------------------------------------------------------------------------

export enum Conviction {
  /** Never seen, no signal — always call AI */
  UNKNOWN = 0,
  /** Seen once, unconfirmed — call AI, use as hint */
  HYPOTHESIS = 0.5,
  /** Confirmed 1-2 times — use deterministically, flag for review */
  EMERGING = 0.7,
  /** Confirmed 3+ times — use deterministically */
  CONFIDENT = 0.85,
  /** Confirmed across vendors or by user — ground truth */
  CANONICAL = 0.95,
}

/** Minimum confidence to use a fact without AI verification */
export const DETERMINISTIC_THRESHOLD = Conviction.EMERGING;

/** Minimum confidence to use a fact as an AI prompt hint */
export const HINT_THRESHOLD = Conviction.HYPOTHESIS;

/** Confidence below which a fact is considered disputed */
export const DISPUTED_THRESHOLD = 0.4;

/** Days before unused facts start decaying */
export const DECAY_GRACE_DAYS = 90;

/** Confidence decay per 30 days past grace period */
export const DECAY_RATE = 0.05;

// ---------------------------------------------------------------------------
// Knowledge queries — how callers ask for knowledge
// ---------------------------------------------------------------------------

export interface KnowledgeQuery {
  type: KnowledgeType;
  vendor?: string;                     // filter by vendor, or cross-vendor if omitted
  minConfidence?: number;
  key?: string;                        // exact key match
  keyPattern?: string;                 // substring match on key
  excludeDisputed?: boolean;           // skip facts below DISPUTED_THRESHOLD
  limit?: number;
}

// ---------------------------------------------------------------------------
// Knowledge metrics — observability into the agent's intelligence
// ---------------------------------------------------------------------------

export interface KnowledgeMetrics {
  totalFacts: number;
  byType: Record<KnowledgeType, number>;
  byVendor: Record<string, number>;
  avgConfidence: number;
  disputedFacts: number;
  /** How many facts have been confirmed across multiple vendors */
  crossVendorFacts: number;
  /** Self-healing stats */
  totalHealingEvents: number;
  autoHealedCount: number;
}

// ---------------------------------------------------------------------------
// Knowledge file format — what gets persisted to disk
// ---------------------------------------------------------------------------

export interface KnowledgeFile<T = unknown> {
  version: 1;
  facts: Record<string, KnowledgeFact<T>>;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Run outcome — what the distiller receives after reconcile
// ---------------------------------------------------------------------------

export interface RunOutcome {
  runId: string;
  vendor: string;
  clinicId: string;
  /** Approved mapping spec (may differ from draft if user corrected) */
  approvedMappingSpec: unknown;
  /** Draft mapping spec (original AI output) */
  draftMappingSpec?: unknown;
  /** Classification decisions made during this run */
  classifications?: Array<{
    formSourceId: string;
    templateName: string;
    templateId?: string;
    classification: string;
    confidence: number;
    source: "ai" | "knowledge" | "heuristic";
  }>;
  /** Field analysis decisions made during this run */
  fieldAnalyses?: Array<{
    templateName: string;
    templateId: string;
    fields: Array<{
      fieldId: string;
      label: string;
      sourceType: string;
      fieldType: string;
      category: string;
      patientField?: string;
      templateKey?: string;
      source: "ai" | "knowledge" | "heuristic";
    }>;
  }>;
  /** Reconciliation results — the quality signal */
  reconciliation: {
    entityMatchRates: Record<string, number>;
    totalSource: number;
    totalPromoted: number;
    totalFailed: number;
  };
  /** Errors encountered during this run */
  errors: Array<{
    phase: string;
    entityType?: string;
    errorCode?: string;
    message: string;
    count: number;
    sampleIds?: string[];
  }>;
  /** User corrections (diff between draft and approved mapping) */
  userCorrections?: Array<{
    entityType: string;
    sourceField: string;
    aiProposal: string;
    userChoice: string;
  }>;
}
