import { prisma } from "@/lib/prisma";
import type { MigrationJob, MigrationEntityType } from "@prisma/client";
import type { MigrationProvider, MigrationCredentials, SourceForm, FormFieldContent } from "./providers/types";
import { decrypt } from "./crypto";
import { detectDuplicate } from "./duplicate-detector";
import { classifyAndMapForms } from "./agent";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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

    // Find migration initiator for createdById
    const chartCreator = await prisma.user.findFirst({
      where: { clinicId: job.clinicId, role: "Owner" },
      select: { id: true },
    });

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

        const chartDate = new Date(chart.date);
        const chiefComplaint = chart.notes
          ? chart.notes.substring(0, 200) + (chart.notes.length > 200 ? "..." : "")
          : null;

        const newChart = await prisma.chart.create({
          data: {
            clinicId: job.clinicId,
            patientId,
            status: "MDSigned",
            chiefComplaint,
            additionalNotes: chart.notes || null,
            createdById: chartCreator?.id || null,
            signedByName: chart.providerName || null,
            signedAt: chartDate,
            createdAt: chartDate,
          },
        });

        await createEntityMap(job.id, "Chart", chart.sourceId, newChart.id);
        progress.Chart.imported++;
        await logMigration(
          job.id, "Chart", chart.sourceId, newChart.id,
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
// File Download Helper
// ============================================================

async function downloadFile(
  url: string,
  destPath: string
): Promise<{ sizeBytes: number; mimeType: string | null }> {
  const dir = path.dirname(destPath);
  await mkdir(dir, { recursive: true });

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}): ${url}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buffer);

  return {
    sizeBytes: buffer.length,
    mimeType: res.headers.get("content-type"),
  };
}

// ============================================================
// Photo, Form, Document Import Functions
// ============================================================

