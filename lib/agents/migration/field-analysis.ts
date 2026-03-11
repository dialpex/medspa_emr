// Combined field analysis — merges field type inference + semantic classification
// into a single AI call per template, cutting AI cost by ~50%.
//
// Falls back to separate heuristics when no LLM is available.

import type { FieldType } from "@/lib/types/charts";
import type { FormFieldContent } from "@/lib/migration/providers/types";
import type { VendorKnowledge } from "./vendor-knowledge";
import type { FieldSemanticEntry } from "./field-classification";
import type { KnowledgeStore } from "./knowledge/store";
import {
  getFieldSemanticKnowledge,
  lookupFieldSemantic,
  type FieldSemanticKnowledge,
} from "./knowledge/retrieval";
import { getLLMProvider } from "@/lib/agents/_shared/llm";
import { completionWithRetry } from "@/lib/agents/_shared/llm/self-healing";
import { heuristicFieldType } from "./field-inference";
import { heuristicClassifyField } from "./field-classification";
import { FIELD_TYPE_VALUES } from "./field-inference/schema";
import { FIELD_CATEGORIES, PATIENT_FIELDS } from "./field-classification/schema";

/** Maximum fields per AI batch */
const MAX_FIELDS_PER_BATCH = 40;

/** Fields that the heuristic handles with near-100% confidence — skip AI for these */
const DETERMINISTIC_SOURCE_TYPES = new Set([
  "heading", "signature", "date", "connected_date", "image",
]);

export interface CombinedFieldAnalysis {
  fieldType: FieldType;
  semantic: FieldSemanticEntry;
}

interface CombinedAIResult {
  fields: Array<{
    fieldId: string;
    fieldType: string;
    category: string;
    patientField?: string;
    templateKey?: string;
    reasoning: string;
  }>;
}

/**
 * Build PHI-safe structural metadata for a field.
 */
function buildFieldMetadata(field: FormFieldContent) {
  return {
    fieldId: field.fieldId,
    label: field.label,
    sourceType: field.type,
    connectedFieldName: field.connectedFieldName || null,
    optionCount: field.availableOptions?.length ?? 0,
    sampleOptionLabels: field.availableOptions?.slice(0, 5),
    hasValue: field.value !== null && field.value !== undefined,
    valueLength: field.value?.length ?? 0,
  };
}

/**
 * Validate the combined AI response.
 */
function validateCombinedResult(
  parsed: CombinedAIResult,
  expectedFieldIds: string[]
): { valid: boolean; error?: string } {
  if (!parsed.fields || !Array.isArray(parsed.fields)) {
    return { valid: false, error: "Response must have a 'fields' array." };
  }

  const validTypes = new Set<string>(FIELD_TYPE_VALUES);
  const validCategories = new Set<string>(FIELD_CATEGORIES);
  const validPatientFields = new Set<string>(PATIENT_FIELDS);
  const errors: string[] = [];

  for (const f of parsed.fields) {
    if (!validTypes.has(f.fieldType)) {
      errors.push(`${f.fieldId}: "${f.fieldType}" is not a valid FieldType`);
    }
    if (!validCategories.has(f.category)) {
      errors.push(`${f.fieldId}: "${f.category}" is not a valid category`);
    }
    if (
      (f.category === "patient_demographic" || f.category === "patient_medical") &&
      !f.patientField
    ) {
      errors.push(`${f.fieldId}: category "${f.category}" requires patientField`);
    }
    if (f.patientField && !validPatientFields.has(f.patientField)) {
      errors.push(`${f.fieldId}: "${f.patientField}" is not a valid patient field`);
    }
    if (f.category === "clinical_content" && !f.templateKey) {
      errors.push(`${f.fieldId}: category "clinical_content" requires templateKey`);
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      error: `Validation errors: ${errors.join("; ")}. Valid types: ${FIELD_TYPE_VALUES.join(", ")}. Valid categories: ${FIELD_CATEGORIES.join(", ")}. Valid patientFields: ${PATIENT_FIELDS.join(", ")}`,
    };
  }

  const returnedIds = new Set(parsed.fields.map((f) => f.fieldId));
  const missing = expectedFieldIds.filter((id) => !returnedIds.has(id));
  if (missing.length > 0) {
    return {
      valid: false,
      error: `Missing fields: ${missing.join(", ")}. You must include every field from the input.`,
    };
  }

  return { valid: true };
}

/**
 * Build the combined system prompt (inference + classification in one call).
 */
