// Canonical Validators — Deterministic hard-stop checks
// These are the authority. The AI model is advisory only.

import type {
  CanonicalPatient,
  CanonicalAppointment,
  CanonicalChart,
  CanonicalEncounter,
  CanonicalConsent,
  CanonicalPhoto,
  CanonicalDocument,
  CanonicalInvoice,
  CanonicalRecord,
  CanonicalEntityType,
} from "./schema";

export interface ValidationError {
  code: string;
  entityType: CanonicalEntityType;
  canonicalId: string;
  field?: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface ValidationReport {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  warningRecords: number;
  errorsByCode: Record<string, number>;
  errorsByEntity: Record<string, number>;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// Error code constants
export const V_CODES = {
  MISSING_REQUIRED: "V001",
  INVALID_DATE: "V002",
  INVALID_EMAIL: "V003",
  INVALID_PHONE: "V004",
  ORPHANED_REFERENCE: "V005",
  MISSING_PATIENT_LINK: "V006",
  MISSING_PROVIDER: "V007",
  EMPTY_SECTIONS: "V008",
  INVALID_AMOUNT: "V009",
  MISSING_LINE_ITEMS: "V010",
  DUPLICATE_CANONICAL_ID: "V011",
} as const;

function isNonEmpty(val: unknown): boolean {
  return val !== undefined && val !== null && val !== "";
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateDate(value: string | undefined, field: string, entityType: CanonicalEntityType, canonicalId: string): ValidationError | null {
  if (!value) return null;
  if (!ISO_DATE_RE.test(value) || isNaN(new Date(value).getTime())) {
    return {
      code: V_CODES.INVALID_DATE,
      entityType,
      canonicalId,
      field,
      message: `Invalid date format in ${field}`,
      severity: "error",
    };
  }
  return null;
}

export function validatePatient(record: CanonicalPatient): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const t: CanonicalEntityType = "patient";

  if (!isNonEmpty(record.firstName)) {
    errors.push({ code: V_CODES.MISSING_REQUIRED, entityType: t, canonicalId: record.canonicalId, field: "firstName", message: "Patient firstName is required", severity: "error" });
  }
  if (!isNonEmpty(record.lastName)) {
    errors.push({ code: V_CODES.MISSING_REQUIRED, entityType: t, canonicalId: record.canonicalId, field: "lastName", message: "Patient lastName is required", severity: "error" });
  }
  if (record.email && !EMAIL_RE.test(record.email)) {
    warnings.push({ code: V_CODES.INVALID_EMAIL, entityType: t, canonicalId: record.canonicalId, field: "email", message: "Invalid email format", severity: "warning" });
  }

  const dateErr = validateDate(record.dateOfBirth, "dateOfBirth", t, record.canonicalId);
  if (dateErr) warnings.push({ ...dateErr, severity: "warning" });

  return { valid: errors.length === 0, errors, warnings };
}

export function validateAppointment(record: CanonicalAppointment): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const t: CanonicalEntityType = "appointment";

  if (!isNonEmpty(record.canonicalPatientId)) {
    errors.push({ code: V_CODES.MISSING_PATIENT_LINK, entityType: t, canonicalId: record.canonicalId, field: "canonicalPatientId", message: "Appointment must link to a patient", severity: "error" });
  }
  if (!isNonEmpty(record.providerName)) {
    errors.push({ code: V_CODES.MISSING_PROVIDER, entityType: t, canonicalId: record.canonicalId, field: "providerName", message: "Appointment must have a provider", severity: "error" });
  }
  if (!isNonEmpty(record.startTime)) {
    errors.push({ code: V_CODES.MISSING_REQUIRED, entityType: t, canonicalId: record.canonicalId, field: "startTime", message: "Appointment startTime is required", severity: "error" });
  }

  const startErr = validateDate(record.startTime, "startTime", t, record.canonicalId);
  if (startErr) errors.push(startErr);
  const endErr = validateDate(record.endTime, "endTime", t, record.canonicalId);
  if (endErr) warnings.push({ ...endErr, severity: "warning" });

  return { valid: errors.length === 0, errors, warnings };
}

export function validateChart(record: CanonicalChart): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const t: CanonicalEntityType = "chart";

