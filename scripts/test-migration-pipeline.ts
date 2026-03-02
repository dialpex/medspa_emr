#!/usr/bin/env npx tsx
/**
 * End-to-end migration pipeline test.
 *
 * Usage:
 *   npx tsx scripts/test-migration-pipeline.ts              # Mock provider (default)
 *   npx tsx scripts/test-migration-pipeline.ts boulevard     # Boulevard (default: 15 patients)
 *   npx tsx scripts/test-migration-pipeline.ts boulevard --limit=50
 *   npx tsx scripts/test-migration-pipeline.ts boulevard --limit=0   # unlimited
 *
 * Runs all 8 phases through the real orchestrator:
 *   Ingest → Profile → Draft Mapping → Approve → Transform → Validate → Load → Reconcile
 */

import * as readline from "readline";
import { PrismaClient } from "@prisma/client";
import { LocalArtifactStore } from "../lib/migration/storage/local-store";
import { MockMigrationProvider } from "../lib/migration/providers/mock";
import { BoulevardProvider } from "../lib/migration/providers/boulevard";
import { MigrationOrchestrator } from "../lib/migration/pipeline/orchestrator";
import type { MigrationProvider, MigrationCredentials } from "../lib/migration/providers/types";

const prisma = new PrismaClient();

// --- Credential helpers ---

function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) {
      // Hide password input
      process.stdout.write(question);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      if (stdin.setRawMode) stdin.setRawMode(true);
      let input = "";
      const onData = (ch: Buffer) => {
        const c = ch.toString();
        if (c === "\n" || c === "\r") {
          stdin.removeListener("data", onData);
          if (stdin.setRawMode) stdin.setRawMode(wasRaw ?? false);
          process.stdout.write("\n");
          rl.close();
          resolve(input);
        } else if (c === "\u0003") {
          process.exit(0);
        } else if (c === "\u007F" || c === "\b") {
          input = input.slice(0, -1);
        } else {
          input += c;
        }
      };
      stdin.on("data", onData);
    } else {
      rl.question(question, (answer) => { rl.close(); resolve(answer); });
    }
  });
}

async function setupMock(): Promise<{ provider: MigrationProvider; vendor: string; credentials: MigrationCredentials }> {
  return {
    provider: new MockMigrationProvider(),
    vendor: "mock",
    credentials: { email: "admin@clinic.com", password: "test-password" },
  };
}

async function setupBoulevard(): Promise<{ provider: MigrationProvider; vendor: string; credentials: MigrationCredentials }> {
  const email = await prompt("Boulevard email: ");
  const password = await prompt("Boulevard password: ", true);

  const provider = new BoulevardProvider();
  const credentials: MigrationCredentials = { email, password };

  console.log("\nTesting connection...");
  const conn = await provider.testConnection(credentials);
  if (!conn.connected) {
    console.error(`Connection failed: ${conn.errorMessage}`);
    process.exit(1);
  }
  console.log(`Connected to: ${conn.businessName} (location: ${conn.locationId})\n`);

  return { provider, vendor: "boulevard", credentials };
}

// --- Pipeline execution ---