function buildCombinedPrompt(vendorKnowledge?: VendorKnowledge | null): string {
  const vendorTypeHints = vendorKnowledge?.fieldTypeHints
    ? `\n## Vendor-Specific Field Type Hints\n${vendorKnowledge.fieldTypeHints}\n`
    : "";
  const vendorClassHints = vendorKnowledge?.fieldClassificationHints
    ? `\n## Vendor-Specific Classification Hints\n${vendorKnowledge.fieldClassificationHints}\n`
    : "";

  return `You are a MedSpa EMR migration specialist. Analyze each form field and determine BOTH its Neuvvia field type AND its semantic category in a single pass.

## TASK 1: Field Type Inference

Available Neuvvia field types: ${FIELD_TYPE_VALUES.join(", ")}

Type rules (apply in order):
1. Deterministic: heading → heading, signature → signature, date/connected_date → date, image → photo-single
2. Option-based: checkbox → checklist, radio/dropdown → select
3. Label heuristics: "units/dosage" → number, "notes/comments" → textarea, "areas treated" → json-areas, "products used" → json-products
4. Connected fields: check label for date/name patterns
5. Default: text (short) or textarea (long/multi-line)
${vendorTypeHints}
## TASK 2: Semantic Classification

Categories:
- patient_demographic — Patient identity/contact (name, DOB, email, phone, address, gender). Requires patientField.
- patient_medical — Patient medical background (allergies, medical history). Requires patientField.
- clinical_content — Clinical/treatment data for the chart template. Requires templateKey (snake_case from label, 2-4 words).
- administrative — Section headers/decorative elements in demographics sections.

Patient fields: ${PATIENT_FIELDS.join(", ")}

Classification rules:
1. Connected fields (connectedFieldName present) → patient_demographic
2. Label matches name/DOB/email/phone/gender/address → patient_demographic
3. Label matches allergies/medical history → patient_medical
4. Signatures → clinical_content (belongs in chart)
5. Demographics headings → administrative
6. Everything else → clinical_content
${vendorClassHints}
## PHI Safety
You receive ONLY structural metadata. NO patient data or PHI.

## Response Format
Return JSON:
{
  "fields": [
    {
      "fieldId": "abc123",
      "fieldType": "text",
      "category": "patient_demographic",
      "patientField": "firstName",
      "reasoning": "Connected first name field"
    },
    {
      "fieldId": "def456",
      "fieldType": "textarea",
      "category": "clinical_content",
      "templateKey": "treatment_notes",
      "reasoning": "Long text for clinical notes"
    }
  ]
}

Rules:
- Every input field MUST appear in output with exact fieldId
- patient_demographic and patient_medical MUST have patientField
- clinical_content MUST have templateKey (snake_case, 2-4 words from label)
- administrative fields need neither patientField nor templateKey`;
}

/**
 * Analyze a batch of fields via a single AI call (type + semantic).
 */
