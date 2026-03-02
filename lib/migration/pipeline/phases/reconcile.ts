// Phase 8: Reconcile — Count reconciliation + final migration report

import { prisma } from "@/lib/prisma";
import type { SourceProfile } from "../../adapters/types";
import type { MappingSpec } from "../../canonical/mapping-spec";

export interface ReconcileInput {
  runId: string;
  sourceProfile: SourceProfile;
  mappingSpec?: MappingSpec;
}

export interface ReconciliationEntry {
  entityType: string;
  sourceCount: number;
  stagedCount: number;
  promotedCount: number;
  failedCount: number;
  matchRate: number; // staged / source as percentage
}

export interface MigrationReport {
  runId: string;
  completedAt: string;
  reconciliation: ReconciliationEntry[];
  totalSourceRecords: number;
  totalStagedRecords: number;
  totalPromotedRecords: number;
  totalFailedRecords: number;
  overallCompleteness: number; // percentage
  unresolvedExceptions: number;
  status: "complete" | "partial" | "failed";
}

export async function executeReconcile(
  input: ReconcileInput
): Promise<MigrationReport> {
  const reconciliation: ReconciliationEntry[] = [];

  // Get counts from ledger
  const ledgerCounts = await prisma.migrationRecordLedger.groupBy({
    by: ["entityType", "status"],
    where: { runId: input.runId },
    _count: true,
  });

  // Build counts map
  const countsByEntity: Record<string, Record<string, number>> = {};
  for (const entry of ledgerCounts) {
    if (!countsByEntity[entry.entityType]) {
      countsByEntity[entry.entityType] = {};
    }
    countsByEntity[entry.entityType][entry.status] = entry._count;
  }

  // Build source→canonical entity type map from mapping spec
  // e.g., "form" → "consent", "document" → "document"
  const sourceToCanonical: Record<string, string> = {};
  if (input.mappingSpec?.entityMappings) {
    for (const mapping of input.mappingSpec.entityMappings) {
      const sourceKey = mapping.sourceEntity.replace(/s$/, ""); // "forms" → "form"
      sourceToCanonical[sourceKey] = mapping.targetEntity;
    }
  }

  let totalSource = 0;
  let totalStaged = 0;
  let totalPromoted = 0;
  let totalFailed = 0;

  // Track which ledger entity types we've already reconciled
  const reconciledLedgerTypes = new Set<string>();

  // Reconcile each entity type from source profile
  for (const entity of input.sourceProfile.entities) {
    const sourceType = entity.type.replace(/s$/, ""); // "patients" → "patient"
    const canonicalType = sourceToCanonical[sourceType] || sourceType;

    // Look up ledger counts by canonical entity type
    const counts = countsByEntity[canonicalType] || {};
    reconciledLedgerTypes.add(canonicalType);

    const sourceCount = entity.recordCount;
    const stagedCount = (counts["staged"] || 0) + (counts["promoted"] || 0);
    const promotedCount = counts["promoted"] || 0;
    const failedCount = counts["failed"] || 0;

    totalSource += sourceCount;
    totalStaged += stagedCount;
    totalPromoted += promotedCount;
    totalFailed += failedCount;

    // Display canonical type when it differs from source type
    const displayType = canonicalType !== sourceType ? canonicalType : sourceType;

    reconciliation.push({
      entityType: displayType,
      sourceCount,
      stagedCount,
      promotedCount,
      failedCount,
      matchRate: sourceCount > 0 ? Math.round((stagedCount / sourceCount) * 100) : 0,
    });
  }

  // Add entries for canonical entity types in the ledger that weren't in source profile
  // (handles cases where the canonical layer creates new entity types)
  for (const [ledgerType, counts] of Object.entries(countsByEntity)) {
    if (reconciledLedgerTypes.has(ledgerType)) continue;

    const stagedCount = (counts["staged"] || 0) + (counts["promoted"] || 0);
    const promotedCount = counts["promoted"] || 0;
    const failedCount = counts["failed"] || 0;

    totalStaged += stagedCount;
    totalPromoted += promotedCount;
    totalFailed += failedCount;

    reconciliation.push({
      entityType: ledgerType,
      sourceCount: 0,
      stagedCount,
      promotedCount,
      failedCount,
      matchRate: 0, // No source count to compare against
    });
  }

  const overallCompleteness = totalSource > 0
    ? Math.round((totalPromoted / totalSource) * 100)
    : 0;

  const status: MigrationReport["status"] =
    totalFailed > 0 ? "partial" :
    totalPromoted === totalSource ? "complete" :
    "partial";

  return {
    runId: input.runId,
    completedAt: new Date().toISOString(),
    reconciliation,
    totalSourceRecords: totalSource,
    totalStagedRecords: totalStaged,
    totalPromotedRecords: totalPromoted,
    totalFailedRecords: totalFailed,
    overallCompleteness,
    unresolvedExceptions: totalFailed,
    status,
  };
}
