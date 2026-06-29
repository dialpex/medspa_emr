// AI-driven field semantic classification — determines which fields are
// demographics (skip), medical (enrich patient), or clinical (keep in template).

import type { FormFieldContent } from "@/lib/migration/providers/types";
import type { VendorKnowledge } from "../vendor-knowledge";
import { getLLMProvider } from "@/lib/agents/_shared/llm";
import { completionWithRetry } from "@/lib/agents/_shared/llm/self-healing";
import {
  FIELD_CLASSIFICATION_SYSTEM_PROMPT,
  buildClassificationVendorContext,
} from "./prompts";
import {
  validateFieldClassification,
  type FieldSemanticEntry,
  type FieldClassificationResult,
  type FieldCategory,
  type PatientField,
} from "./schema";

/** Maximum fields per AI batch — keeps JSON payloads small enough for reliable parsing */
const MAX_FIELDS_PER_BATCH = 40;

/**
 * Heuristic fallback for a single field — used when AI is unavailable.
 * Uses label matching and connectedFieldName to classify fields.
 */
export function heuristicClassifyField(field: FormFieldContent): FieldSemanticEntry {
  const label = field.label.toLowerCase().trim();
  const connected = field.connectedFieldName?.toLowerCase();

  // Connected fields are strong demographic signals
  if (connected || field.type === "connected_text" || field.type === "connected_date") {
    const demographicMap: Record<string, PatientField> = {
      "first name": "firstName",
      "last name": "lastName",
      "date of birth": "dateOfBirth",
      "email": "email",
      "phone number": "phone",
      "phone": "phone",
    };

    // Check connectedFieldName first
    if (connected) {
      for (const [key, patientField] of Object.entries(demographicMap)) {
        if (connected.includes(key)) {
          return {
            fieldId: field.fieldId,
            category: "patient_demographic",
            patientField,
            reasoning: `Connected field "${field.connectedFieldName}" maps to patient ${patientField}`,
          };
        }
      }
    }

    // Fall back to label matching for connected fields
    for (const [key, patientField] of Object.entries(demographicMap)) {
      if (label.includes(key)) {
        return {
          fieldId: field.fieldId,
          category: "patient_demographic",
          patientField,
          reasoning: `Connected field with label "${field.label}" maps to patient ${patientField}`,
        };
      }
    }
  }

  // Label-based demographic detection
  if (/\bfirst\s*name\b/.test(label)) {
    return { fieldId: field.fieldId, category: "patient_demographic", patientField: "firstName", reasoning: "Label matches first name" };
  }
  if (/\blast\s*name\b/.test(label)) {
    return { fieldId: field.fieldId, category: "patient_demographic", patientField: "lastName", reasoning: "Label matches last name" };
  }
  if (/\b(date\s*of\s*birth|dob)\b/.test(label)) {
    return { fieldId: field.fieldId, category: "patient_demographic", patientField: "dateOfBirth", reasoning: "Label matches date of birth" };
  }
  if (/^age$/i.test(label.trim())) {
    return { fieldId: field.fieldId, category: "patient_demographic", patientField: "dateOfBirth", reasoning: "Age field equivalent to dateOfBirth" };
  }
  if (/\bemail\b/.test(label)) {
    return { fieldId: field.fieldId, category: "patient_demographic", patientField: "email", reasoning: "Label matches email" };
  }
  if (/\bphone\b/.test(label)) {
    return { fieldId: field.fieldId, category: "patient_demographic", patientField: "phone", reasoning: "Label matches phone" };
  }
  if (/\bgender\b|\bsex\b|\bpronoun\b/.test(label)) {
    return { fieldId: field.fieldId, category: "patient_demographic", patientField: "gender", reasoning: "Label matches gender" };
  }
  if (/\bzip\s*(code)?\b|\bpostal\b/.test(label)) {
    return { fieldId: field.fieldId, category: "patient_demographic", patientField: "zipCode", reasoning: "Label matches zip code" };
  }
  if (/\baddress\b/.test(label) && !/\bemail\b/.test(label)) {
    return { fieldId: field.fieldId, category: "patient_demographic", patientField: "address", reasoning: "Label matches address" };
  }
  if (/^city$/i.test(label.trim())) {
    return { fieldId: field.fieldId, category: "patient_demographic", patientField: "city", reasoning: "Label matches city" };
  }
  if (/^state$/i.test(label.trim())) {
    return { fieldId: field.fieldId, category: "patient_demographic", patientField: "state", reasoning: "Label matches state" };
  }

  // Patient medical fields
  if (/\ballerg(y|ies)\b/.test(label)) {
    return { fieldId: field.fieldId, category: "patient_medical", patientField: "allergies", reasoning: "Label matches allergies" };
  }
  if (/\b(medical\s*history|health\s*history|medical\s*conditions?|current\s*medications?)\b/.test(label)) {
    return { fieldId: field.fieldId, category: "patient_medical", patientField: "medicalNotes", reasoning: "Label matches medical history" };
  }

  // Administrative headings in demographics context
  if (field.type === "heading") {
    if (/\b(client|patient|personal)\s*(info|information|details)\b/.test(label) ||
        /\bdemographics\b/.test(label)) {
      return { fieldId: field.fieldId, category: "administrative", reasoning: "Demographics section heading" };
    }
    // Default: clinical section heading
    return {
      fieldId: field.fieldId,
      category: "clinical_content",
      templateKey: `section_${toSnakeCase(field.label)}`,
      reasoning: "Section heading",
    };
  }

  // Everything else is clinical content
  return {
    fieldId: field.fieldId,
    category: "clinical_content",
    templateKey: toSnakeCase(field.label),
    reasoning: "Default classification as clinical content",
  };
}

