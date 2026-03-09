#!/usr/bin/env npx tsx
/**
 * E2E Migration Pilot — runs the production orchestrator pipeline with a patient limit.
 *
 * This exercises the identical code path as clicking "Approve & Start Migration" in the UI:
 *   1. Setup: Find/create clinic + owner user in dev.db
 *   2. Create MigrationRun (with credentials)
 *   3. Run orchestrator: Ingest → Profile → Draft Mapping → [auto-approve] → Transform → Validate → Load → Reconcile
 *   4. Report: Print final reconciliation
 *
 * Usage:
 *   BOULEVARD_EMAIL=... BOULEVARD_PASSWORD=... npx tsx scripts/test-migration-e2e.ts --limit=5
 *
 * Requires:
 *   - BOULEVARD_EMAIL, BOULEVARD_PASSWORD (source credentials)
 *   - MIGRATION_ENCRYPTION_KEY (for credential encryption, or auto-generated)
 *   - ANTHROPIC_API_KEY or OPENAI_API_KEY (for AI classification/inference)
 */

import * as readline from "readline";
import { randomBytes } from "crypto";
import { BoulevardProvider } from "../lib/migration/providers/boulevard";
import type { MigrationCredentials } from "../lib/migration/providers/types";
import { MigrationOrchestrator } from "../lib/migration/pipeline/orchestrator";
import { LocalArtifactStore } from "../lib/migration/storage/local-store";
import { prisma } from "../lib/prisma";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) {
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

function hr(label?: string) {
  const line = "=".repeat(60);
  if (label) {
    console.log(`\n${line}\n  ${label}\n${line}`);
  } else {
    console.log(line);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const patientLimit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 5;

  // Ensure encryption key exists (generate ephemeral one for dev scripts)
  if (!process.env.MIGRATION_ENCRYPTION_KEY) {
    process.env.MIGRATION_ENCRYPTION_KEY = randomBytes(32).toString("hex");
    console.log("(auto-generated MIGRATION_ENCRYPTION_KEY for this run)\n");
  }

  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const llmLabel = hasAnthropic ? "Anthropic" : hasOpenAI ? "OpenAI" : "NONE (heuristic/mock only)";

  hr("E2E Migration Pilot (Orchestrator)");
  console.log(`  Patient limit : ${patientLimit}`);
  console.log(`  LLM provider  : ${llmLabel}`);
  console.log(`  Source vendor  : Boulevard`);
  console.log(`  Pipeline       : 8-phase orchestrator`);

  // -----------------------------------------------------------------------
  // Step 1: Authenticate to Boulevard
  // -----------------------------------------------------------------------
  hr("Step 1: Connect to Boulevard");

  const email = process.env.BOULEVARD_EMAIL || await prompt("Boulevard email: ");
  const password = process.env.BOULEVARD_PASSWORD || await prompt("Boulevard password: ", true);

  const provider = new BoulevardProvider();
  const credentials: MigrationCredentials = { email, password };

  console.log("Testing connection...");
  const conn = await provider.testConnection(credentials);
  if (!conn.connected) {
    console.error(`Connection FAILED: ${conn.errorMessage}`);
    process.exit(1);
  }
  console.log(`Connected to: ${conn.businessName}`);
  if (conn.locationId) console.log(`Location ID: ${conn.locationId}`);

  // -----------------------------------------------------------------------
  // Step 2: Find clinic & owner in dev.db
  // -----------------------------------------------------------------------
  hr("Step 2: Find clinic & owner");

  const clinic = await prisma.clinic.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!clinic) {
    console.error("No clinic found in dev.db. Run `npx prisma db seed` first.");
    process.exit(1);
  }
  console.log(`Using clinic: ${clinic.name} (${clinic.id})`);

  const owner = await prisma.user.findFirst({
    where: { clinicId: clinic.id, role: "Owner" },
  });

  if (!owner) {
    console.error("No owner found for clinic. Run `npx prisma db seed` first.");
    process.exit(1);
  }
  console.log(`Using owner: ${owner.name} (${owner.id})`);

  // -----------------------------------------------------------------------
  // Step 3: Create MigrationRun
  // -----------------------------------------------------------------------
  hr("Step 3: Create MigrationRun");

  const run = await prisma.migrationRun.create({
    data: {
      clinicId: clinic.id,
      sourceVendor: "boulevard",
      status: "Created",
      startedById: owner.id,
      startedAt: new Date(),
      progress: JSON.stringify({
        credentials,
        patientLimit,
      }),
    },
  });
  console.log(`Created MigrationRun: ${run.id}`);

  // -----------------------------------------------------------------------
  // Step 4: Run Orchestrator (all 8 phases)
  // -----------------------------------------------------------------------
  hr(`Step 4: Run Orchestrator (limit=${patientLimit})`);

  const store = new LocalArtifactStore();
  const orchestrator = new MigrationOrchestrator({
    store,
    provider,
    autoApprove: true,
  });

  console.log("Starting 8-phase pipeline...\n");
  const startTime = Date.now();

  try {
    const report = await orchestrator.runFull(run.id);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nPipeline completed in ${elapsed}s`);

    // -----------------------------------------------------------------------
    // Step 5: Print Results
    // -----------------------------------------------------------------------
    hr("Step 5: Results");

    console.log(`Status: ${report.status}`);
    console.log(`Completeness: ${report.overallCompleteness}%\n`);

    console.log("Reconciliation:");
    for (const entry of report.reconciliation) {
      console.log(
        `  ${entry.entityType.padEnd(15)} source=${String(entry.sourceCount).padStart(4)}  staged=${String(entry.stagedCount).padStart(4)}  promoted=${String(entry.promotedCount).padStart(4)}  failed=${String(entry.failedCount).padStart(4)}  match=${entry.matchRate}%`
      );
    }

    console.log(`\nTotal: ${report.totalSourceRecords} source → ${report.totalPromotedRecords} promoted, ${report.totalFailedRecords} failed`);

    if (report.unresolvedExceptions > 0) {
      console.log(`\n⚠ ${report.unresolvedExceptions} unresolved exceptions — review audit events`);
    }
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\nPipeline FAILED after ${elapsed}s: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Query actual DB counts for the clinic
  hr("DB Counts");

  const [patients, appointments, charts, services, photos, consents, documents, invoices] = await Promise.all([
    prisma.patient.count({ where: { clinicId: clinic.id } }),
    prisma.appointment.count({ where: { clinicId: clinic.id } }),
    prisma.chart.count({ where: { clinicId: clinic.id, deletedAt: null } }),
    prisma.service.count({ where: { clinicId: clinic.id } }),
    prisma.photo.count({ where: { clinicId: clinic.id } }),
    prisma.patientConsent.count({ where: { clinicId: clinic.id } }),
    prisma.patientDocument.count({ where: { clinicId: clinic.id } }),
    prisma.invoice.count({ where: { clinicId: clinic.id } }),
  ]);

  console.log(`  Patients     : ${patients}`);
  console.log(`  Services     : ${services}`);
  console.log(`  Appointments : ${appointments}`);
  console.log(`  Charts       : ${charts}`);
  console.log(`  Photos       : ${photos}`);
  console.log(`  Consents     : ${consents}`);
  console.log(`  Documents    : ${documents}`);
  console.log(`  Invoices     : ${invoices}`);

  // Print audit events summary
  const auditEvents = await prisma.migrationAuditEvent.findMany({
    where: { runId: run.id },
    orderBy: { createdAt: "asc" },
    select: { phase: true, action: true, createdAt: true },
  });

  if (auditEvents.length > 0) {
    hr("Audit Trail");
    for (const event of auditEvents) {
      const ts = event.createdAt.toISOString().substring(11, 19);
      console.log(`  [${ts}] ${event.phase}: ${event.action}`);
    }
  }

  hr("Done");
  console.log(`\nOpen the app (npm run dev) and check the Patient Directory to verify imported data.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
