// Knowledge Distiller — Post-reconcile intelligence extraction
//
// After every migration run, the distiller examines what happened and
// extracts reusable knowledge. This is how the agent gets smarter:
//
// 1. Successful mappings become confirmed mapping patterns
// 2. Form classifications become form archetypes
// 3. Field analyses become field semantic facts
// 4. Errors become error patterns with known fixes
// 5. User corrections become high-confidence corrections
//
// The distiller is pragmatic — it doesn't store noise. A mapping
// that produced a 100% match rate is a strong signal. A mapping that
// needed correction is a weaker signal (but the correction itself is strong).

import type { KnowledgeStore } from "./store";
import type {
  RunOutcome,
  MappingPatternValue,
  FormArchetypeValue,
  FieldSemanticValue,
  ErrorPatternValue,
  ConfirmationSource,
  FixLayer,
} from "./types";

export interface DistillationReport {
  factsCreated: number;
  factsConfirmed: number;
  factsContradicted: number;
  errorsLearned: number;
  userCorrectionsRecorded: number;
}

/**
 * Distill knowledge from a completed migration run.
 *
 * Called by the orchestrator after the reconcile phase succeeds.
 * Examines the run outcome and extracts reusable intelligence.
 */
export async function distill(
  store: KnowledgeStore,
  outcome: RunOutcome
): Promise<DistillationReport> {
  const report: DistillationReport = {
    factsCreated: 0,
    factsConfirmed: 0,
    factsContradicted: 0,
    errorsLearned: 0,
    userCorrectionsRecorded: 0,
  };

  const source: ConfirmationSource = {
    runId: outcome.runId,
    vendor: outcome.vendor,
    clinicId: outcome.clinicId,
    phase: "reconcile",
    timestamp: new Date().toISOString(),
  };

  // -----------------------------------------------------------------------
  // 1. Mapping patterns — extract from approved mapping spec
  // -----------------------------------------------------------------------
  await distillMappingPatterns(store, outcome, source, report);

  // -----------------------------------------------------------------------
  // 2. Form archetypes — extract from classification decisions
  // -----------------------------------------------------------------------
  await distillFormArchetypes(store, outcome, source, report);

  // -----------------------------------------------------------------------
  // 3. Field semantics — extract from field analysis decisions
  // -----------------------------------------------------------------------
  await distillFieldSemantics(store, outcome, source, report);

  // -----------------------------------------------------------------------
  // 4. Error patterns — learn from failures
  // -----------------------------------------------------------------------
  await distillErrorPatterns(store, outcome, source, report);

  // -----------------------------------------------------------------------
  // 5. User corrections — the highest-confidence signal
  // -----------------------------------------------------------------------
  await distillUserCorrections(store, outcome, source, report);

  // Persist all accumulated knowledge
  await store.flush();

  const total =
    report.factsCreated +
    report.factsConfirmed +
    report.factsContradicted +
    report.errorsLearned +
    report.userCorrectionsRecorded;

  if (total > 0) {
    console.log(
      `[knowledge] Distilled run ${outcome.runId}: ` +
        `${report.factsCreated} new, ${report.factsConfirmed} confirmed, ` +
        `${report.factsContradicted} contradicted, ${report.errorsLearned} errors learned, ` +
        `${report.userCorrectionsRecorded} user corrections`
    );
  }

  return report;
}

// ---------------------------------------------------------------------------
// Distillation extractors
// ---------------------------------------------------------------------------

async function distillMappingPatterns(
  store: KnowledgeStore,
  outcome: RunOutcome,
  source: ConfirmationSource,
  report: DistillationReport
): Promise<void> {
  const spec = outcome.approvedMappingSpec as {
    sourceVendor?: string;
    entityMappings?: Array<{
      sourceEntity: string;
      targetEntity: string;
      fieldMappings: Array<{
        sourceField: string;
        targetField: string;
        transform?: string;
      }>;
    }>;
  } | null;

  if (!spec?.entityMappings) return;

  // Check overall quality — only learn from successful runs
  const overallMatchRate = outcome.reconciliation.totalPromoted > 0
    ? outcome.reconciliation.totalPromoted /
      (outcome.reconciliation.totalPromoted + outcome.reconciliation.totalFailed)
    : 0;

  // Don't learn from runs with > 20% failure — something systemic was wrong
  if (overallMatchRate < 0.8) return;

  // Fields that are inherently transferable across vendors
  const TRANSFERABLE_FIELDS = new Set([
    "email", "phone", "firstName", "lastName", "fullName",
    "dateOfBirth", "gender", "address", "city", "state", "zip",
    "allergies", "medicalNotes", "notes", "description",
    "name", "category", "status", "total", "taxAmount",
    "downloadUrl", "fileName", "mimeType",
  ]);

  for (const entity of spec.entityMappings) {
    for (const field of entity.fieldMappings) {
      const key = `${outcome.vendor}:${entity.sourceEntity}.${field.sourceField}->${entity.targetEntity}.${field.targetField}`;
      const transferable = TRANSFERABLE_FIELDS.has(field.targetField);

      const value: MappingPatternValue = {
        sourceEntity: entity.sourceEntity,
        sourceField: field.sourceField,
        targetEntity: entity.targetEntity,
        targetField: field.targetField,
        transform: field.transform,
        transferable,
      };

      const existing = await store.get("mapping_pattern", key);
      await store.record("mapping_pattern", key, value, source, {
        scope: transferable ? "cross-vendor" : "vendor",
      });

      if (existing) {
        report.factsConfirmed++;
      } else {
        report.factsCreated++;
      }
    }
  }
}

