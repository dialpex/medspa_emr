// Phase 6: Validate — Deterministic validators + sampling packet

import type { CanonicalRecord, CanonicalEntityType } from "../../canonical/schema";
import {
  validateBatch,
  validateReferentialIntegrity,
  type ValidationReport,
  type ValidationError,
} from "../../canonical/validators";

export interface ValidateInput {
  records: Array<{
    entityType: CanonicalEntityType;
    canonicalId: string;
    record: CanonicalRecord;
    sourceRecordId: string;
  }>;
}

export interface SamplingPacket {
  totalRecords: number;
  sampledCount: number;
  entityDistribution: Record<string, number>;
  requiredFieldPresence: Record<string, Record<string, number>>; // entity → field → count present
}

export interface ValidateResult {
  report: ValidationReport;
  referentialErrors: ValidationError[];
  samplingPacket: SamplingPacket;
  passed: boolean; // true if no hard-stop errors
}

// Non-PHI feedback for AI self-correction — only error codes, field names, counts
export interface MappingFeedback {
  attempt: number;
  totalRecords: number;
  invalidRecords: number;
  referentialErrorCount: number;
  errorsByCode: Record<string, number>; // e.g. { V001: 5, V006: 3 }
  errorsByEntity: Record<string, number>; // e.g. { patient: 2, appointment: 6 }
  // Per-error-code detail: which entity types and fields are affected
  errorDetails: Array<{
    code: string;
    entityType: string;
    field?: string;
    count: number;
    sampleMessage: string; // One representative message (no PHI)
  }>;
  referentialDetails: Array<{
    entityType: string;
    field: string;
    count: number;
  }>;
}

export function buildMappingFeedback(
  result: ValidateResult,
  attempt: number
): MappingFeedback {
  // Group errors by (code, entityType, field) for actionable detail
  const errorGroupKey = (e: { code: string; entityType: string; field?: string }) =>
    `${e.code}::${e.entityType}::${e.field || ""}`;

  const errorGroups = new Map<
    string,
    { code: string; entityType: string; field?: string; count: number; sampleMessage: string }
  >();

  for (const err of result.report.errors) {
    const key = errorGroupKey(err);
    const existing = errorGroups.get(key);
    if (existing) {
      existing.count++;
    } else {
      errorGroups.set(key, {
        code: err.code,
        entityType: err.entityType,
        field: err.field,
        count: 1,
        sampleMessage: err.message,
      });
    }
  }

  // Group referential errors by (entityType, field)
  const refGroups = new Map<string, { entityType: string; field: string; count: number }>();
  for (const err of result.referentialErrors) {
    const key = `${err.entityType}::${err.field || ""}`;
    const existing = refGroups.get(key);
    if (existing) {
      existing.count++;
    } else {
      refGroups.set(key, {
        entityType: err.entityType,
        field: err.field || "",
        count: 1,
      });
    }
  }

  return {
    attempt,
    totalRecords: result.report.totalRecords,
    invalidRecords: result.report.invalidRecords,
    referentialErrorCount: result.referentialErrors.length,
    errorsByCode: { ...result.report.errorsByCode },
    errorsByEntity: { ...result.report.errorsByEntity },
    errorDetails: [...errorGroups.values()],
    referentialDetails: [...refGroups.values()],
  };
}

export function executeValidate(input: ValidateInput): ValidateResult {
  // Run per-record validators
  const batchInput = input.records.map((r) => ({
    entityType: r.entityType,
    record: r.record,
  }));

  const report = validateBatch(batchInput);

  // Run referential integrity check
  const referentialErrors = validateReferentialIntegrity(batchInput);

  // Build sampling packet (non-PHI)
  const entityDistribution: Record<string, number> = {};
  const requiredFieldPresence: Record<string, Record<string, number>> = {};

  for (const { entityType, record } of input.records) {
    entityDistribution[entityType] = (entityDistribution[entityType] || 0) + 1;

    if (!requiredFieldPresence[entityType]) {
      requiredFieldPresence[entityType] = {};
    }

    const r = record as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(r)) {
      if (value !== null && value !== undefined && value !== "") {
        requiredFieldPresence[entityType][key] =
          (requiredFieldPresence[entityType][key] || 0) + 1;
      }
    }
  }

  const samplingPacket: SamplingPacket = {
    totalRecords: input.records.length,
    sampledCount: Math.min(input.records.length, 100),
    entityDistribution,
    requiredFieldPresence,
  };

  // Hard-stop: any validation errors OR referential integrity failures
  const passed = report.invalidRecords === 0 && referentialErrors.length === 0;

  return {
    report,
    referentialErrors,
    samplingPacket,
    passed,
  };
}
