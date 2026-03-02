#!/usr/bin/env npx tsx
/**
 * One-shot cleanup: removes all Boulevard migration data from the dev DB.
 *
 * Steps:
 *   1. Find all MigrationRun rows with sourceVendor='boulevard'
 *   2. Trace promoted patients via CanonicalStagingRecord payloads
 *   3. Delete matched Patient rows (and their FK dependents)
 *   4. Delete MigrationRun rows (cascades artifacts, ledger, staging, specs, audit events)
 *   5. Print counts before and after
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Boulevard Data Cleanup ===\n");

  // --- Before counts ---
  const totalPatientsBefore = await prisma.patient.count();
  const totalRunsBefore = await prisma.migrationRun.count();
  const boulevardRuns = await prisma.migrationRun.findMany({
    where: { sourceVendor: "boulevard" },
    select: { id: true, clinicId: true, createdAt: true, status: true },
  });

  console.log(`Total patients before: ${totalPatientsBefore}`);
  console.log(`Total migration runs: ${totalRunsBefore}`);
  console.log(`Boulevard runs found: ${boulevardRuns.length}`);

  if (boulevardRuns.length === 0) {
    console.log("\nNo Boulevard data to clean up.");
    await prisma.$disconnect();
    return;
  }

  for (const run of boulevardRuns) {
    console.log(`  Run ${run.id} — status: ${run.status}, created: ${run.createdAt.toISOString()}`);
  }

  const runIds = boulevardRuns.map((r) => r.id);

  // --- Count cascade-owned records ---
  const artifactCount = await prisma.migrationArtifact.count({ where: { runId: { in: runIds } } });
  const stagingCount = await prisma.canonicalStagingRecord.count({ where: { runId: { in: runIds } } });
  const ledgerCount = await prisma.migrationRecordLedger.count({ where: { runId: { in: runIds } } });
  const specCount = await prisma.migrationMappingSpec.count({ where: { runId: { in: runIds } } });
  const auditCount = await prisma.migrationAuditEvent.count({ where: { runId: { in: runIds } } });

  console.log(`\nCascade-owned records:`);
  console.log(`  Artifacts:       ${artifactCount}`);
  console.log(`  Staging records: ${stagingCount}`);
  console.log(`  Ledger entries:  ${ledgerCount}`);
  console.log(`  Mapping specs:   ${specCount}`);
  console.log(`  Audit events:    ${auditCount}`);

  // --- Trace promoted patients via staging records ---
  const patientStagingRecords = await prisma.canonicalStagingRecord.findMany({
    where: {
      runId: { in: runIds },
      entityType: "patient",
      status: "promoted",
    },
    select: { payload: true },
  });

  console.log(`\nPromoted patient staging records: ${patientStagingRecords.length}`);

  // Extract identifying info from canonical payloads to match Patient rows
  const patientIdsToDelete: string[] = [];

  for (const record of patientStagingRecords) {
    const payload = JSON.parse(record.payload);
    const { firstName, lastName, email } = payload;

    // Match by email (strongest) or firstName+lastName
    let patient = null;
    if (email) {
      patient = await prisma.patient.findFirst({
        where: { email, firstName, lastName },
        select: { id: true },
      });
    }
    if (!patient && firstName && lastName) {
      patient = await prisma.patient.findFirst({
        where: { firstName, lastName },
        select: { id: true },
      });
    }

    if (patient && !patientIdsToDelete.includes(patient.id)) {
      patientIdsToDelete.push(patient.id);
    }
  }

  console.log(`Matched patients to delete: ${patientIdsToDelete.length}`);

  // --- Delete patients (must go first — no cascade from MigrationRun) ---
  if (patientIdsToDelete.length > 0) {
    // Delete FK dependents in order
    const deleteOps = [
      prisma.message.deleteMany({ where: { patientId: { in: patientIdsToDelete } } }),
      prisma.conversation.deleteMany({ where: { patientId: { in: patientIdsToDelete } } }),
      prisma.patientCommunicationPreference.deleteMany({ where: { patientId: { in: patientIdsToDelete } } }),
      prisma.patientMembership.deleteMany({ where: { patientId: { in: patientIdsToDelete } } }),
      prisma.patientDocument.deleteMany({ where: { patientId: { in: patientIdsToDelete } } }),
      prisma.patientConsent.deleteMany({ where: { patientId: { in: patientIdsToDelete } } }),
      prisma.photo.deleteMany({ where: { patientId: { in: patientIdsToDelete } } }),
      prisma.invoice.deleteMany({ where: { patientId: { in: patientIdsToDelete } } }),
    ];

    // Charts and encounters need appointment cleanup first
    // Delete encounters (FK to appointment)
    const appointments = await prisma.appointment.findMany({
      where: { patientId: { in: patientIdsToDelete } },
      select: { id: true },
    });
    const appointmentIds = appointments.map((a) => a.id);

    if (appointmentIds.length > 0) {
      await prisma.encounter.deleteMany({ where: { appointmentId: { in: appointmentIds } } });
    }

    // Run parallel deletes
    await Promise.all(deleteOps);

    // Charts (patientId is optional, so use nullable filter)
    await prisma.chart.deleteMany({ where: { patientId: { in: patientIdsToDelete } } });
    await prisma.appointment.deleteMany({ where: { patientId: { in: patientIdsToDelete } } });

    // Finally delete patients
    const deleted = await prisma.patient.deleteMany({ where: { id: { in: patientIdsToDelete } } });
    console.log(`\nDeleted ${deleted.count} patients and their related records.`);
  }

  // --- Delete MigrationRun rows (cascades all owned records) ---
  const deletedRuns = await prisma.migrationRun.deleteMany({
    where: { id: { in: runIds } },
  });
  console.log(`Deleted ${deletedRuns.count} Boulevard migration runs (+ cascaded records).`);

  // --- After counts ---
  const totalPatientsAfter = await prisma.patient.count();
  const totalRunsAfter = await prisma.migrationRun.count();

  console.log(`\n=== After Cleanup ===`);
  console.log(`Patients: ${totalPatientsBefore} → ${totalPatientsAfter} (removed ${totalPatientsBefore - totalPatientsAfter})`);
  console.log(`Migration runs: ${totalRunsBefore} → ${totalRunsAfter} (removed ${totalRunsBefore - totalRunsAfter})`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