async function distillFormArchetypes(
  store: KnowledgeStore,
  outcome: RunOutcome,
  source: ConfirmationSource,
  report: DistillationReport
): Promise<void> {
  if (!outcome.classifications) return;

  // Deduplicate by templateName — we learn archetypes, not individual form IDs
  const seen = new Set<string>();

  for (const cls of outcome.classifications) {
    const normalized = cls.templateName.toLowerCase().trim();
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    // Only learn from AI or knowledge-confirmed classifications
    // (heuristic-only classifications are already baked into code)
    if (cls.source === "heuristic" && cls.confidence < 0.9) continue;

    const key = `${normalized}`;
    const value: FormArchetypeValue = {
      namePattern: normalized,
      classification: cls.classification as FormArchetypeValue["classification"],
      reasoning: `Learned from ${outcome.vendor} migration (${cls.source}, confidence ${cls.confidence})`,
    };

    const existing = await store.get("form_archetype", key);
    await store.record("form_archetype", key, value, source, {
      // Form archetypes are inherently cross-vendor:
      // "HIPAA Authorization" is consent regardless of vendor
      scope: "cross-vendor",
    });

    if (existing) {
      report.factsConfirmed++;
    } else {
      report.factsCreated++;
    }
  }
}

async function distillFieldSemantics(
  store: KnowledgeStore,
  outcome: RunOutcome,
  source: ConfirmationSource,
  report: DistillationReport
): Promise<void> {
  if (!outcome.fieldAnalyses) return;

  for (const template of outcome.fieldAnalyses) {
    for (const field of template.fields) {
      // Only learn from AI decisions (heuristic is already in code)
      if (field.source === "heuristic") continue;

      const normalizedLabel = field.label.toLowerCase().trim();
      const key = `${normalizedLabel}|${field.sourceType || "any"}`;

      const value: FieldSemanticValue = {
        labelPattern: normalizedLabel,
        sourceType: field.sourceType,
        category: field.category as FieldSemanticValue["category"],
        patientField: field.patientField,
        templateKey: field.templateKey,
        fieldType: field.fieldType,
      };

      const existing = await store.get("field_semantic", key);
      await store.record("field_semantic", key, value, source, {
        // Field semantics transfer: "First Name" is always patient_demographic
        scope: "cross-vendor",
      });

      if (existing) {
        report.factsConfirmed++;
      } else {
        report.factsCreated++;
      }
    }
  }
}

async function distillErrorPatterns(
  store: KnowledgeStore,
  outcome: RunOutcome,
  source: ConfirmationSource,
  report: DistillationReport
): Promise<void> {
  if (!outcome.errors || outcome.errors.length === 0) return;

  for (const error of outcome.errors) {
    // Only learn from errors that occurred multiple times (pattern, not noise)
    if (error.count < 2) continue;

    const key = `${error.phase}:${error.entityType || "any"}:${error.errorCode || error.message.slice(0, 50)}`;

    const value: ErrorPatternValue = {
      errorSignature: key,
      errorCode: error.errorCode,
      entityType: error.entityType,
      rootCause: error.message,
      fix: `Occurred ${error.count} times in ${error.phase} phase`,
      fixLayers: inferFixLayers(error),
      autoHealed: false,
    };

    await store.recordError(key, value, source);
    report.errorsLearned++;
  }
}

async function distillUserCorrections(
  store: KnowledgeStore,
  outcome: RunOutcome,
  source: ConfirmationSource,
  report: DistillationReport
): Promise<void> {
  if (!outcome.userCorrections || outcome.userCorrections.length === 0) return;

  for (const correction of outcome.userCorrections) {
    const key = `${outcome.vendor}:${correction.entityType}.${correction.sourceField}->${correction.userChoice}`;

    const value: MappingPatternValue = {
      sourceEntity: correction.entityType,
      sourceField: correction.sourceField,
      targetEntity: correction.entityType,
      targetField: correction.userChoice,
      transferable: false, // user corrections are vendor-specific until confirmed elsewhere
    };

    // User corrections start at CANONICAL confidence
    await store.recordUserCorrection("mapping_pattern", key, value, {
      ...source,
      previousValue: correction.aiProposal,
    });

    // Also contradict the AI's original proposal
    const aiKey = `${outcome.vendor}:${correction.entityType}.${correction.sourceField}->${correction.aiProposal}`;
    await store.contradict("mapping_pattern", aiKey, {
      runId: source.runId,
      vendor: source.vendor,
      clinicId: source.clinicId,
      error: `User corrected ${correction.aiProposal} → ${correction.userChoice}`,
      correctedTo: correction.userChoice,
      timestamp: source.timestamp,
    });

    report.userCorrectionsRecorded++;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Infer which fix layers an error likely belongs to */
function inferFixLayers(error: {
  phase: string;
  errorCode?: string;
  entityType?: string;
}): FixLayer[] {
  const layers: FixLayer[] = [];

  if (error.phase === "draft_mapping" || error.phase === "transform") {
    layers.push("ai_prompts");
  }
  if (error.errorCode?.startsWith("V0")) {
    layers.push("structural_code"); // validation errors
  }
  if (error.phase === "ingest") {
    layers.push("vendor_knowledge");
  }

  return layers.length > 0 ? layers : ["cross_run_memory"];
}
