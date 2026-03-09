// AI-driven field type inference — replaces hardcoded switch-based mapping.

import type { FieldType } from "@/lib/types/charts";
import type { FormFieldContent } from "@/lib/migration/providers/types";
import type { VendorKnowledge } from "../vendor-knowledge";
import { getLLMProvider } from "@/lib/agents/_shared/llm";
import { completionWithRetry } from "@/lib/agents/_shared/llm/self-healing";
import { FIELD_INFERENCE_SYSTEM_PROMPT, buildVendorContext } from "./prompts";
import { validateFieldInference, type FieldInferenceResult } from "./schema";

/**
 * Heuristic fallback for a single field — used when AI is unavailable or
 * returns invalid types for specific fields. This mirrors the legacy
 * mapBoulevardFieldType behavior with additional label-based heuristics.
 */
export function heuristicFieldType(field: FormFieldContent): FieldType {
  const sourceType = field.type.toLowerCase();
  const label = field.label.toLowerCase();

  // Deterministic type mappings
  if (sourceType === "heading") return "heading";
  if (sourceType === "signature") return "signature";
  if (sourceType === "date" || sourceType === "connected_date") return "date";
  if (sourceType === "image") return "photo-single";

  // Option-based types
  if (sourceType === "checkbox") return "checklist";
  if (sourceType === "radio" || sourceType === "dropdown" || sourceType === "select") {
    return "select";
  }

  // Connected fields — check label for more specific type
  if (sourceType === "connected_text") {
    if (/\bfirst\s*name\b/.test(label)) return "first-name";
    if (/\blast\s*name\b/.test(label)) return "last-name";
    if (/\b(date|dob|birth)\b/.test(label)) return "date";
    return "text";
  }

  // Label-based heuristics for text-like fields
  if (/\b(units?|dosage|quantity|amount|cc|ml)\b/.test(label)) return "number";
  if (/\b(notes?|comments?|description|narrative|summary|observations?)\b/.test(label)) return "textarea";
  if (/\b(areas?\s*treated|injection\s*sites?|treatment\s*areas?|zones?)\b/.test(label)) return "json-areas";
  if (/\b(products?\s*used|products?|supplies)\b/.test(label)) return "json-products";
  if (/\bfirst\s*name\b/.test(label)) return "first-name";
  if (/\blast\s*name\b/.test(label)) return "last-name";

  // Textarea vs text — use source type hint
  if (sourceType === "textarea") return "textarea";

  return "text";
}

/**
 * Build PHI-safe structural metadata for a field (never sends actual patient values).
 */
function buildFieldMetadata(field: FormFieldContent) {
  return {
    fieldId: field.fieldId,
    label: field.label,
    sourceType: field.type,
    optionCount: field.availableOptions?.length ?? 0,
    sampleOptionLabels: field.availableOptions?.slice(0, 5),
    hasValue: field.value !== null && field.value !== undefined,
    valueLength: field.value?.length ?? 0,
  };
}

/** Maximum fields per AI batch — keeps JSON payloads small enough for reliable parsing */
const MAX_FIELDS_PER_BATCH = 40;

/**
 * Infer field types for a single batch of fields via AI.
 * Returns a Map of fieldId → FieldType for successfully inferred fields.
 * On failure, returns null (caller should use heuristic fallback for this batch).
 */
async function inferBatch(
  templateName: string,
  batchFields: [string, FormFieldContent][],
  system: string,
  provider: ReturnType<typeof getLLMProvider>,
  batchIndex: number,
  totalBatches: number
): Promise<Map<string, FieldType> | null> {
  const fieldMetadata = batchFields.map(([, field]) => buildFieldMetadata(field));
  const expectedFieldIds = batchFields.map(([id]) => id);
  const batchLabel = totalBatches > 1 ? ` (batch ${batchIndex + 1}/${totalBatches})` : "";
  const maxTokens = Math.min(8192, batchFields.length * 100);

  const userMessage = `Infer field types for template "${templateName}"${batchLabel} with ${batchFields.length} fields:\n\n${JSON.stringify(fieldMetadata, null, 2)}`;

  try {
    const { result: aiResult, attempts } = await completionWithRetry<FieldInferenceResult>(
      provider,
      system,
      userMessage,
      { temperature: 0.1, maxTokens },
      (parsed) => validateFieldInference(parsed, expectedFieldIds)
    );

    if (attempts > 1) {
      console.log(`[field-inference] Template "${templateName}"${batchLabel}: AI succeeded after ${attempts} attempts`);
    }

    return new Map(aiResult.fields.map((f) => [f.fieldId, f.fieldType]));
  } catch (err) {
    console.warn(
      `[field-inference] AI failed for template "${templateName}"${batchLabel}, using heuristic fallback: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

/**
 * Infer field types for all fields in a template using AI with heuristic fallback.
 *
 * - Uses getLLMProvider() — mock provider triggers immediate heuristic fallback
 * - Injects vendor knowledge into prompt when available
 * - Uses completionWithRetry() with field type validation
 * - Per-field heuristic fallback for any fields AI misses or returns invalid types
 * - Large templates (>MAX_FIELDS_PER_BATCH fields) are split into batches
 *   with per-batch heuristic fallback on failure (not all-or-nothing)
 */
export async function inferFieldTypes(
  templateName: string,
  fields: Map<string, FormFieldContent>,
  vendorKnowledge?: VendorKnowledge | null
): Promise<Map<string, FieldType>> {
  const result = new Map<string, FieldType>();

  if (fields.size === 0) return result;

  const provider = getLLMProvider();

  // If no real LLM available (mock provider or unavailable), use pure heuristic fallback
  if (provider.name === "mock" || !provider.isAvailable()) {
    for (const [fieldId, field] of fields) {
      result.set(fieldId, heuristicFieldType(field));
    }
    return result;
  }

  const vendorContext = buildVendorContext(vendorKnowledge?.fieldTypeHints);
  const system = FIELD_INFERENCE_SYSTEM_PROMPT.replace("{vendorContext}", vendorContext);

  // Split into batches if needed
  const allEntries = Array.from(fields.entries());
  const batches: [string, FormFieldContent][][] = [];
  for (let i = 0; i < allEntries.length; i += MAX_FIELDS_PER_BATCH) {
    batches.push(allEntries.slice(i, i + MAX_FIELDS_PER_BATCH));
  }

  if (batches.length > 1) {
    console.log(`[field-inference] Template "${templateName}": splitting ${fields.size} fields into ${batches.length} batches`);
  }

  // Run batches sequentially (avoids rate limiting, keeps costs predictable)
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const aiMap = await inferBatch(templateName, batch, system, provider, i, batches.length);

    for (const [fieldId, field] of batch) {
      const aiType = aiMap?.get(fieldId);
      if (aiType) {
        result.set(fieldId, aiType);
      } else {
        // AI missed this field or batch failed — fallback to heuristic
        result.set(fieldId, heuristicFieldType(field));
      }
    }
  }

  return result;
}