async function runPipeline(
  provider: MigrationProvider,
  vendor: string,
  credentials: MigrationCredentials,
  patientLimit?: number
) {
  const clinic = await prisma.clinic.findFirst();
  if (!clinic) { console.error("No clinic found. Run `npx prisma db seed` first."); process.exit(1); }

  const user = await prisma.user.findFirst({ where: { clinicId: clinic.id } });
  if (!user) { console.error("No user found."); process.exit(1); }

  console.log(`Clinic: ${clinic.name} (${clinic.id})`);
  console.log(`User:   ${user.name} (${user.id})\n`);

  const run = await prisma.migrationRun.create({
    data: {
      clinicId: clinic.id,
      sourceVendor: vendor,
      status: "Created",
      consentText: "I consent to migration of data for pipeline validation.",
      consentSignedAt: new Date(),
      startedById: user.id,
      startedAt: new Date(),
      progress: JSON.stringify({ credentials, ...(patientLimit ? { patientLimit } : {}) }),
    },
  });

  console.log(`MigrationRun: ${run.id}\n`);

  const store = new LocalArtifactStore("storage/migration");
  const orchestrator = new MigrationOrchestrator({
    store,
    provider,
    autoApprove: true,
  });

  const startTime = Date.now();

  try {
    // Phase 1: Ingest
    console.log("--- Phase 1: Ingest ---");
    await orchestrator.runPhase(run.id, "ingest");
    const afterIngest = await prisma.migrationRun.findUnique({ where: { id: run.id } });
    const ingestProgress = JSON.parse(afterIngest?.progress || "{}");
    console.log(`  Strategy: ${ingestProgress.ingestResult?.strategy}`);
    console.log(`  Entities:`, ingestProgress.ingestResult?.entityCounts);
    const artifactCount = await prisma.migrationArtifact.count({ where: { runId: run.id } });
    console.log(`  Artifacts: ${artifactCount}\n`);

    // Phase 2: Profile
    console.log("--- Phase 2: Profile ---");
    await orchestrator.runPhase(run.id, "profile");
    const afterProfile = await prisma.migrationRun.findUnique({ where: { id: run.id } });
    const profile = JSON.parse(afterProfile?.sourceProfile || "{}");
    for (const entity of profile.entities || []) {
      console.log(`  ${entity.type}: ${entity.recordCount} records, ${entity.fields?.length || 0} fields`);
    }
    console.log();

    // Phase 3: Draft Mapping
    console.log("--- Phase 3: Draft Mapping ---");
    await orchestrator.runPhase(run.id, "draft_mapping");
    const afterMapping = await prisma.migrationRun.findUnique({ where: { id: run.id } });
    const mappingSpec = await prisma.migrationMappingSpec.findFirst({
      where: { runId: run.id, version: afterMapping?.mappingSpecVersion || 1 },
    });
    const spec = JSON.parse(mappingSpec?.spec || "{}");
    console.log(`  Version: ${afterMapping?.mappingSpecVersion}`);
    for (const em of spec.entityMappings || []) {
      console.log(`  ${em.sourceEntity} → ${em.targetEntity}: ${em.fieldMappings?.length || 0} fields`);
    }
    console.log();

    // Phase 4: Approve
    console.log("--- Phase 4: Approve Mapping ---");
    await orchestrator.approveMapping(run.id, user.id);
    console.log(`  Approved by: ${user.name}\n`);

    // Phase 5: Transform
    console.log("--- Phase 5: Transform ---");
    await orchestrator.runPhase(run.id, "transform");
    const afterTransform = await prisma.migrationRun.findUnique({ where: { id: run.id } });
    const transformProgress = JSON.parse(afterTransform?.progress || "{}");
    console.log(`  Counts:`, transformProgress.transformResult?.counts, "\n");

    // Phase 6: Validate
    console.log("--- Phase 6: Validate ---");
    let validationPassed = true;
    try {
      await orchestrator.runPhase(run.id, "validate");
    } catch {
      validationPassed = false;
    }
    const afterValidate = await prisma.migrationRun.findUnique({ where: { id: run.id } });
    const valProgress = JSON.parse(afterValidate?.progress || "{}");
    const valReport = valProgress.validateResult?.report;
    if (valReport) {
      console.log(`  Valid: ${valReport.validRecords}  Invalid: ${valReport.invalidRecords}`);
      if (valReport.referentialErrors?.length > 0) {
        console.log(`  Referential errors: ${valReport.referentialErrors.length}`);
        // Group referential errors by entity type
        const refByEntity: Record<string, number> = {};
        for (const re of valReport.referentialErrors) {
          refByEntity[re.entityType] = (refByEntity[re.entityType] || 0) + 1;
        }
        console.log(`  Referential errors by entity:`, refByEntity);
        for (const re of valReport.referentialErrors.slice(0, 5)) {
          console.log(`    ${re.entityType}: ${re.field} — ${re.message}`);
        }
      }
      if (valReport.invalidRecords > 0) {
        console.log(`  Errors by entity:`, valReport.errorsByEntity);
        for (const err of (valReport.errors || []).slice(0, 10)) {
          console.log(`    [${err.code}] ${err.entityType}.${err.field}: ${err.message}`);
        }
      }
    } else if (!validationPassed) {
      // Validation threw before saving report — run inline to show errors
      const p = JSON.parse(afterValidate?.progress || "{}");
      if (p._transformedRecords) {
        const { validateBatch, validateReferentialIntegrity } = await import("../lib/migration/canonical/validators");
        const batchInput = p._transformedRecords.map((r: any) => ({ entityType: r.entityType, record: r.record }));
        const br = validateBatch(batchInput);
        const re = validateReferentialIntegrity(batchInput);
        console.log(`  Valid: ${br.validRecords}  Invalid: ${br.invalidRecords}  Referential: ${re.length}`);
        if (re.length > 0) {
          const refByEntity: Record<string, number> = {};
          for (const r of re) {
            refByEntity[r.entityType] = (refByEntity[r.entityType] || 0) + 1;
          }
          console.log(`  Referential errors by entity:`, refByEntity);
          for (const r of re.slice(0, 5)) {
            console.log(`    ${r.entityType}: ${r.field} — ${r.message}`);
          }
        }
        console.log(`  Errors by entity:`, br.errorsByEntity);
        for (const err of br.errors.slice(0, 10)) {
          console.log(`    [${err.code}] ${err.entityType}.${err.field}: ${err.message}`);
        }
      }
    }
    console.log();

    if (!validationPassed) {
      console.error("=== VALIDATION FAILED — aborting before load phase ===");
      await prisma.$disconnect();
      process.exit(1);
    }

    // Phase 7: Load
    console.log("--- Phase 7: Load ---");
    await orchestrator.runPhase(run.id, "load");
    const afterLoad = await prisma.migrationRun.findUnique({ where: { id: run.id } });
    const loadProgress = JSON.parse(afterLoad?.progress || "{}");
    console.log(`  Staged: ${loadProgress.loadResult?.staged}  Promoted: ${loadProgress.loadResult?.promoted}`);
    if (loadProgress.loadResult?.errors?.length > 0) {
      console.log(`  Errors: ${loadProgress.loadResult.errors.length}`);
      for (const err of loadProgress.loadResult.errors.slice(0, 5)) {
        console.log(`    ${err.entityType}/${err.canonicalId}: ${err.error}`);
      }
    }
    console.log();

    // Phase 8: Reconcile
    console.log("--- Phase 8: Reconcile ---");
    await orchestrator.runPhase(run.id, "reconcile");
    const finalRun = await prisma.migrationRun.findUnique({ where: { id: run.id } });
    const finalProgress = JSON.parse(finalRun?.progress || "{}");
    const migrationReport = finalProgress.report;

    // Reconciliation table
    console.log();
    console.log("  ┌─────────────────┬────────┬────────┬──────────┬────────┬───────────┐");
    console.log("  │ Entity          │ Source │ Staged │ Promoted │ Failed │ Match Rate│");
    console.log("  ├─────────────────┼────────┼────────┼──────────┼────────┼───────────┤");
    for (const entry of migrationReport?.reconciliation || []) {
      console.log(
        `  │ ${entry.entityType.padEnd(15)} │ ${String(entry.sourceCount).padStart(6)} │ ${String(entry.stagedCount).padStart(6)} │ ${String(entry.promotedCount).padStart(8)} │ ${String(entry.failedCount).padStart(6)} │ ${String(entry.matchRate + "%").padStart(9)} │`
      );
    }
    console.log("  └─────────────────┴────────┴────────┴──────────┴────────┴───────────┘");

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log();
    console.log(`  Source: ${migrationReport?.totalSourceRecords}  Staged: ${migrationReport?.totalStagedRecords}  Promoted: ${migrationReport?.totalPromotedRecords}  Failed: ${migrationReport?.totalFailedRecords}`);
    console.log(`  Completeness: ${migrationReport?.overallCompleteness}%  Status: ${migrationReport?.status}`);

    // Audit trail summary
    const auditCount = await prisma.migrationAuditEvent.count({ where: { runId: run.id } });
    console.log(`  Audit events: ${auditCount}`);

    // Promoted patients
    const newPatients = await prisma.patient.count({ where: { clinicId: clinic.id } });
    console.log(`  Total patients in clinic: ${newPatients}`);

    console.log(`\n=== Completed in ${elapsed}s | Run: ${run.id} | Status: ${finalRun?.status} ===`);

  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\n=== FAILED after ${elapsed}s ===`);
    console.error(error instanceof Error ? error.message : error);

    const failedRun = await prisma.migrationRun.findUnique({ where: { id: run.id } });
    console.error(`Run: ${run.id}  Status: ${failedRun?.status}  Phase: ${failedRun?.currentPhase}`);

    const auditEvents = await prisma.migrationAuditEvent.findMany({
      where: { runId: run.id },
      orderBy: { createdAt: "asc" },
    });
    console.error(`Audit trail (${auditEvents.length}):`);
    for (const event of auditEvents) {
      console.error(`  [${event.phase}] ${event.action}`);
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const vendor = args.find((a) => !a.startsWith("--")) || "mock";

  // Parse --limit=N (0 means unlimited)
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const parsedLimit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;

  // Default: 15 for boulevard, unlimited for mock
  const patientLimit =
    parsedLimit !== undefined
      ? parsedLimit || undefined // --limit=0 → undefined (unlimited)
      : vendor.toLowerCase() === "boulevard"
        ? 15
        : undefined;

  const limitLabel = patientLimit ? `limit=${patientLimit}` : "unlimited";
  console.log(`=== Migration Pipeline E2E Test (${vendor}, ${limitLabel}) ===\n`);

  let setup: { provider: MigrationProvider; vendor: string; credentials: MigrationCredentials };

  switch (vendor.toLowerCase()) {
    case "boulevard":
      setup = await setupBoulevard();
      break;
    case "mock":
    default:
      setup = await setupMock();
      break;
  }

  await runPipeline(setup.provider, setup.vendor, setup.credentials, patientLimit);
}

main();
