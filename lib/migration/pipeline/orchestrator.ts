// Migration Pipeline Orchestrator
// Coordinates all 8 phases: Ingest → Profile → Draft Mapping → Approve →
// Transform → Validate → Load → Reconcile
// Supports pause/resume via checkpoint persistence.

import { prisma } from "@/lib/prisma";
import type { MigrationRun } from "@prisma/client";
import type { MigrationProvider, MigrationCredentials } from "../providers/types";
import type { ArtifactStore, ArtifactRef } from "../storage/types";
import type { SourceProfile } from "../adapters/types";
import type { MappingSpec } from "../canonical/mapping-spec";
import type { CanonicalRecord, CanonicalEntityType } from "../canonical/schema";
import type { MigrationReport } from "./phases/reconcile";

import { executeIngest, type IngestInput } from "./phases/ingest";
import { executeProfile } from "./phases/profile";
import { executeDraftMapping } from "./phases/draft-mapping";
import { executeTransform } from "./phases/transform";
import { executeValidate, type ValidateResult } from "./phases/validate";
import { executeLoad, executePromote } from "./phases/load";
import { executeReconcile } from "./phases/reconcile";

export type MigrationPhase =
  | "ingest"
  | "profile"
  | "draft_mapping"
  | "approve_mapping"
  | "transform"
  | "validate"
  | "load"
  | "reconcile";

const PHASE_ORDER: MigrationPhase[] = [
  "ingest",
  "profile",
  "draft_mapping",
  "approve_mapping",
  "transform",
  "validate",
  "load",
  "reconcile",
];

export interface OrchestratorConfig {
  store: ArtifactStore;
  provider?: MigrationProvider;
  autoApprove?: boolean; // For testing only — skips human approval gate
}

export class MigrationOrchestrator {
  private store: ArtifactStore;
  private provider?: MigrationProvider;
  private autoApprove: boolean;

  constructor(config: OrchestratorConfig) {
    this.store = config.store;
    this.provider = config.provider;
    this.autoApprove = config.autoApprove || false;
  }

  // Run a single phase
  async runPhase(runId: string, phase: MigrationPhase): Promise<void> {
    const run = await this.getRun(runId);
    await this.auditEvent(runId, phase, "PHASE_STARTED");

    try {
      switch (phase) {
        case "ingest":
          await this.phaseIngest(run);
          break;
        case "profile":
          await this.phaseProfile(run);
          break;
        case "draft_mapping":
          await this.phaseDraftMapping(run);
          break;
        case "approve_mapping":
          // This is a human gate — handled via API
          throw new Error("approve_mapping phase requires human action via API");
        case "transform":
          await this.phaseTransform(run);
          break;
        case "validate":
          await this.phaseValidate(run);
          break;
        case "load":
          await this.phaseLoad(run);
          break;
        case "reconcile":
          await this.phaseReconcile(run);
          break;
      }

      await this.auditEvent(runId, phase, "PHASE_COMPLETED");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.updateRun(runId, { status: "Failed", errorMessage: message });
      await this.auditEvent(runId, phase, "PHASE_FAILED", { error: message });
      throw error;
    }
  }

  // Run all phases up to (but not including) approve_mapping
  async runToApproval(runId: string): Promise<void> {
    for (const phase of ["ingest", "profile", "draft_mapping"] as MigrationPhase[]) {
      await this.runPhase(runId, phase);
    }
  }

  // Run all phases after approval
  async runFromApproval(runId: string): Promise<MigrationReport> {
    for (const phase of ["transform", "validate", "load", "reconcile"] as MigrationPhase[]) {
      await this.runPhase(runId, phase);
    }

    const run = await this.getRun(runId);
    const profile: SourceProfile = JSON.parse(run.sourceProfile || "{}");
    return executeReconcile({ runId, sourceProfile: profile });
  }

  // Run the full pipeline (for testing or with autoApprove)
  async runFull(runId: string, ingestInput?: Partial<IngestInput>): Promise<MigrationReport> {
    await this.runToApproval(runId);

    if (this.autoApprove) {
      await this.approveMapping(runId, "system-auto-approve");
    } else {
      throw new Error("Pipeline paused at approve_mapping. Call approveMapping() to continue.");
    }

    return this.runFromApproval(runId);
  }

