// JSON response schema for field type inference.

import type { FieldType } from "@/lib/types/charts";

export const FIELD_TYPE_VALUES: FieldType[] = [
  "text",
  "textarea",
  "select",
  "multiselect",
  "number",
  "date",
  "checklist",
  "signature",
  "photo-pair",
  "photo-single",
  "json-areas",
  "json-products",
  "heading",
  "first-name",
  "last-name",
  "logo",
];

export interface FieldInferenceResult {
  fields: Array<{
    fieldId: string;
    fieldType: FieldType;
    reasoning: string;
  }>;
}

/**
 * Validate the AI response: every field must have a valid fieldType.
 */
export function validateFieldInference(
  parsed: FieldInferenceResult,
  expectedFieldIds: string[]
): { valid: boolean; error?: string } {
  if (!parsed.fields || !Array.isArray(parsed.fields)) {
    return { valid: false, error: "Response must have a 'fields' array." };
  }

  const validTypes = new Set<string>(FIELD_TYPE_VALUES);
  const invalidFields: string[] = [];

  for (const f of parsed.fields) {
    if (!validTypes.has(f.fieldType)) {
      invalidFields.push(`${f.fieldId}: "${f.fieldType}" is not a valid FieldType`);
    }
  }

  if (invalidFields.length > 0) {
    return {
      valid: false,
      error: `Invalid field types: ${invalidFields.join("; ")}. Valid types: ${FIELD_TYPE_VALUES.join(", ")}`,
    };
  }

  const returnedIds = new Set(parsed.fields.map((f) => f.fieldId));
  const missing = expectedFieldIds.filter((id) => !returnedIds.has(id));
  if (missing.length > 0) {
    return {
      valid: false,
      error: `Missing fields in response: ${missing.join(", ")}. You must include every field from the input.`,
    };
  }

  return { valid: true };
}
