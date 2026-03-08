// JSON response schema for field semantic classification.

export const FIELD_CATEGORIES = [
  "patient_demographic",
  "patient_medical",
  "clinical_content",
  "administrative",
] as const;

export type FieldCategory = (typeof FIELD_CATEGORIES)[number];

export const PATIENT_FIELDS = [
  "firstName",
  "lastName",
  "dateOfBirth",
  "email",
  "phone",
  "gender",
  "address",
  "city",
  "state",
  "zipCode",
  "allergies",
  "medicalNotes",
] as const;

export type PatientField = (typeof PATIENT_FIELDS)[number];

export interface FieldSemanticEntry {
  fieldId: string;
  category: FieldCategory;
  /** Maps to Patient model field — required for patient_demographic and patient_medical */
  patientField?: PatientField;
  /** Human-readable snake_case key — required for clinical_content */
  templateKey?: string;
  reasoning: string;
}

export interface FieldClassificationResult {
  fields: FieldSemanticEntry[];
}

/**
 * Validate the AI response: every field must have a valid category,
 * demographics must have patientField, clinical must have templateKey.
 */
export function validateFieldClassification(
  parsed: FieldClassificationResult,
  expectedFieldIds: string[]
): { valid: boolean; error?: string } {
  if (!parsed.fields || !Array.isArray(parsed.fields)) {
    return { valid: false, error: "Response must have a 'fields' array." };
  }

  const validCategories = new Set<string>(FIELD_CATEGORIES);
  const validPatientFields = new Set<string>(PATIENT_FIELDS);
  const errors: string[] = [];

  for (const f of parsed.fields) {
    if (!validCategories.has(f.category)) {
      errors.push(`${f.fieldId}: "${f.category}" is not a valid category`);
      continue;
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
      error: `Validation errors: ${errors.join("; ")}. Valid categories: ${FIELD_CATEGORIES.join(", ")}. Valid patientFields: ${PATIENT_FIELDS.join(", ")}`,
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