  if (!isNonEmpty(record.canonicalPatientId)) {
    errors.push({ code: V_CODES.MISSING_PATIENT_LINK, entityType: t, canonicalId: record.canonicalId, field: "canonicalPatientId", message: "Chart must link to a patient", severity: "error" });
  }
  if (!isNonEmpty(record.providerName)) {
    errors.push({ code: V_CODES.MISSING_PROVIDER, entityType: t, canonicalId: record.canonicalId, field: "providerName", message: "Chart must have provider attribution", severity: "error" });
  }
  if (!record.sections || record.sections.length === 0) {
    warnings.push({ code: V_CODES.EMPTY_SECTIONS, entityType: t, canonicalId: record.canonicalId, field: "sections", message: "Chart has no sections", severity: "warning" });
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateEncounter(record: CanonicalEncounter): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const t: CanonicalEntityType = "encounter";

  if (!isNonEmpty(record.canonicalPatientId)) {
    errors.push({ code: V_CODES.MISSING_PATIENT_LINK, entityType: t, canonicalId: record.canonicalId, field: "canonicalPatientId", message: "Encounter must link to a patient", severity: "error" });
  }
  if (!isNonEmpty(record.providerName)) {
    errors.push({ code: V_CODES.MISSING_PROVIDER, entityType: t, canonicalId: record.canonicalId, field: "providerName", message: "Encounter must have a provider", severity: "error" });
  }

  const dateErr = validateDate(record.date, "date", t, record.canonicalId);
  if (dateErr) errors.push(dateErr);

  return { valid: errors.length === 0, errors, warnings };
}

export function validateConsent(record: CanonicalConsent): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const t: CanonicalEntityType = "consent";