async function importPhotos(
  job: MigrationJob,
  provider: MigrationProvider,
  credentials: MigrationCredentials,
  progress: EntityProgress
) {
  if (!provider.fetchPhotos) {
    await appendAgentLog(job.id, "Provider does not support photo import — skipping.");
    return;
  }

  await appendAgentLog(job.id, "Importing photos...");
  progress.Photo = progress.Photo || { total: 0, imported: 0, skipped: 0, failed: 0 };

  // Find migration initiator for takenById
  const initiator = await prisma.user.findFirst({
    where: { clinicId: job.clinicId, role: "Owner" },
    select: { id: true },
  });
  if (!initiator) {
    await appendAgentLog(job.id, "ERROR: No owner found for takenById. Skipping photos.");
    return;
  }

  // Get all imported patients
  const patientMaps = await prisma.migrationEntityMap.findMany({
    where: { jobId: job.id, entityType: "Patient" },
  });

  for (const pMap of patientMaps) {
    if (await isPaused(job.id)) return;

    try {
      const result = await provider.fetchPhotos(credentials, { cursor: pMap.sourceId });
      if (result.data.length === 0) continue;

      progress.Photo.total += result.data.length;

      for (const photo of result.data) {
        try {
          const ext = photo.filename
            ? path.extname(photo.filename)
            : photo.mimeType === "image/png" ? ".png" : ".jpg";
          const generatedFilename = `${photo.sourceId}${ext}`;
          const storagePath = `storage/photos/${job.clinicId}/${pMap.targetId}/${generatedFilename}`;

          const { sizeBytes, mimeType } = await downloadFile(
            photo.url,
            path.join(process.cwd(), storagePath)
          );

          const newPhoto = await prisma.photo.create({
            data: {
              clinicId: job.clinicId,
              patientId: pMap.targetId,
              takenById: initiator.id,
              filename: photo.filename || generatedFilename,
              storagePath,
              mimeType: photo.mimeType || mimeType || "image/jpeg",
              sizeBytes,
              category: photo.label || photo.category || null,
              caption: photo.caption
                ? `${photo.caption} [Imported from ${provider.source}]`
                : `[Imported from ${provider.source}]`,
            },
          });

          await createEntityMap(job.id, "Photo", photo.sourceId, newPhoto.id);
          progress.Photo.imported++;
          await logMigration(
            job.id, "Photo", photo.sourceId, newPhoto.id,
            "imported", `Photo imported (${sizeBytes} bytes)`, undefined, photo.rawData
          );
        } catch (err) {
          progress.Photo.failed++;
          await logMigration(
            job.id, "Photo", photo.sourceId, null,
            "failed", undefined, err instanceof Error ? err.message : String(err), photo.rawData
          );
        }
      }
    } catch (err) {
      await appendAgentLog(
        job.id,
        `WARNING: Failed to fetch photos for patient ${pMap.sourceId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  await saveCheckpoint(job.id, "Photo", undefined, progress);
  await appendAgentLog(
    job.id,
    `Photos complete: ${progress.Photo.imported} imported, ${progress.Photo.skipped} skipped, ${progress.Photo.failed} failed`
  );
}

async function importForms(
  job: MigrationJob,
  provider: MigrationProvider,
  credentials: MigrationCredentials,
  progress: EntityProgress
) {
  if (!provider.fetchForms) {
    await appendAgentLog(job.id, "Provider does not support form import — skipping.");
    return;
  }

  await appendAgentLog(job.id, "Importing forms with AI classification...");
  progress.Consent = progress.Consent || { total: 0, imported: 0, skipped: 0, failed: 0 };

  // Cache for template dedup: source template name → Neuvvia ConsentTemplate ID
  const templateCache = new Map<string, string>();

  // Find chart creator for clinical_chart forms
  const chartCreator = await prisma.user.findFirst({
    where: { clinicId: job.clinicId, role: "Owner" },
    select: { id: true },
  });

  // Get all imported patients
  const patientMaps = await prisma.migrationEntityMap.findMany({
    where: { jobId: job.id, entityType: "Patient" },
  });

  for (const pMap of patientMaps) {
    if (await isPaused(job.id)) return;

    try {
      const result = await provider.fetchForms(credentials, { cursor: pMap.sourceId });
      if (result.data.length === 0) continue;

      progress.Consent.total += result.data.length;

      // Fetch form content for each form (if provider supports it)
      const formsWithContent: Array<SourceForm & { fields?: FormFieldContent[] }> = [];
      for (const form of result.data) {
        let fields: FormFieldContent[] | undefined;
        if (provider.fetchFormContent) {
          try {
            fields = await provider.fetchFormContent(credentials, form.sourceId);
            if (fields.length === 0) fields = undefined;
          } catch {
            // Content fetch failed — proceed with metadata-only
          }
        }
        formsWithContent.push({ ...form, fields });
      }

      // AI classification
      const classification = await classifyAndMapForms(formsWithContent);

      // Build lookup map
      const classMap = new Map(
        classification.classifications.map((c) => [c.formSourceId, c])
      );

      for (const form of formsWithContent) {
        const cls = classMap.get(form.sourceId);
        const formClassification = cls?.classification || "consent";

        try {
          if (formClassification === "skip") {
            progress.Consent.skipped++;
            await logMigration(
              job.id, "Consent", form.sourceId, null,
              "skipped", cls?.reasoning || "Classified as skip", undefined, form.rawData
            );
            continue;
          }

          if (formClassification === "clinical_chart" && cls?.chartData) {
            // Import as Chart + TreatmentCard
            const chartData = cls.chartData;

            // Resolve appointment if available
            let appointmentId: string | null = null;
            if (form.appointmentSourceId) {
              appointmentId = await resolveSourceId(job.id, "Appointment", form.appointmentSourceId);
            }

            // Check if chart already exists for this appointment
            let existingChart = null;
            if (appointmentId) {
              existingChart = await prisma.chart.findFirst({
                where: { appointmentId, deletedAt: null },
                select: { id: true },
              });
            }

            if (existingChart) {
              // Add treatment card to existing chart
              await prisma.treatmentCard.create({
                data: {
                  chartId: existingChart.id,
                  templateType: chartData.templateType as "Injectable" | "Laser" | "Esthetics" | "Other",
                  title: chartData.treatmentCardTitle,
                  narrativeText: chartData.narrativeText,
                  structuredData: JSON.stringify(chartData.structuredData),
                },
              });

              await createEntityMap(job.id, "Form", form.sourceId, existingChart.id);
              progress.Consent.imported++;
              await logMigration(
                job.id, "Form", form.sourceId, existingChart.id,
                "imported",
                `Clinical form "${form.templateName}" added as treatment card to existing chart`,
                undefined, form.rawData
              );
            } else {
              // Create new chart + treatment card
              const chartDate = form.submittedAt ? new Date(form.submittedAt) : new Date();

              const newChart = await prisma.chart.create({
                data: {
                  clinicId: job.clinicId,
                  patientId: pMap.targetId,
                  appointmentId: appointmentId || undefined,
                  status: "MDSigned",
                  chiefComplaint: chartData.chiefComplaint,
                  additionalNotes: chartData.narrativeText || null,
                  createdById: chartCreator?.id || null,
                  signedAt: chartDate,
                  createdAt: chartDate,
                },
              });

              await prisma.treatmentCard.create({
                data: {
                  chartId: newChart.id,
                  templateType: chartData.templateType as "Injectable" | "Laser" | "Esthetics" | "Other",
                  title: chartData.treatmentCardTitle,
                  narrativeText: chartData.narrativeText,
                  structuredData: JSON.stringify(chartData.structuredData),
                },
              });

              await createEntityMap(job.id, "Form", form.sourceId, newChart.id);
              progress.Consent.imported++;
              await logMigration(
                job.id, "Form", form.sourceId, newChart.id,
                "imported",
                `Clinical form "${form.templateName}" imported as chart with treatment card (${chartData.templateType})`,
                undefined, form.rawData
              );
              await appendAgentLog(
                job.id,
                `Created chart from clinical form "${form.templateName}" (${chartData.templateType})`
              );
            }
            continue;
          }

          // consent or intake — import as PatientConsent
          let templateId = templateCache.get(form.templateName);
          if (!templateId) {
            const existing = await prisma.consentTemplate.findFirst({
              where: { clinicId: job.clinicId, name: form.templateName },
              select: { id: true },
            });

            if (existing) {
              templateId = existing.id;
            } else {
              const newTemplate = await prisma.consentTemplate.create({
                data: {
                  clinicId: job.clinicId,
                  name: form.templateName,
                  content: `[Imported from ${provider.source}] This consent template was automatically created during data migration.`,
                  version: "1.0",
                  isActive: true,
                },
              });
              templateId = newTemplate.id;
            }
            templateCache.set(form.templateName, templateId);
          }

          // Build template snapshot with form field content if available
          const snapshotData: Record<string, unknown> = {
            importedFrom: provider.source,
            originalStatus: form.status,
            isInternal: form.isInternal,
            submittedByName: form.submittedByName,
            submittedByRole: form.submittedByRole,
            expirationDate: form.expirationDate,
            sourceTemplateId: form.templateId,
          };
          if (form.fields && form.fields.length > 0) {
            snapshotData.formFields = form.fields.map((f) => ({
              label: f.label,
              value: f.value,
              selectedOptions: f.selectedOptions,
            }));
          }
          const templateSnapshot = JSON.stringify(snapshotData);

          const newConsent = await prisma.patientConsent.create({
            data: {
              clinicId: job.clinicId,
              patientId: pMap.targetId,
              templateId,
              signedAt: form.submittedAt ? new Date(form.submittedAt) : null,
              templateSnapshot,
            },
          });

          await createEntityMap(job.id, "Consent", form.sourceId, newConsent.id);
          progress.Consent.imported++;
          await logMigration(
            job.id, "Consent", form.sourceId, newConsent.id,
            "imported",
            `Form "${form.templateName}" imported as ${formClassification}`,
            undefined, form.rawData
          );
        } catch (err) {
          progress.Consent.failed++;
          await logMigration(
            job.id, "Consent", form.sourceId, null,
            "failed", undefined, err instanceof Error ? err.message : String(err), form.rawData
          );
        }
      }
    } catch (err) {
      await appendAgentLog(
        job.id,
        `WARNING: Failed to fetch forms for patient ${pMap.sourceId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  await saveCheckpoint(job.id, "Consent", undefined, progress);
  await appendAgentLog(
    job.id,
    `Forms/consents complete: ${progress.Consent.imported} imported, ${progress.Consent.skipped} skipped, ${progress.Consent.failed} failed`
  );
}

/**
 * Associate imported photos with their charts by matching appointment source IDs.
 * Runs after all imports, linking photos to charts when both reference the same appointment.
 */
async function associatePhotosToCharts(
  job: MigrationJob,
  progress: EntityProgress
) {
  await appendAgentLog(job.id, "Associating photos to charts...");

  let linked = 0;

  // Get all photo entity maps for this job
  const photoMaps = await prisma.migrationEntityMap.findMany({
    where: { jobId: job.id, entityType: "Photo" },
  });

  for (const photoMap of photoMaps) {
    try {
      // Get the migration log for this photo to find appointmentSourceId
      const log = await prisma.migrationLog.findFirst({
        where: {
          jobId: job.id,
          entityType: "Photo",
          sourceId: photoMap.sourceId,
          status: "imported",
        },
        select: { rawData: true },
      });

      if (!log?.rawData) continue;

      const rawData = JSON.parse(log.rawData);
      const appointmentSourceId = rawData.appointmentId || rawData.appointmentSourceId;
      if (!appointmentSourceId) continue;

      // Resolve appointment source ID to Neuvvia appointment ID
      const appointmentId = await resolveSourceId(job.id, "Appointment", appointmentSourceId);
      if (!appointmentId) continue;

      // Find chart linked to that appointment
      const chart = await prisma.chart.findFirst({
        where: { appointmentId, deletedAt: null },
        select: { id: true },
      });

      if (!chart) continue;

      // Update photo to link to chart
      await prisma.photo.update({
        where: { id: photoMap.targetId },
        data: { chartId: chart.id },
      });

      linked++;
    } catch {
      // Non-critical — continue with other photos
    }
  }

  if (linked > 0) {
    await appendAgentLog(job.id, `Linked ${linked} photos to their charts.`);
  } else {
    await appendAgentLog(job.id, "No photo-to-chart associations found.");
  }
}

async function importDocuments(
  job: MigrationJob,
  provider: MigrationProvider,
  credentials: MigrationCredentials,
  progress: EntityProgress
) {
  if (!provider.fetchDocuments) {
    await appendAgentLog(job.id, "Provider does not support document import — skipping.");
    return;
  }

  await appendAgentLog(job.id, "Importing documents...");
  progress.Document = progress.Document || { total: 0, imported: 0, skipped: 0, failed: 0 };

  // Find migration initiator for uploadedById
  const initiator = await prisma.user.findFirst({
    where: { clinicId: job.clinicId, role: "Owner" },
    select: { id: true },
  });
  if (!initiator) {
    await appendAgentLog(job.id, "ERROR: No owner found for uploadedById. Skipping documents.");
    return;
  }

  // Get locationId from sourceDiscovery
  const discovery = job.sourceDiscovery ? JSON.parse(job.sourceDiscovery) : {};
  const locationId = discovery.locationId;

  // Get all imported patients
  const patientMaps = await prisma.migrationEntityMap.findMany({
    where: { jobId: job.id, entityType: "Patient" },
  });

  for (const pMap of patientMaps) {
    if (await isPaused(job.id)) return;

    try {
      // For Boulevard, pass "clientId:locationId" via cursor
      const cursor = locationId ? `${pMap.sourceId}:${locationId}` : pMap.sourceId;
      const result = await provider.fetchDocuments(credentials, { cursor });
      if (result.data.length === 0) continue;

      progress.Document.total += result.data.length;

      for (const doc of result.data) {
        try {
          const storagePath = `storage/documents/${job.clinicId}/${pMap.targetId}/${doc.filename}`;

          const { sizeBytes, mimeType } = await downloadFile(
            doc.url,
            path.join(process.cwd(), storagePath)
          );

          const newDoc = await prisma.patientDocument.create({
            data: {
              clinicId: job.clinicId,
              patientId: pMap.targetId,
              uploadedById: initiator.id,
              filename: doc.filename,
              storagePath,
              mimeType: doc.mimeType || mimeType || null,
              sizeBytes,
              category: doc.category || "imported",
              notes: `[Imported from ${provider.source}]`,
            },
          });

          await createEntityMap(job.id, "Document", doc.sourceId, newDoc.id);
          progress.Document.imported++;
          await logMigration(
            job.id, "Document", doc.sourceId, newDoc.id,
            "imported", `Document "${doc.filename}" imported (${sizeBytes} bytes)`, undefined, doc.rawData
          );
        } catch (err) {
          progress.Document.failed++;
          await logMigration(
            job.id, "Document", doc.sourceId, null,
            "failed", undefined, err instanceof Error ? err.message : String(err), doc.rawData
          );
        }
      }
    } catch (err) {
      await appendAgentLog(
        job.id,
        `WARNING: Failed to fetch documents for patient ${pMap.sourceId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  await saveCheckpoint(job.id, "Document", undefined, progress);
  await appendAgentLog(
    job.id,
    `Documents complete: ${progress.Document.imported} imported, ${progress.Document.skipped} skipped, ${progress.Document.failed} failed`
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

  await appendAgentLog(job.id, "Migration started. Import order: Services → Patients → Appointments → Charts → Photos → Forms → Documents → Invoices");

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

    // 5. Photos (optional — depends on provider support)
    if (!progress.Photo?.imported && !progress.Photo?.skipped) {
      await importPhotos(job, provider, credentials, progress);
      if (await isPaused(job.id)) return;
    }

    // 6. Forms/Consents (optional — depends on provider support)
    if (!progress.Consent?.imported && !progress.Consent?.skipped) {
      await importForms(job, provider, credentials, progress);
      if (await isPaused(job.id)) return;
    }

    // 7. Documents (optional — depends on provider support)
    if (!progress.Document?.imported && !progress.Document?.skipped) {
      await importDocuments(job, provider, credentials, progress);
      if (await isPaused(job.id)) return;
    }

    // 8. Invoices
    const invDone = progress.Invoice && !parseCheckpoint(job).Invoice;
    if (!invDone) {
      await importInvoices(job, provider, credentials, progress);
      if (await isPaused(job.id)) return;
    }

    // Post-processing: associate photos to charts
    await associatePhotosToCharts(job, progress);

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