async function analyzeBatch(
  templateName: string,
  batchFields: [string, FormFieldContent][],
  system: string,
  provider: ReturnType<typeof getLLMProvider>,
  batchIndex: number,
  totalBatches: number
): Promise<Map<string, CombinedFieldAnalysis> | null> {
  const fieldMetadata = batchFields.map(([, field]) => buildFieldMetadata(field));
  const expectedFieldIds = batchFields.map(([id]) => id);
  const batchLabel = totalBatches > 1 ? ` (batch ${batchIndex + 1}/${totalBatches})` : "";
  const maxTokens = Math.min(8192, batchFields.length * 150);

  const userMessage = `Analyze fields for template "${templateName}"${batchLabel} — infer type AND classify semantics for ${batchFields.length} fields:\n\n${JSON.stringify(fieldMetadata, null, 2)}`;

  try {
    const { result: aiResult, attempts } = await completionWithRetry<CombinedAIResult>(
      provider,
      system,
      userMessage,
      { temperature: 0.1, maxTokens },
      (parsed) => validateCombinedResult(parsed, expectedFieldIds)
    );

    if (attempts > 1) {
      console.log(`[field-analysis] Template "${templateName}"${batchLabel}: AI succeeded after ${attempts} attempts`);
    }

    const map = new Map<string, CombinedFieldAnalysis>();
    for (const f of aiResult.fields) {
      map.set(f.fieldId, {
        fieldType: f.fieldType as FieldType,
        semantic: {
          fieldId: f.fieldId,
          category: f.category as FieldSemanticEntry["category"],
          patientField: f.patientField as FieldSemanticEntry["patientField"],
          templateKey: f.templateKey,
          reasoning: f.reasoning,
        },
      });
    }
    return map;
  } catch (err) {
    console.warn(
      `[field-analysis] AI failed for template "${templateName}"${batchLabel}, using heuristic fallback: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

/**
 * Heuristic fallback for a single field — combines type inference + semantic classification.
 */
function heuristicAnalyzeField(fieldId: string, field: FormFieldContent): CombinedFieldAnalysis {
  return {
    fieldType: heuristicFieldType(field),
    semantic: heuristicClassifyField(field),
  };
}

/**
 * Combined field analysis: infer types + classify semantics in a single AI call per batch.
 *
 * - Pre-skips deterministic fields (heading, signature, date, image) from AI — uses heuristic directly
 * - Batches remaining fields into groups of MAX_FIELDS_PER_BATCH
 * - Single AI call per batch instead of two separate calls
 * - Per-field heuristic fallback for any fields AI misses
 * - Preserves field sort order from source form
 *
 * Returns maps for both field types and semantic entries.
 */
export async function analyzeFields(
  templateName: string,
  fields: Map<string, FormFieldContent>,
  vendorKnowledge?: VendorKnowledge | null,
  knowledgeStore?: KnowledgeStore | null
): Promise<{
  types: Map<string, FieldType>;
  semantics: Map<string, FieldSemanticEntry>;
}> {
  const types = new Map<string, FieldType>();
  const semantics = new Map<string, FieldSemanticEntry>();

  if (fields.size === 0) return { types, semantics };

  // Sort fields by sortOrder if available, preserving source form layout
  const sortedEntries = Array.from(fields.entries()).sort(([, a], [, b]) => {
    return (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity);
  });

  // Phase 0: Knowledge lookup — resolve fields the agent already knows
  let fieldKnowledge: FieldSemanticKnowledge | null = null;
  const knowledgeResolvedIds = new Set<string>();

  if (knowledgeStore) {
    const vendor = vendorKnowledge?.vendorName || "unknown";
    const fieldLabels = sortedEntries.map(([, f]) => ({
      label: f.label,
      sourceType: f.type,
    }));
    fieldKnowledge = await getFieldSemanticKnowledge(knowledgeStore, vendor, fieldLabels);

    for (const [fieldId, field] of sortedEntries) {
      const known = lookupFieldSemantic(fieldKnowledge, field.label, field.type);
      if (known) {
        types.set(fieldId, (known.fieldType as FieldType) || heuristicFieldType(field));
        semantics.set(fieldId, {
          fieldId,
          category: known.category as FieldSemanticEntry["category"],
          patientField: known.patientField as FieldSemanticEntry["patientField"],
          templateKey: known.templateKey,
          reasoning: `Known from prior migrations: "${known.labelPattern}" → ${known.category}`,
        });
        knowledgeResolvedIds.add(fieldId);
      }
    }

    if (knowledgeResolvedIds.size > 0) {
      console.log(`[field-analysis] Template "${templateName}": ${knowledgeResolvedIds.size}/${sortedEntries.length} fields resolved from knowledge`);
    }
  }

  const provider = getLLMProvider();

  // If no real LLM available, use pure heuristic fallback for remaining
  if (provider.name === "mock" || !provider.isAvailable()) {
    for (const [fieldId, field] of sortedEntries) {
      if (knowledgeResolvedIds.has(fieldId)) continue;
      const analysis = heuristicAnalyzeField(fieldId, field);
      types.set(fieldId, analysis.fieldType);
      semantics.set(fieldId, analysis.semantic);
    }
    return { types, semantics };
  }

  // Phase 1: Pre-skip deterministic fields + knowledge-resolved fields
  const deterministicFields: [string, FormFieldContent][] = [];
  const aiCandidates: [string, FormFieldContent][] = [];

  for (const entry of sortedEntries) {
    const [fieldId, field] = entry;
    if (knowledgeResolvedIds.has(fieldId)) {
      continue; // already resolved from knowledge
    } else if (DETERMINISTIC_SOURCE_TYPES.has(field.type.toLowerCase())) {
      deterministicFields.push(entry);
    } else {
      aiCandidates.push(entry);
    }
  }

  // Apply heuristic for deterministic fields (zero AI cost)
  for (const [fieldId, field] of deterministicFields) {
    const analysis = heuristicAnalyzeField(fieldId, field);
    types.set(fieldId, analysis.fieldType);
    semantics.set(fieldId, analysis.semantic);
  }

  const resolvedCount = knowledgeResolvedIds.size + deterministicFields.length;
  if (resolvedCount > 0) {
    console.log(`[field-analysis] Template "${templateName}": ${resolvedCount} fields resolved (${knowledgeResolvedIds.size} knowledge, ${deterministicFields.length} heuristic), ${aiCandidates.length} sent to AI`);
  }

  if (aiCandidates.length === 0) return { types, semantics };

  // Build combined prompt
  const system = buildCombinedPrompt(vendorKnowledge);

  // Split AI candidates into batches
  const batches: [string, FormFieldContent][][] = [];
  for (let i = 0; i < aiCandidates.length; i += MAX_FIELDS_PER_BATCH) {
    batches.push(aiCandidates.slice(i, i + MAX_FIELDS_PER_BATCH));
  }

  if (batches.length > 1) {
    console.log(`[field-analysis] Template "${templateName}": splitting ${aiCandidates.length} fields into ${batches.length} batches`);
  }

  // Run batches sequentially
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const aiMap = await analyzeBatch(templateName, batch, system, provider, i, batches.length);

    for (const [fieldId, field] of batch) {
      const aiResult = aiMap?.get(fieldId);
      if (aiResult) {
        types.set(fieldId, aiResult.fieldType);
        semantics.set(fieldId, aiResult.semantic);
      } else {
        // AI missed this field or batch failed — fallback to heuristic
        const fallback = heuristicAnalyzeField(fieldId, field);
        types.set(fieldId, fallback.fieldType);
        semantics.set(fieldId, fallback.semantic);
      }
    }
  }

  return { types, semantics };
}
