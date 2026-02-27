import { prisma } from "@/lib/prisma";
import type { MigrationJob, MigrationEntityType } from "@prisma/client";
import type { MigrationProvider, MigrationCredentials } from "./providers/types";
import { decrypt } from "./crypto";
import { detectDuplicate } from "./duplicate-detector";

const BATCH_SIZE = 50;

interface MappingConfig {
  mappings: Array<{
    sourceId: string;
    sourceName: string;
    action: "map_existing" | "create_new" | "skip";
    targetId: string | null;
    targetName: string | null;
  }>;
}

interface EntityProgress {
  [key: string]: { total: number; imported: number; skipped: number; failed: number };
}

function decryptCredentials(job: MigrationJob): MigrationCredentials {
  if (!job.credentialsEncrypted) {
    throw new Error("No encrypted credentials on migration job");
  }
  return JSON.parse(decrypt(job.credentialsEncrypted));
}

function parseCheckpoint(job: MigrationJob): Record<string, string | undefined> {
  return job.lastCheckpoint ? JSON.parse(job.lastCheckpoint) : {};
}

function parseProgress(job: MigrationJob): EntityProgress {
  return JSON.parse(job.progress);
}

function parseMappingConfig(job: MigrationJob): MappingConfig {
  if (!job.mappingConfig) throw new Error("No mapping config on migration job");
  return JSON.parse(job.mappingConfig);
}

