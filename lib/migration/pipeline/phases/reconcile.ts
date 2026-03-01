// Phase 8: Reconcile — Count reconciliation + final migration report

import { prisma } from "@/lib/prisma";
import type { SourceProfile } from "../../adapters/types";

export interface ReconcileInput {
  runId: string;
  sourceProfile: SourceProfile;
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

  let totalSource = 0;
  let totalStaged = 0;
  let totalPromoted = 0;
  let totalFailed = 0;

  // Reconcile each entity type from source profile
  for (const entity of input.sourceProfile.entities) {
    const entityType = entity.type.replace(/s$/, ""); // "patients" → "patient"
    const counts = countsByEntity[entityType] || {};

    const sourceCount = entity.recordCount;
    const stagedCount = (counts["staged"] || 0) + (counts["promoted"] || 0);
    const promotedCount = counts["promoted"] || 0;
    const failedCount = counts["failed"] || 0;

    totalSource += sourceCount;
    totalStaged += stagedCount;
    totalPromoted += promotedCount;
    totalFailed += failedCount;

    reconciliation.push({
      entityType,
      sourceCount,
      stagedCount,
      promotedCount,
      failedCount,
      matchRate: sourceCount > 0 ? Math.round((stagedCount / sourceCount) * 100) : 0,
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