/**
 * Convert a label to a snake_case template key.
 * Strips special characters, collapses whitespace, limits to 4 words.
 */
function toSnakeCase(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("_") || "field";
}

/**
 * Build PHI-safe structural metadata for a field (never sends actual patient values).
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
  };
}

/**
 * Classify a single batch of fields via AI.
 * Returns a Map of fieldId → FieldSemanticEntry for successfully classified fields.
 * On failure, returns null (caller should use heuristic fallback for this batch).
 */
async function classifyBatch(
  templateName: string,
  batchFields: [string, FormFieldContent][],
  system: string,
  provider: ReturnType<typeof getLLMProvider>,
  batchIndex: number,
  totalBatches: number
): Promise<Map<string, FieldSemanticEntry> | null> {
  const fieldMetadata = batchFields.map(([, field]) => buildFieldMetadata(field));
  const expectedFieldIds = batchFields.map(([id]) => id);
  const batchLabel = totalBatches > 1 ? ` (batch ${batchIndex + 1}/${totalBatches})` : "";
  const maxTokens = Math.min(8192, batchFields.length * 120);

  const userMessage = `Classify field semantics for template "${templateName}"${batchLabel} with ${batchFields.length} fields:\n\n${JSON.stringify(fieldMetadata, null, 2)}`;

  try {
    const { result: aiResult, attempts } = await completionWithRetry<FieldClassificationResult>(
      provider,
      system,
      userMessage,
      { temperature: 0.1, maxTokens },
      (parsed) => validateFieldClassification(parsed, expectedFieldIds)
    );

    if (attempts > 1) {
      console.log(`[field-classification] Template "${templateName}"${batchLabel}: AI succeeded after ${attempts} attempts`);
    }

    return new Map(aiResult.fields.map((f) => [f.fieldId, f]));
  } catch (err) {
    console.warn(
      `[field-classification] AI failed for template "${templateName}"${batchLabel}, using heuristic fallback: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

/**
 * Classify field semantics for all fields in a template using AI with heuristic fallback.
 *
 * Returns a Map of fieldId → FieldSemanticEntry categorizing each field as:
 * - patient_demographic: skip (data on patient record)
 * - patient_medical: enrich patient record
 * - clinical_content: keep in chart template with meaningful key
 * - administrative: skip (decorative headings in demographics sections)
 */
export async function classifyFieldSemantics(
  templateName: string,
  fields: Map<string, FormFieldContent>,
  vendorKnowledge?: VendorKnowledge | null
): Promise<Map<string, FieldSemanticEntry>> {
  const result = new Map<string, FieldSemanticEntry>();

  if (fields.size === 0) return result;

  const provider = getLLMProvider();

  // If no real LLM available, use pure heuristic fallback
  if (provider.name === "mock" || !provider.isAvailable()) {
    for (const [fieldId, field] of fields) {
      result.set(fieldId, heuristicClassifyField(field));
    }
    return result;
  }

  const vendorContext = buildClassificationVendorContext(vendorKnowledge?.fieldClassificationHints);
  const system = FIELD_CLASSIFICATION_SYSTEM_PROMPT.replace("{vendorContext}", vendorContext);

  // Split into batches if needed
  const allEntries = Array.from(fields.entries());
  const batches: [string, FormFieldContent][][] = [];
  for (let i = 0; i < allEntries.length; i += MAX_FIELDS_PER_BATCH) {
    batches.push(allEntries.slice(i, i + MAX_FIELDS_PER_BATCH));
  }

  if (batches.length > 1) {
    console.log(`[field-classification] Template "${templateName}": splitting ${fields.size} fields into ${batches.length} batches`);
  }

  // Run batches sequentially (avoids rate limiting)
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const aiMap = await classifyBatch(templateName, batch, system, provider, i, batches.length);

    for (const [fieldId, field] of batch) {
      const aiEntry = aiMap?.get(fieldId);
      if (aiEntry) {
        result.set(fieldId, aiEntry);
      } else {
        // AI missed this field or batch failed — fallback to heuristic
        result.set(fieldId, heuristicClassifyField(field));
      }
    }
  }

  return result;
}