  if (!isNonEmpty(record.canonicalPatientId)) {
    errors.push({ code: V_CODES.MISSING_PATIENT_LINK, entityType: t, canonicalId: record.canonicalId, field: "canonicalPatientId", message: "Consent must link to a patient", severity: "error" });
  }
  if (!isNonEmpty(record.templateName)) {
    errors.push({ code: V_CODES.MISSING_REQUIRED, entityType: t, canonicalId: record.canonicalId, field: "templateName", message: "Consent must have a template name", severity: "error" });
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validatePhoto(record: CanonicalPhoto): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const t: CanonicalEntityType = "photo";

  if (!isNonEmpty(record.canonicalPatientId)) {
    errors.push({ code: V_CODES.MISSING_PATIENT_LINK, entityType: t, canonicalId: record.canonicalId, field: "canonicalPatientId", message: "Photo must link to a patient", severity: "error" });
  }
  if (!isNonEmpty(record.filename)) {
    errors.push({ code: V_CODES.MISSING_REQUIRED, entityType: t, canonicalId: record.canonicalId, field: "filename", message: "Photo must have a filename", severity: "error" });
  }
  if (!isNonEmpty(record.artifactKey)) {
    errors.push({ code: V_CODES.MISSING_REQUIRED, entityType: t, canonicalId: record.canonicalId, field: "artifactKey", message: "Photo must reference an artifact", severity: "error" });
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateDocument(record: CanonicalDocument): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const t: CanonicalEntityType = "document";

  if (!isNonEmpty(record.canonicalPatientId)) {
    errors.push({ code: V_CODES.MISSING_PATIENT_LINK, entityType: t, canonicalId: record.canonicalId, field: "canonicalPatientId", message: "Document must link to a patient", severity: "error" });
  }
  if (!isNonEmpty(record.filename)) {
    errors.push({ code: V_CODES.MISSING_REQUIRED, entityType: t, canonicalId: record.canonicalId, field: "filename", message: "Document must have a filename", severity: "error" });
  }
  if (!isNonEmpty(record.artifactKey)) {
    errors.push({ code: V_CODES.MISSING_REQUIRED, entityType: t, canonicalId: record.canonicalId, field: "artifactKey", message: "Document must reference an artifact", severity: "error" });
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateInvoice(record: CanonicalInvoice): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const t: CanonicalEntityType = "invoice";

  if (!isNonEmpty(record.canonicalPatientId)) {
    errors.push({ code: V_CODES.MISSING_PATIENT_LINK, entityType: t, canonicalId: record.canonicalId, field: "canonicalPatientId", message: "Invoice must link to a patient", severity: "error" });
  }
  if (typeof record.total !== "number" || record.total < 0) {
    errors.push({ code: V_CODES.INVALID_AMOUNT, entityType: t, canonicalId: record.canonicalId, field: "total", message: "Invoice total must be a non-negative number", severity: "error" });
  }
  if (!record.lineItems || record.lineItems.length === 0) {
    warnings.push({ code: V_CODES.MISSING_LINE_ITEMS, entityType: t, canonicalId: record.canonicalId, field: "lineItems", message: "Invoice has no line items", severity: "warning" });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// Dispatch validator by entity type
const VALIDATORS: Record<CanonicalEntityType, (record: never) => ValidationResult> = {
  patient: validatePatient as (record: never) => ValidationResult,
  appointment: validateAppointment as (record: never) => ValidationResult,
  chart: validateChart as (record: never) => ValidationResult,
  encounter: validateEncounter as (record: never) => ValidationResult,
  consent: validateConsent as (record: never) => ValidationResult,
  photo: validatePhoto as (record: never) => ValidationResult,
  document: validateDocument as (record: never) => ValidationResult,
  invoice: validateInvoice as (record: never) => ValidationResult,
};

export function validateRecord(entityType: CanonicalEntityType, record: CanonicalRecord): ValidationResult {
  const validator = VALIDATORS[entityType];
  if (!validator) {
    return {
      valid: false,
      errors: [{
        code: "V000",
        entityType,
        canonicalId: (record as { canonicalId: string }).canonicalId,
        message: `Unknown entity type: ${entityType}`,
        severity: "error",
      }],
      warnings: [],
    };
  }
  return validator(record as never);
}

// Validate a batch of records and produce a report
export function validateBatch(
  records: Array<{ entityType: CanonicalEntityType; record: CanonicalRecord }>
): ValidationReport {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];
  let validCount = 0;
  let invalidCount = 0;
  let warningCount = 0;

  for (const { entityType, record } of records) {
    const result = validateRecord(entityType, record);
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);

    if (result.valid) {
      validCount++;
      if (result.warnings.length > 0) warningCount++;
    } else {
      invalidCount++;
    }
  }

  const errorsByCode: Record<string, number> = {};
  for (const err of allErrors) {
    errorsByCode[err.code] = (errorsByCode[err.code] || 0) + 1;
  }

  const errorsByEntity: Record<string, number> = {};
  for (const err of allErrors) {
    errorsByEntity[err.entityType] = (errorsByEntity[err.entityType] || 0) + 1;
  }

  return {
    totalRecords: records.length,
    validRecords: validCount,
    invalidRecords: invalidCount,
    warningRecords: warningCount,
    errorsByCode,
    errorsByEntity,
    errors: allErrors,
    warnings: allWarnings,
  };
}

// Check referential integrity across a set of canonical records
export function validateReferentialIntegrity(
  records: Array<{ entityType: CanonicalEntityType; record: CanonicalRecord }>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const patientIds = new Set<string>();
  const appointmentIds = new Set<string>();

  // Collect known IDs
  for (const { entityType, record } of records) {
    const r = record as { canonicalId: string };
    if (entityType === "patient") patientIds.add(r.canonicalId);
    if (entityType === "appointment") appointmentIds.add(r.canonicalId);
  }

  // Check references
  for (const { entityType, record } of records) {
    const r = record as Record<string, unknown>;
    const canonicalId = r.canonicalId as string;

    if (entityType !== "patient" && r.canonicalPatientId) {
      if (!patientIds.has(r.canonicalPatientId as string)) {
        errors.push({
          code: V_CODES.ORPHANED_REFERENCE,
          entityType,
          canonicalId,
          field: "canonicalPatientId",
          message: `References non-existent patient ${r.canonicalPatientId}`,
          severity: "error",
        });
      }
    }

    if (r.canonicalAppointmentId) {
      if (!appointmentIds.has(r.canonicalAppointmentId as string)) {
        errors.push({
          code: V_CODES.ORPHANED_REFERENCE,
          entityType,
          canonicalId,
          field: "canonicalAppointmentId",
          message: `References non-existent appointment ${r.canonicalAppointmentId}`,
          severity: "error",
        });
      }
    }
  }

  return errors;
}