async function appendAgentLog(jobId: string, message: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}`;

  const job = await prisma.migrationJob.findUnique({
    where: { id: jobId },
    select: { agentLog: true },
  });

  const existing = job?.agentLog || "";
  await prisma.migrationJob.update({
    where: { id: jobId },
    data: { agentLog: existing ? `${existing}\n${logEntry}` : logEntry },
  });
}

async function saveCheckpoint(
  jobId: string,
  entityType: string,
  cursor: string | undefined,
  progress: EntityProgress
) {
  const job = await prisma.migrationJob.findUnique({
    where: { id: jobId },
    select: { lastCheckpoint: true },
  });
  const checkpoint = job?.lastCheckpoint ? JSON.parse(job.lastCheckpoint) : {};
  checkpoint[entityType] = cursor;

  await prisma.migrationJob.update({
    where: { id: jobId },
    data: {
      lastCheckpoint: JSON.stringify(checkpoint),
      progress: JSON.stringify(progress),
    },
  });
}

async function createEntityMap(
  jobId: string,
  entityType: MigrationEntityType,
  sourceId: string,
  targetId: string
) {
  await prisma.migrationEntityMap.upsert({
    where: { jobId_entityType_sourceId: { jobId, entityType, sourceId } },
    create: { jobId, entityType, sourceId, targetId },
    update: { targetId },
  });
}

async function logMigration(
  jobId: string,
  entityType: MigrationEntityType,
  sourceId: string,
  targetId: string | null,
  status: string,
  aiReasoning?: string,
  errorMessage?: string,
  rawData?: unknown
) {
  await prisma.migrationLog.create({
    data: {
      jobId,
      entityType,
      sourceId,
      targetId,
      status,
      aiReasoning,
      errorMessage,
      rawData: rawData ? JSON.stringify(rawData) : null,
    },
  });
}

/**
 * Check if migration is paused. Returns true if job should stop.
 */
async function isPaused(jobId: string): Promise<boolean> {
  const job = await prisma.migrationJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  });
  return job?.status === "Paused";
}

/**
 * Resolve a source ID to a Neuvvia ID using the entity map.
 */
async function resolveSourceId(
  jobId: string,
  entityType: MigrationEntityType,
  sourceId: string
): Promise<string | null> {
  const map = await prisma.migrationEntityMap.findUnique({
    where: { jobId_entityType_sourceId: { jobId, entityType, sourceId } },
  });
  return map?.targetId ?? null;
}

// ============================================================
// Entity Import Functions
// ============================================================

async function importServices(
  job: MigrationJob,
  provider: MigrationProvider,
  credentials: MigrationCredentials,
  progress: EntityProgress
) {
  const mapping = parseMappingConfig(job);
  await appendAgentLog(job.id, "Importing services...");
  progress.Service = { total: mapping.mappings.length, imported: 0, skipped: 0, failed: 0 };

  for (const svcMapping of mapping.mappings) {
    if (await isPaused(job.id)) return;

    try {
      if (svcMapping.action === "skip") {
        progress.Service.skipped++;
        await logMigration(job.id, "Service", svcMapping.sourceId, null, "skipped", "Marked as skip in mapping");
        continue;
      }

      if (svcMapping.action === "map_existing" && svcMapping.targetId) {
        // Map to existing service — just record the mapping
        await createEntityMap(job.id, "Service", svcMapping.sourceId, svcMapping.targetId);
        progress.Service.imported++;
        await logMigration(
          job.id, "Service", svcMapping.sourceId, svcMapping.targetId,
          "imported", `Mapped to existing service "${svcMapping.targetName}"`
        );
        continue;
      }

      // create_new — fetch source service details and create in Neuvvia
      const sourceServices = await provider.fetchServices(credentials);
      const sourceSvc = sourceServices.data.find((s) => s.sourceId === svcMapping.sourceId);

      if (!sourceSvc) {
        progress.Service.failed++;
        await logMigration(job.id, "Service", svcMapping.sourceId, null, "failed", undefined, "Source service not found");
        continue;
      }

      const newService = await prisma.service.create({
        data: {
          clinicId: job.clinicId,
          name: sourceSvc.name,
          description: sourceSvc.description,
          duration: sourceSvc.duration ?? 30,
          price: sourceSvc.price ?? 0,
          category: sourceSvc.category,
          isActive: sourceSvc.isActive,
        },
      });

      await createEntityMap(job.id, "Service", svcMapping.sourceId, newService.id);
      progress.Service.imported++;
      await logMigration(
        job.id, "Service", svcMapping.sourceId, newService.id,
        "imported", `Created new service "${sourceSvc.name}"`, undefined, sourceSvc.rawData
      );
      await appendAgentLog(job.id, `Created new service "${sourceSvc.name}"`);
    } catch (err) {
      progress.Service.failed++;
      await logMigration(
        job.id, "Service", svcMapping.sourceId, null,
        "failed", undefined, err instanceof Error ? err.message : String(err)
      );
    }
  }

  await saveCheckpoint(job.id, "Service", undefined, progress);
  await appendAgentLog(
    job.id,
    `Services complete: ${progress.Service.imported} imported, ${progress.Service.skipped} skipped, ${progress.Service.failed} failed`
  );
}

async function importPatients(
  job: MigrationJob,
  provider: MigrationProvider,
  credentials: MigrationCredentials,
  progress: EntityProgress
) {
  await appendAgentLog(job.id, "Importing patients...");
  const checkpoint = parseCheckpoint(job);
  let cursor = checkpoint.Patient;
  let totalProcessed = 0;

  progress.Patient = progress.Patient || { total: 0, imported: 0, skipped: 0, failed: 0 };

  while (true) {
    if (await isPaused(job.id)) return;

    const batch = await provider.fetchPatients(credentials, { limit: BATCH_SIZE, cursor });
    if (batch.data.length === 0) break;

    if (batch.totalCount) progress.Patient.total = batch.totalCount;

    for (const patient of batch.data) {
      try {
        // Check for duplicates
        const dupResult = await detectDuplicate(job.clinicId, patient);

        if (dupResult.isDuplicate && dupResult.existingPatientId) {
          await createEntityMap(job.id, "Patient", patient.sourceId, dupResult.existingPatientId);
          progress.Patient.skipped++;
          await logMigration(
            job.id, "Patient", patient.sourceId, dupResult.existingPatientId,
            "duplicate", dupResult.reasoning, undefined, patient.rawData
          );
          await appendAgentLog(
            job.id,
            `Skipped "${patient.firstName} ${patient.lastName}" — ${dupResult.reasoning}`
          );
          continue;
        }

        // Create new patient
        const newPatient = await prisma.patient.create({
          data: {
            clinicId: job.clinicId,
            firstName: patient.firstName,
            lastName: patient.lastName,
            email: patient.email?.toLowerCase(),
            phone: patient.phone,
            dateOfBirth: patient.dateOfBirth ? new Date(patient.dateOfBirth) : undefined,
            gender: patient.gender,
            address: patient.address,
            city: patient.city,
            state: patient.state,
            zipCode: patient.zipCode,
            allergies: patient.allergies,
            medicalNotes: patient.medicalNotes,
            tags: patient.tags?.join(","),
          },
        });

        await createEntityMap(job.id, "Patient", patient.sourceId, newPatient.id);
        progress.Patient.imported++;
        await logMigration(
          job.id, "Patient", patient.sourceId, newPatient.id,
          "imported", "New patient created", undefined, patient.rawData
        );
      } catch (err) {
        progress.Patient.failed++;
        await logMigration(
          job.id, "Patient", patient.sourceId, null,
          "failed", undefined, err instanceof Error ? err.message : String(err), patient.rawData
        );
      }
    }

    totalProcessed += batch.data.length;
    cursor = batch.nextCursor;
    await saveCheckpoint(job.id, "Patient", cursor, progress);
    await appendAgentLog(job.id, `Patients: ${totalProcessed} processed so far...`);

    if (!batch.nextCursor) break;
  }

  await appendAgentLog(
    job.id,
    `Patients complete: ${progress.Patient.imported} imported, ${progress.Patient.skipped} skipped/duplicates, ${progress.Patient.failed} failed`
  );
}

async function importAppointments(
  job: MigrationJob,
  provider: MigrationProvider,
  credentials: MigrationCredentials,
  progress: EntityProgress
) {
  await appendAgentLog(job.id, "Importing appointments...");
  const checkpoint = parseCheckpoint(job);
  let cursor = checkpoint.Appointment;

  progress.Appointment = progress.Appointment || { total: 0, imported: 0, skipped: 0, failed: 0 };

  // We need a default provider to assign appointments to
  const defaultProvider = await prisma.user.findFirst({
    where: { clinicId: job.clinicId, role: "Provider", isActive: true },
    select: { id: true },
  });
  const fallbackProvider = await prisma.user.findFirst({
    where: { clinicId: job.clinicId, role: "Owner" },
    select: { id: true },
  });
  const providerId = defaultProvider?.id ?? fallbackProvider?.id;

  if (!providerId) {
    await appendAgentLog(job.id, "ERROR: No provider found to assign appointments to. Skipping appointments.");
    return;
  }

  while (true) {
    if (await isPaused(job.id)) return;

    const batch = await provider.fetchAppointments(credentials, { limit: BATCH_SIZE, cursor });
    if (batch.data.length === 0) break;

    if (batch.totalCount) progress.Appointment.total = batch.totalCount;

    for (const apt of batch.data) {
      try {
        // Resolve patient
        const patientId = await resolveSourceId(job.id, "Patient", apt.patientSourceId);
        if (!patientId) {
          progress.Appointment.skipped++;
          await logMigration(
            job.id, "Appointment", apt.sourceId, null,
            "skipped", `Patient ${apt.patientSourceId} not found in mapping`, undefined, apt.rawData
          );
          continue;
        }

        // Resolve service
        let serviceId: string | null = null;
        if (apt.serviceSourceId) {
          serviceId = await resolveSourceId(job.id, "Service", apt.serviceSourceId);
        }

        const startTime = new Date(apt.startTime);
        const endTime = apt.endTime ? new Date(apt.endTime) : new Date(startTime.getTime() + 30 * 60000);

        const newApt = await prisma.appointment.create({
          data: {
            clinicId: job.clinicId,
            patientId,
            providerId,
            serviceId,
            startTime,
            endTime,
            status: "Completed",
            notes: `[Imported from ${provider.source}] ${apt.notes || ""}`.trim(),
            completedAt: startTime,
          },
        });

        await createEntityMap(job.id, "Appointment", apt.sourceId, newApt.id);
        progress.Appointment.imported++;
        await logMigration(
          job.id, "Appointment", apt.sourceId, newApt.id,
          "imported",
          serviceId
            ? `Mapped service and patient`
            : `Created without service mapping (service "${apt.serviceName}" not found)`,
          undefined, apt.rawData
        );
      } catch (err) {
        progress.Appointment.failed++;
        await logMigration(
          job.id, "Appointment", apt.sourceId, null,
          "failed", undefined, err instanceof Error ? err.message : String(err), apt.rawData
        );
      }
    }

    cursor = batch.nextCursor;
    await saveCheckpoint(job.id, "Appointment", cursor, progress);
    if (!batch.nextCursor) break;
  }

  await appendAgentLog(
    job.id,
    `Appointments complete: ${progress.Appointment.imported} imported, ${progress.Appointment.skipped} skipped, ${progress.Appointment.failed} failed`
  );
}

async function importCharts(
  job: MigrationJob,
  provider: MigrationProvider,
  credentials: MigrationCredentials,
  progress: EntityProgress
) {
  if (!provider.fetchCharts) {
    await appendAgentLog(job.id, "Provider does not support chart import — skipping.");
    return;
  }

  await appendAgentLog(job.id, "Importing charts...");
  const checkpoint = parseCheckpoint(job);
  let cursor = checkpoint.Chart;

  progress.Chart = progress.Chart || { total: 0, imported: 0, skipped: 0, failed: 0 };

  while (true) {
    if (await isPaused(job.id)) return;

    const batch = await provider.fetchCharts(credentials, { limit: BATCH_SIZE, cursor });
    if (batch.data.length === 0) break;

    if (batch.totalCount) progress.Chart.total = batch.totalCount;

    for (const chart of batch.data) {
      try {
        const patientId = await resolveSourceId(job.id, "Patient", chart.patientSourceId);
        if (!patientId) {
          progress.Chart.skipped++;
          await logMigration(
            job.id, "Chart", chart.sourceId, null,
            "skipped", `Patient ${chart.patientSourceId} not found in mapping`, undefined, chart.rawData
          );
          continue;
        }

        // Store chart data as a migration log entry with full raw data for future processing
        progress.Chart.imported++;
        await logMigration(
          job.id, "Chart", chart.sourceId, patientId,
          "imported",
          `Chart from ${chart.date}${chart.providerName ? ` by ${chart.providerName}` : ""}`,
          undefined, chart.rawData
        );
      } catch (err) {
        progress.Chart.failed++;
        await logMigration(
          job.id, "Chart", chart.sourceId, null,
          "failed", undefined, err instanceof Error ? err.message : String(err), chart.rawData
        );
      }
    }

    cursor = batch.nextCursor;
    await saveCheckpoint(job.id, "Chart", cursor, progress);
    if (!batch.nextCursor) break;
  }

  await appendAgentLog(
    job.id,
    `Charts complete: ${progress.Chart.imported} imported, ${progress.Chart.skipped} skipped, ${progress.Chart.failed} failed`
  );
}

async function importInvoices(
  job: MigrationJob,
  provider: MigrationProvider,
  credentials: MigrationCredentials,
  progress: EntityProgress
) {
  await appendAgentLog(job.id, "Importing invoices...");
  const checkpoint = parseCheckpoint(job);
  let cursor = checkpoint.Invoice;

  progress.Invoice = progress.Invoice || { total: 0, imported: 0, skipped: 0, failed: 0 };

  while (true) {
    if (await isPaused(job.id)) return;

    const batch = await provider.fetchInvoices(credentials, { limit: BATCH_SIZE, cursor });
    if (batch.data.length === 0) break;

    if (batch.totalCount) progress.Invoice.total = batch.totalCount;

    for (const inv of batch.data) {
      try {
        const patientId = await resolveSourceId(job.id, "Patient", inv.patientSourceId);
        if (!patientId) {
          progress.Invoice.skipped++;
          await logMigration(
            job.id, "Invoice", inv.sourceId, null,
            "skipped", `Patient ${inv.patientSourceId} not found in mapping`, undefined, inv.rawData
          );
          continue;
        }

        // Generate invoice number
        const count = await prisma.invoice.count({ where: { clinicId: job.clinicId } });
        const invoiceNumber = inv.invoiceNumber || `MIG-${String(count + 1).padStart(5, "0")}`;

        // Determine status
        const status = inv.status.toLowerCase().includes("paid") ? "Paid" as const : "Void" as const;

        const newInvoice = await prisma.invoice.create({
          data: {
            clinicId: job.clinicId,
            patientId,
            invoiceNumber,
            status,
            subtotal: inv.subtotal ?? inv.total,
            taxAmount: inv.taxAmount ?? 0,
            total: inv.total,
            notes: `[Imported from ${provider.source}] ${inv.notes || ""}`.trim(),
            paidAt: inv.paidAt ? new Date(inv.paidAt) : undefined,
          },
        });

        // Create line items
        for (const item of inv.lineItems) {
          let serviceId: string | null = null;
          if (item.serviceSourceId) {
            serviceId = await resolveSourceId(job.id, "Service", item.serviceSourceId);
          }

          await prisma.invoiceItem.create({
            data: {
              clinicId: job.clinicId,
              invoiceId: newInvoice.id,
              serviceId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
            },
          });
        }

        await createEntityMap(job.id, "Invoice", inv.sourceId, newInvoice.id);
        progress.Invoice.imported++;
        await logMigration(
          job.id, "Invoice", inv.sourceId, newInvoice.id,
          "imported", `Invoice ${invoiceNumber} created (${status})`, undefined, inv.rawData
        );
      } catch (err) {
        progress.Invoice.failed++;
        await logMigration(
          job.id, "Invoice", inv.sourceId, null,
          "failed", undefined, err instanceof Error ? err.message : String(err), inv.rawData
        );
      }
    }

    cursor = batch.nextCursor;
    await saveCheckpoint(job.id, "Invoice", cursor, progress);
    if (!batch.nextCursor) break;
  }

  await appendAgentLog(
    job.id,
    `Invoices complete: ${progress.Invoice.imported} imported, ${progress.Invoice.skipped} skipped, ${progress.Invoice.failed} failed`
  );
}

// ============================================================
// Main Pipeline Orchestrator
// ============================================================

/**
 * Execute the full migration pipeline.
 * Import order: Services → Patients → Appointments → Invoices
 * Supports pause/resume via status flag check between batches.
 */
export async function executeMigration(
  job: MigrationJob,
  provider: MigrationProvider
): Promise<void> {
  const credentials = decryptCredentials(job);
  const progress = parseProgress(job);

  await appendAgentLog(job.id, "Migration started. Import order: Services → Patients → Appointments → Charts → Invoices");

  try {
    // 1. Services (from mapping config, not pagination)
    if (!progress.Service?.imported && !progress.Service?.skipped) {
      await importServices(job, provider, credentials, progress);
      if (await isPaused(job.id)) return;
    }

    // 2. Patients
    const patientDone = progress.Patient && !parseCheckpoint(job).Patient;
    if (!patientDone) {
      await importPatients(job, provider, credentials, progress);
      if (await isPaused(job.id)) return;
    }

    // 3. Appointments
    const aptDone = progress.Appointment && !parseCheckpoint(job).Appointment;
    if (!aptDone) {
      await importAppointments(job, provider, credentials, progress);
      if (await isPaused(job.id)) return;
    }

    // 4. Charts (optional — depends on provider support)
    const chartDone = progress.Chart && !parseCheckpoint(job).Chart;
    if (!chartDone) {
      await importCharts(job, provider, credentials, progress);
      if (await isPaused(job.id)) return;
    }

    // 5. Invoices
    const invDone = progress.Invoice && !parseCheckpoint(job).Invoice;
    if (!invDone) {
      await importInvoices(job, provider, credentials, progress);
      if (await isPaused(job.id)) return;
    }

    await appendAgentLog(job.id, "All entity types imported. Migration pipeline complete.");

    await prisma.migrationJob.update({
      where: { id: job.id },
      data: { status: "Verifying", progress: JSON.stringify(progress) },
    });
  } catch (err) {
    await prisma.migrationJob.update({
      where: { id: job.id },
      data: {
        status: "Failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        progress: JSON.stringify(progress),
      },
    });
    await appendAgentLog(job.id, `ERROR: Migration failed — ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}