  // Human approval gate
  async approveMapping(runId: string, approvedById: string): Promise<void> {
    const run = await this.getRun(runId);

    if (run.mappingSpecVersion === 0) {
      throw new Error("No mapping spec to approve");
    }

    await this.updateRun(runId, {
      status: "MappingApproved",
      currentPhase: "approve_mapping",
      mappingApprovedAt: new Date(),
      mappingApprovedById: approvedById,
    });

    await this.auditEvent(runId, "approve_mapping", "MAPPING_APPROVED", {
      approvedById,
      version: run.mappingSpecVersion,
    });
  }

  // Resume from last checkpoint
  async resume(runId: string): Promise<void> {
    const run = await this.getRun(runId);
    const currentPhase = run.currentPhase as MigrationPhase | null;

    if (!currentPhase) {
      throw new Error("No phase to resume from");
    }

    const phaseIndex = PHASE_ORDER.indexOf(currentPhase);
    if (phaseIndex === -1) {
      throw new Error(`Unknown phase: ${currentPhase}`);
    }

    // Resume from the next incomplete phase
    for (let i = phaseIndex; i < PHASE_ORDER.length; i++) {
      const phase = PHASE_ORDER[i];
      if (phase === "approve_mapping" && !run.mappingApprovedAt) {
        throw new Error("Pipeline paused at approve_mapping. Call approveMapping() to continue.");
      }
      await this.runPhase(runId, phase);
    }
  }

  // --- Phase implementations ---

  private async phaseIngest(run: MigrationRun): Promise<void> {
    await this.updateRun(run.id, { status: "Ingesting", currentPhase: "ingest" });

    const progress = JSON.parse(run.progress || "{}");
    const ingestInput: IngestInput = {
      runId: run.id,
      vendor: run.sourceVendor,
      credentials: progress.credentials,
      encryptedCredentials: progress.encryptedCredentials,
      emrUrl: progress.emrUrl,
      uploadedFiles: progress.uploadedFiles,
    };

    const result = await executeIngest(ingestInput, this.store, this.provider);

    await this.updateRun(run.id, {
      status: "Ingested",
      artifactManifest: JSON.stringify(result.artifacts),
      progress: JSON.stringify({
        ...progress,
        ingestResult: {
          strategy: result.strategy,
          entityCounts: result.entityCounts,
        },
      }),
    });

    // Persist artifact refs to DB
    for (const artifact of result.artifacts) {
      await prisma.migrationArtifact.upsert({
        where: { runId_key: { runId: run.id, key: artifact.key } },
        create: {
          runId: run.id,
          key: artifact.key,
          hash: artifact.hash,
          sizeBytes: artifact.sizeBytes,
          storedAt: artifact.storedAt,
        },
        update: {
          hash: artifact.hash,
          sizeBytes: artifact.sizeBytes,
          storedAt: artifact.storedAt,
        },
      });
    }
  }

  private async phaseProfile(run: MigrationRun): Promise<void> {
    await this.updateRun(run.id, { status: "Profiling", currentPhase: "profile" });

    const artifacts = await this.getArtifactRefs(run.id);
    const result = await executeProfile(
      { runId: run.id, vendor: run.sourceVendor, tenantId: run.clinicId, artifacts },
      this.store
    );

    await this.updateRun(run.id, {
      status: "Profiled",
      sourceProfile: JSON.stringify(result.profile),
      phiClassification: JSON.stringify(result.profile.phiClassification),
    });
  }

  private async phaseDraftMapping(run: MigrationRun): Promise<void> {
    await this.updateRun(run.id, { status: "DraftingMapping", currentPhase: "draft_mapping" });

    const profile: SourceProfile = JSON.parse(run.sourceProfile || "{}");
    const result = await executeDraftMapping({ runId: run.id, profile });

    const version = run.mappingSpecVersion + 1;

    // Persist mapping spec
    await prisma.migrationMappingSpec.create({
      data: {
        runId: run.id,
        version,
        spec: JSON.stringify(result.mappingSpec),
      },
    });

    await this.updateRun(run.id, {
      status: "MappingDrafted",
      mappingSpecVersion: version,
    });
  }

