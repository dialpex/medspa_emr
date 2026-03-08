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

/**
 * Infer field types for all fields in a template using AI with heuristic fallback.
 *
 * - Uses getLLMProvider() — mock provider triggers immediate heuristic fallback
 * - Injects vendor knowledge into prompt when available
 * - Uses completionWithRetry() with field type validation
 * - Per-field heuristic fallback for any fields AI misses or returns invalid types
 * - 1 LLM call per template (batched), max 2 with retry
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

  // Build PHI-safe metadata for all fields
  const fieldMetadata = Array.from(fields.entries()).map(([, field]) =>
    buildFieldMetadata(field)
  );

  const vendorContext = buildVendorContext(vendorKnowledge?.fieldTypeHints);
  const system = FIELD_INFERENCE_SYSTEM_PROMPT.replace("{vendorContext}", vendorContext);

  const userMessage = `Infer field types for template "${templateName}" with ${fields.size} fields:\n\n${JSON.stringify(fieldMetadata, null, 2)}`;

  const expectedFieldIds = Array.from(fields.keys());

  try {
    const { result: aiResult, attempts } = await completionWithRetry<FieldInferenceResult>(
      provider,
      system,
      userMessage,
      { temperature: 0.1, maxTokens: 4096 },
      (parsed) => validateFieldInference(parsed, expectedFieldIds)
    );

    if (attempts > 1) {
      console.log(`[field-inference] Template "${templateName}": AI succeeded after ${attempts} attempts`);
    }

    // Use AI results, with per-field heuristic fallback for safety
    const aiMap = new Map(aiResult.fields.map((f) => [f.fieldId, f.fieldType]));

    for (const [fieldId, field] of fields) {
      const aiType = aiMap.get(fieldId);
      if (aiType) {
        result.set(fieldId, aiType);
      } else {
        // AI missed this field — fallback to heuristic
        result.set(fieldId, heuristicFieldType(field));
      }
    }
  } catch (err) {
    // Full AI failure — fall back to heuristics for all fields
    console.warn(
      `[field-inference] AI failed for template "${templateName}", using heuristic fallback: ${err instanceof Error ? err.message : String(err)}`
    );
    for (const [fieldId, field] of fields) {
      result.set(fieldId, heuristicFieldType(field));
    }
  }

  return result;
}
