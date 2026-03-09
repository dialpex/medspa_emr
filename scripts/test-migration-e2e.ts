#!/usr/bin/env npx tsx
/**
 * E2E Migration Pilot — runs the EXACT production migration pipeline with a patient limit.
 *
 * This exercises the identical code path as clicking "Approve & Start Migration" in the UI:
 *   1. Setup: Find/create clinic + owner user in dev.db
 *   2. Create MigrationJob (encrypt credentials, create DB record)
 *   3. Discovery: AI agent analyzes source data
 *   4. Mapping: AI proposes service mappings, auto-resolve all as create_new
 *   5. Execute: Full pipeline with patientLimit
 *   6. Report: Print final counts
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
import { encrypt } from "../lib/migration/crypto";
import { discoverSourceData, proposeMappings } from "../lib/agents/migration/legacy/agent";
import { executeMigration } from "../lib/migration/pipeline";
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

  hr("E2E Migration Pilot");
  console.log(`  Patient limit : ${patientLimit}`);
  console.log(`  LLM provider  : ${llmLabel}`);
  console.log(`  Source vendor  : Boulevard`);

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
  // Step 2: Setup clinic + owner in dev.db
  // -----------------------------------------------------------------------
  hr("Step 2: Find clinic & owner");

  // Use the first existing clinic (simulates a user who already has a clinic set up)
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
  // Step 3: Create MigrationJob
  // -----------------------------------------------------------------------
  hr("Step 3: Create MigrationJob");

  const encryptedCreds = encrypt(JSON.stringify(credentials));

  const job = await prisma.migrationJob.create({
    data: {
      clinicId: clinic.id,
      source: "Boulevard",
      status: "Discovering",
      credentialsEncrypted: encryptedCreds,
      connectionValidatedAt: new Date(),
      startedById: owner.id,
      startedAt: new Date(),
      progress: "{}",
    },
  });
  console.log(`Created MigrationJob: ${job.id}`);

  // Store locationId in sourceDiscovery for document fetching
  if (conn.locationId) {
    await prisma.migrationJob.update({
      where: { id: job.id },
      data: { sourceDiscovery: JSON.stringify({ locationId: conn.locationId }) },
    });
  }

  // -----------------------------------------------------------------------
  // Step 4: Discovery — AI agent analyzes source data
  // -----------------------------------------------------------------------
  hr("Step 4: Discovery");

  console.log("Running AI discovery agent...");
  const discovery = await discoverSourceData(job, provider);

  console.log(`\nDiscovery summary: ${discovery.summary}\n`);
  for (const entity of discovery.entities) {
    console.log(`  ${entity.type.padEnd(15)} ${String(entity.count).padStart(6)} records`);
  }
  if (discovery.issues.length > 0) {
    console.log(`\n  Issues:`);
    for (const issue of discovery.issues) {
      console.log(`    [${issue.severity.toUpperCase()}] ${issue.description}`);
    }
  }

  // Save discovery to job
  await prisma.migrationJob.update({
    where: { id: job.id },
    data: {
      sourceDiscovery: JSON.stringify({ ...discovery, locationId: conn.locationId }),
      status: "MappingInProgress",
    },
  });

  // -----------------------------------------------------------------------
  // Step 5: Service Mapping — AI proposes, we auto-resolve as create_new
  // -----------------------------------------------------------------------
  hr("Step 5: Service Mapping");

  // Fetch existing Neuvvia services for the clinic
  const neuvviaServices = await prisma.service.findMany({
    where: { clinicId: clinic.id },
    select: { id: true, name: true, category: true, price: true },
  });
  console.log(`Existing Neuvvia services: ${neuvviaServices.length}`);

  console.log("Running AI mapping agent...");
  const mappingResult = await proposeMappings(job, provider, neuvviaServices);

  console.log(`\nMapping results: ${mappingResult.mappings.length} services`);
  console.log(`  Auto-resolved: ${mappingResult.autoResolved}`);
  console.log(`  Needs input: ${mappingResult.needsInput}\n`);

  // Auto-resolve all as create_new for pilot (unless already mapped)
  const resolvedMappings = mappingResult.mappings.map((m) => ({
    sourceId: m.sourceId,
    sourceName: m.sourceName,
    action: m.action === "map_existing" ? "map_existing" as const : "create_new" as const,
    targetId: m.targetId,
    targetName: m.targetName,
  }));

  for (const m of resolvedMappings) {
    const action = m.action === "map_existing" ? `-> ${m.targetName}` : "(create new)";
    console.log(`  ${m.sourceName.padEnd(40)} ${action}`);
  }

  // Save mapping config to job
  await prisma.migrationJob.update({
    where: { id: job.id },
    data: {
      mappingConfig: JSON.stringify({ mappings: resolvedMappings }),
      status: "Migrating",
    },
  });

  // Reload job to get latest data
  const freshJob = await prisma.migrationJob.findUniqueOrThrow({
    where: { id: job.id },
  });

  // -----------------------------------------------------------------------
  // Step 6: Execute Migration — the real pipeline with limit
  // -----------------------------------------------------------------------
  hr(`Step 6: Execute Migration (limit=${patientLimit})`);

  console.log("Starting migration pipeline...\n");
  const startTime = Date.now();

  try {
    await executeMigration(freshJob, provider, { patientLimit });
  } catch (err) {
    console.error(`\nMigration FAILED: ${err instanceof Error ? err.message : String(err)}`);
    // Still print report below for partial results
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nMigration pipeline completed in ${elapsed}s`);

  // -----------------------------------------------------------------------
  // Step 7: Report — query DB for final counts
  // -----------------------------------------------------------------------
  hr("Step 7: Results");

  const finalJob = await prisma.migrationJob.findUniqueOrThrow({
    where: { id: job.id },
    select: { status: true, progress: true, agentLog: true },
  });

  console.log(`Job status: ${finalJob.status}\n`);

  // Parse and display progress
  const progress = JSON.parse(finalJob.progress);
  console.log("Import progress:");
  for (const [entity, counts] of Object.entries(progress) as Array<[string, { total: number; imported: number; skipped: number; failed: number }]>) {
    console.log(`  ${entity.padEnd(15)} imported=${String(counts.imported).padStart(4)}  skipped=${String(counts.skipped).padStart(4)}  failed=${String(counts.failed).padStart(4)}  total=${String(counts.total).padStart(4)}`);
  }

  // Query actual DB counts for the clinic
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

  console.log("\nDB counts for clinic:");
  console.log(`  Patients     : ${patients}`);
  console.log(`  Services     : ${services}`);
  console.log(`  Appointments : ${appointments}`);
  console.log(`  Charts       : ${charts}`);
  console.log(`  Photos       : ${photos}`);
  console.log(`  Consents     : ${consents}`);
  console.log(`  Documents    : ${documents}`);
  console.log(`  Invoices     : ${invoices}`);

  // Print agent log summary (last 20 lines)
  if (finalJob.agentLog) {
    const logLines = finalJob.agentLog.split("\n");
    const tail = logLines.slice(-20);
    console.log(`\nAgent log (last ${tail.length} of ${logLines.length} lines):`);
    for (const line of tail) {
      console.log(`  ${line}`);
    }
  }

  hr("Done");
  console.log(`\nOpen the app (npm run dev) and check the Patient Directory to verify ${patientLimit} patients with their data.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