  private async phaseTransform(run: MigrationRun): Promise<void> {
    await this.updateRun(run.id, { status: "Transforming", currentPhase: "transform" });

    if (!run.mappingApprovedAt) {
      throw new Error("Cannot transform without approved mapping");
    }

    const artifacts = await this.getArtifactRefs(run.id);
    const mappingSpecRecord = await prisma.migrationMappingSpec.findFirst({
      where: { runId: run.id, version: run.mappingSpecVersion },
    });

    if (!mappingSpecRecord) {
      throw new Error("Mapping spec not found");
    }

    const mappingSpec: MappingSpec = JSON.parse(mappingSpecRecord.spec);
    const result = await executeTransform(
      {
        runId: run.id,
        vendor: run.sourceVendor,
        tenantId: run.clinicId,
        artifacts,
        mappingSpec,
      },
      this.store
    );

    const progress = JSON.parse(run.progress || "{}");
    await this.updateRun(run.id, {
      status: "Transformed",
      progress: JSON.stringify({
        ...progress,
        transformResult: { counts: result.counts },
        // Store records in progress for subsequent phases
        _transformedRecords: result.records,
      }),
    });
  }

  private async phaseValidate(run: MigrationRun): Promise<void> {
    await this.updateRun(run.id, { status: "Validating", currentPhase: "validate" });

    const progress = JSON.parse(run.progress || "{}");
    const records = progress._transformedRecords;

    if (!records || records.length === 0) {
      throw new Error("No transformed records to validate");
    }

    const result = executeValidate({ records });

    if (!result.passed) {
      const errorSummary = `${result.report.invalidRecords} invalid records, ${result.referentialErrors.length} referential errors`;
      await this.auditEvent(run.id, "validate", "VALIDATION_FAILED", {
        invalidRecords: result.report.invalidRecords,
        referentialErrors: result.referentialErrors.length,
        errorsByCode: result.report.errorsByCode,
      });
      throw new Error(`Validation failed: ${errorSummary}`);
    }

    await this.updateRun(run.id, {
      status: "Validated",
      progress: JSON.stringify({
        ...progress,
        validateResult: {
          report: result.report,
          samplingPacket: result.samplingPacket,
        },
      }),
    });
  }

  private async phaseLoad(run: MigrationRun): Promise<void> {
    await this.updateRun(run.id, { status: "Loading", currentPhase: "load" });

    const progress = JSON.parse(run.progress || "{}");
    const records = progress._transformedRecords;

    const loadResult = await executeLoad({
      runId: run.id,
      clinicId: run.clinicId,
      records,
    });

    // Promote staged records to domain tables
    const promoteResult = await executePromote(run.id, run.clinicId);

    await this.updateRun(run.id, {
      status: "Loaded",
      progress: JSON.stringify({
        ...progress,
        loadResult: {
          staged: loadResult.staged,
          promoted: promoteResult.promoted,
          errors: [...loadResult.errors, ...promoteResult.errors],
        },
        // Clean up large data from progress
        _transformedRecords: undefined,
      }),
    });
  }

  private async phaseReconcile(run: MigrationRun): Promise<void> {
    await this.updateRun(run.id, { status: "Reconciling", currentPhase: "reconcile" });

    const profile: SourceProfile = JSON.parse(run.sourceProfile || "{}");
    const report = await executeReconcile({ runId: run.id, sourceProfile: profile });

    const progress = JSON.parse(run.progress || "{}");
    await this.updateRun(run.id, {
      status: "Completed",
      completedAt: new Date(),
      progress: JSON.stringify({
        ...progress,
        report,
      }),
    });
  }

  // --- Helpers ---

  private async getRun(runId: string): Promise<MigrationRun> {
    const run = await prisma.migrationRun.findUnique({ where: { id: runId } });
    if (!run) throw new Error(`Migration run ${runId} not found`);
    return run;
  }

  private async updateRun(runId: string, data: Record<string, unknown>): Promise<void> {
    await prisma.migrationRun.update({ where: { id: runId }, data: data as never });
  }

  private async getArtifactRefs(runId: string): Promise<ArtifactRef[]> {
    const artifacts = await prisma.migrationArtifact.findMany({
      where: { runId },
    });
    return artifacts.map((a) => ({
      runId: a.runId,
      key: a.key,
      hash: a.hash,
      sizeBytes: a.sizeBytes,
      storedAt: a.storedAt,
    }));
  }

  private async auditEvent(
    runId: string,
    phase: string,
    action: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await prisma.migrationAuditEvent.create({
      data: {
        runId,
        phase,
        action,
        actorId: "system",
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  }
}
