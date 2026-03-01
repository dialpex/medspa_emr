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

    const r = record as Record<string, unknown>;
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
