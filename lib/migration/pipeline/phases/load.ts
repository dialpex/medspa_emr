// Phase 7: Load — Canonical staging records → Neuvvia domain tables (idempotent)
// Staging-first approach: records go to CanonicalStagingRecord, then get promoted.

import { prisma } from "@/lib/prisma";
import type {
  CanonicalRecord,
  CanonicalEntityType,
  CanonicalChart,
  CanonicalConsent,
  CanonicalPhoto,
  CanonicalDocument,
  CanonicalService,
} from "../../canonical/schema";
import type { ArtifactStore } from "../../storage/types";
import { detectDuplicate } from "../../duplicate-detector";
import { downloadFile } from "../utils/download";
import path from "path";

export interface LoadInput {
  runId: string;
  clinicId: string;
  records: Array<{
    entityType: CanonicalEntityType;
    canonicalId: string;
    record: CanonicalRecord;
    checksum: string;
    sourceRecordId: string;
  }>;
}

export interface LoadResult {
  staged: number;
  promoted: number;
  skipped: number;
  errors: Array<{ canonicalId: string; entityType: string; error: string }>;
}

export async function executeLoad(input: LoadInput): Promise<LoadResult> {
  let staged = 0;
  const skipped = 0;
  const errors: LoadResult["errors"] = [];

  // Stage all records
  for (const item of input.records) {
    try {
      await prisma.canonicalStagingRecord.upsert({
        where: {
          runId_entityType_canonicalId: {
            runId: input.runId,
            entityType: item.entityType,
            canonicalId: item.canonicalId,
          },
        },
        create: {
          runId: input.runId,
          entityType: item.entityType,
          canonicalId: item.canonicalId,
          payload: JSON.stringify(item.record),
          checksum: item.checksum,
          status: "staged",
        },
        update: {
          payload: JSON.stringify(item.record),
          checksum: item.checksum,
          status: "staged",
        },
      });

      // Create ledger entry
      await prisma.migrationRecordLedger.upsert({
        where: {
          runId_entityType_sourceRecordId: {
            runId: input.runId,
            entityType: item.entityType,
            sourceRecordId: item.sourceRecordId,
          },
        },
        create: {
          runId: input.runId,
          entityType: item.entityType,
          sourceRecordId: item.sourceRecordId,
          canonicalId: item.canonicalId,
          status: "staged",
          sourceChecksum: item.checksum,
          canonicalChecksum: item.checksum,
        },
        update: {
          canonicalId: item.canonicalId,
          status: "staged",
          canonicalChecksum: item.checksum,
        },
      });

      staged++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        canonicalId: item.canonicalId,
        entityType: item.entityType,
        error: message,
      });
    }
  }

  return { staged, promoted: 0, skipped, errors };
}

// Promote staged records to Neuvvia domain tables
export async function executePromote(
  runId: string,
  clinicId: string,
  store?: ArtifactStore
): Promise<{ promoted: number; errors: Array<{ canonicalId: string; error: string }> }> {
  let promoted = 0;
  const errors: Array<{ canonicalId: string; error: string }> = [];

  const stagedRecords = await prisma.canonicalStagingRecord.findMany({
    where: { runId, status: "staged" },
    orderBy: { createdAt: "asc" },
  });

  // Process in entity order: services + patients first, then dependents
  const entityOrder: CanonicalEntityType[] = [
    "service", "patient", "appointment", "encounter", "chart",
    "consent", "photo", "document", "invoice",
  ];

  // Entity map for cross-references (canonicalId → neuvviaId)
  const entityMap = new Map<string, string>();

  // Find owner/provider users once (used by multiple promote functions)
  const ownerUser = await prisma.user.findFirst({
    where: { clinicId, role: "Owner" },
    select: { id: true },
  });
  const providerUser = await prisma.user.findFirst({
    where: { clinicId, role: "Provider", isActive: true },
    select: { id: true },
  });
  const defaultUserId = providerUser?.id ?? ownerUser?.id ?? null;

  // Chart template cache: templateName → chartTemplateId
  const chartTemplateCache = new Map<string, string>();
  // Consent template cache: templateName → consentTemplateId
  const consentTemplateCache = new Map<string, string>();

  for (const entityType of entityOrder) {
    const records = stagedRecords.filter((r) => r.entityType === entityType);

    for (const staging of records) {
      try {
        const payload = JSON.parse(staging.payload);
        const neuvviaId = await promoteRecord(
          entityType,
          payload,
          clinicId,
          entityMap,
          {
            defaultUserId,
            chartTemplateCache,
            consentTemplateCache,
            store,
            runId,
          }
        );

        if (neuvviaId) {
          entityMap.set(staging.canonicalId, neuvviaId);

          await prisma.canonicalStagingRecord.update({
            where: { id: staging.id },
            data: { status: "promoted" },
          });

          await prisma.migrationRecordLedger.updateMany({
            where: { runId, canonicalId: staging.canonicalId },
            data: { status: "promoted" },
          });

          promoted++;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ canonicalId: staging.canonicalId, error: message });

        await prisma.migrationRecordLedger.updateMany({
          where: { runId, canonicalId: staging.canonicalId },
          data: { status: "failed", errorCode: "PROMOTE_FAILED" },
        });
      }
    }
  }

  // Post-promote: associate photos to charts via shared appointments
  await associatePhotosToCharts(runId, clinicId, entityMap);

  return { promoted, errors };
}

// --- Promote context shared across promote functions ---

interface PromoteContext {
  defaultUserId: string | null;
  chartTemplateCache: Map<string, string>;
  consentTemplateCache: Map<string, string>;
  store?: ArtifactStore;
  runId: string;
}

// --- Promote router ---

async function promoteRecord(
  entityType: CanonicalEntityType,
  payload: Record<string, unknown>,
  clinicId: string,
  entityMap: Map<string, string>,
  ctx: PromoteContext
): Promise<string | null> {
  switch (entityType) {
    case "service":
      return promoteService(payload as unknown as CanonicalService, clinicId);
    case "patient":
      return promotePatient(payload, clinicId);
    case "appointment":
      return promoteAppointment(payload, clinicId, entityMap, ctx);
    case "chart":
      return promoteChart(payload as unknown as CanonicalChart, clinicId, entityMap, ctx);
    case "consent":
      return promoteConsent(payload as unknown as CanonicalConsent, clinicId, entityMap, ctx);
    case "photo":
      return promotePhoto(payload as unknown as CanonicalPhoto, clinicId, entityMap, ctx);
    case "document":
      return promoteDocument(payload as unknown as CanonicalDocument, clinicId, entityMap, ctx);
    case "invoice":
      return promoteInvoice(payload, clinicId, entityMap);
    case "encounter":
      // Encounters map to charts in Neuvvia
      return payload.canonicalId as string;
    default:
      return payload.canonicalId as string;
  }
}

// --- Individual promote functions ---

async function promoteService(
  payload: CanonicalService,
  clinicId: string
): Promise<string> {
  // Idempotent: check by name
  const existing = await prisma.service.findFirst({
    where: { clinicId, name: payload.name },
  });
  if (existing) return existing.id;

  const service = await prisma.service.create({
    data: {
      clinicId,
      name: payload.name,
      description: payload.description || null,
      duration: payload.duration ?? 30,
      price: payload.price ?? 0,
      category: payload.category || null,
      isActive: payload.isActive ?? true,
    },
  });

  return service.id;
}

async function promotePatient(
  payload: Record<string, unknown>,
  clinicId: string
): Promise<string> {
  const address = payload.address as Record<string, string> | undefined;
  const email = (payload.email as string) || null;
  const firstName = payload.firstName as string;
  const lastName = payload.lastName as string;

  // Full duplicate detection (email, phone, fuzzy name+DOB)
  const dupResult = await detectDuplicate(clinicId, {
    firstName,
    lastName,
    email: email || undefined,
    phone: (payload.phone as string) || undefined,
    dateOfBirth: (payload.dateOfBirth as string) || undefined,
  });

  if (dupResult.isDuplicate && dupResult.existingPatientId) {
    return dupResult.existingPatientId;
  }

  const patient = await prisma.patient.create({
    data: {
      clinicId,
      firstName,
      lastName,
      email: email?.toLowerCase() || null,
      phone: (payload.phone as string) || null,
      dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth as string) : null,
      gender: (payload.gender as string) || null,
      address: address?.line1 || null,
      city: address?.city || null,
      state: address?.state || null,
      zipCode: address?.zip || null,
      allergies: (payload.allergies as string) || null,
      medicalNotes: (payload.medicalNotes as string) || null,
      tags: (payload.tags as string[])?.join(",") || null,
    },
  });

  return patient.id;
}

async function promoteAppointment(
  payload: Record<string, unknown>,
  clinicId: string,
  entityMap: Map<string, string>,
  ctx: PromoteContext
): Promise<string | null> {
  const patientId = entityMap.get(payload.canonicalPatientId as string);
  if (!patientId) return null;

  const providerId = ctx.defaultUserId;
  if (!providerId) return null;

  // Resolve service if mapped
  let serviceId: string | null = null;
  if (payload.serviceName) {
    const service = await prisma.service.findFirst({
      where: { clinicId, name: payload.serviceName as string },
    });
    serviceId = service?.id ?? null;
  }

  const startTime = new Date(payload.startTime as string);
  const endTime = payload.endTime
    ? new Date(payload.endTime as string)
    : new Date(startTime.getTime() + 30 * 60000);

  const appointment = await prisma.appointment.create({
    data: {
      clinicId,
      patientId,
      providerId,
      serviceId,
      startTime,
      endTime,
      status: "Completed",
      notes: (payload.notes as string) || null,
      completedAt: startTime,
    },
  });

  return appointment.id;
}

async function promoteChart(
  payload: CanonicalChart,
  clinicId: string,
  entityMap: Map<string, string>,
  ctx: PromoteContext
): Promise<string | null> {
  const patientId = entityMap.get(payload.canonicalPatientId);
  if (!patientId) return null;

  // Resolve appointment reference
  let appointmentId: string | null = null;
  if (payload.canonicalAppointmentId) {
    appointmentId = entityMap.get(payload.canonicalAppointmentId) ?? null;
  }

  // If chart already exists for this appointment, merge into it
  if (appointmentId) {
    const existingChart = await prisma.chart.findFirst({
      where: { appointmentId, deletedAt: null },
      select: { id: true },
    });

    if (existingChart) {
      // Merge template data into existing chart
      const updateData: Record<string, unknown> = {};
      if (payload.templateName) {
        const templateId = await findOrCreateChartTemplate(
          clinicId, payload.templateName, payload.templateFields, ctx
        );
        if (templateId) updateData.templateId = templateId;
      }
      if (payload.templateValues) {
        updateData.additionalNotes = JSON.stringify(payload.templateValues);
      }
      if (Object.keys(updateData).length > 0) {
        await prisma.chart.update({
          where: { id: existingChart.id },
          data: updateData,
        });
      }

      // Enrich patient from form fields
      await enrichPatientFromFormFields(patientId, payload.sourceFormFields);

      return existingChart.id;
    }
  }

  // Create chart template if template metadata exists
  let templateId: string | undefined;
  if (payload.templateName && payload.templateFields) {
    templateId = await findOrCreateChartTemplate(
      clinicId, payload.templateName, payload.templateFields, ctx
    ) ?? undefined;
  }

  const chartDate = payload.signedAt ? new Date(payload.signedAt) : new Date();

  const chart = await prisma.chart.create({
    data: {
      clinicId,
      patientId,
      appointmentId: appointmentId || undefined,
      templateId,
      status: "MDSigned",
      chiefComplaint: payload.chiefComplaint || payload.templateName || null,
      additionalNotes: payload.templateValues
        ? JSON.stringify(payload.templateValues)
        : payload.sections?.map((s) => `${s.title}: ${s.content}`).join("\n") || null,
      createdById: ctx.defaultUserId,
      signedByName: payload.providerName || null,
      signedAt: chartDate,
      createdAt: chartDate,
    },
  });

  // Enrich patient from form fields
  await enrichPatientFromFormFields(patientId, payload.sourceFormFields);

  return chart.id;
}

async function promoteConsent(
  payload: CanonicalConsent,
  clinicId: string,
  entityMap: Map<string, string>,
  ctx: PromoteContext
): Promise<string | null> {
  const patientId = entityMap.get(payload.canonicalPatientId);
  if (!patientId) return null;

  // Find or create consent template
  let templateId = ctx.consentTemplateCache.get(payload.templateName);
  if (!templateId) {
    const existing = await prisma.consentTemplate.findFirst({
      where: { clinicId, name: payload.templateName },
      select: { id: true },
    });

    if (existing) {
      templateId = existing.id;
    } else {
      const newTemplate = await prisma.consentTemplate.create({
        data: {
          clinicId,
          name: payload.templateName,
          content: payload.content || "This consent template was automatically created during data migration.",
          version: "1.0",
          isActive: true,
        },
      });
      templateId = newTemplate.id;
    }
    ctx.consentTemplateCache.set(payload.templateName, templateId);
  }

  // Build template snapshot
  const snapshotData: Record<string, unknown> = {
    importedFrom: "migration",
    ...(payload.sourceMetadata || {}),
  };
  if (payload.formFields && payload.formFields.length > 0) {
    snapshotData.formFields = payload.formFields;
  }

  const consent = await prisma.patientConsent.create({
    data: {
      clinicId,
      patientId,
      templateId,
      signedAt: payload.signedAt ? new Date(payload.signedAt) : null,
      templateSnapshot: JSON.stringify(snapshotData),
    },
  });

  return consent.id;
}

async function promotePhoto(
  payload: CanonicalPhoto,
  clinicId: string,
  entityMap: Map<string, string>,
  ctx: PromoteContext
): Promise<string | null> {
  const patientId = entityMap.get(payload.canonicalPatientId);
  if (!patientId) return null;

  if (!ctx.defaultUserId) return null;

  let storagePath: string;
  let sizeBytes: number;
  let mimeType = payload.mimeType || "image/jpeg";

  // Try artifact store first, fall back to URL download
  if (ctx.store && payload.artifactKey && payload.artifactKey !== "pending") {
    try {
      const data = await ctx.store.get({
        runId: ctx.runId,
        key: payload.artifactKey,
        hash: "",
        sizeBytes: 0,
        storedAt: "",
      });
      const ext = path.extname(payload.filename) || ".jpg";
      const filename = `${payload.sourceRecordId}${ext}`;
      storagePath = `storage/photos/${clinicId}/${patientId}/${filename}`;
      const { writeFile: fsWrite, mkdir: fsMkdir } = await import("fs/promises");
      await fsMkdir(path.dirname(path.join(process.cwd(), storagePath)), { recursive: true });
      await fsWrite(path.join(process.cwd(), storagePath), data);
      sizeBytes = data.length;
    } catch {
      // Fall through to URL download
      if (!payload.downloadUrl) return null;
      const result = await downloadFromUrl(payload, clinicId, patientId);
      storagePath = result.storagePath;
      sizeBytes = result.sizeBytes;
      mimeType = result.mimeType || mimeType;
    }
  } else if (payload.downloadUrl) {
    const result = await downloadFromUrl(payload, clinicId, patientId);
    storagePath = result.storagePath;
    sizeBytes = result.sizeBytes;
    mimeType = result.mimeType || mimeType;
  } else {
    return null; // No binary data available
  }

  const photo = await prisma.photo.create({
    data: {
      clinicId,
      patientId,
      takenById: ctx.defaultUserId,
      filename: payload.filename,
      storagePath,
      mimeType,
      sizeBytes,
      category: payload.category || null,
      caption: payload.caption || "[Imported]",
    },
  });

  return photo.id;
}

async function promoteDocument(
  payload: CanonicalDocument,
  clinicId: string,
  entityMap: Map<string, string>,
  ctx: PromoteContext
): Promise<string | null> {
  const patientId = entityMap.get(payload.canonicalPatientId);
  if (!patientId) return null;

  if (!ctx.defaultUserId) return null;

  let storagePath: string;
  let sizeBytes: number;
  let mimeType = payload.mimeType || null;

  // Try artifact store first, fall back to URL download
  if (ctx.store && payload.artifactKey && payload.artifactKey !== "pending") {
    try {
      const data = await ctx.store.get({
        runId: ctx.runId,
        key: payload.artifactKey,
        hash: "",
        sizeBytes: 0,
        storedAt: "",
      });
      storagePath = `storage/documents/${clinicId}/${patientId}/${payload.filename}`;
      const { writeFile: fsWrite, mkdir: fsMkdir } = await import("fs/promises");
      await fsMkdir(path.dirname(path.join(process.cwd(), storagePath)), { recursive: true });
      await fsWrite(path.join(process.cwd(), storagePath), data);
      sizeBytes = data.length;
    } catch {
      if (!payload.downloadUrl) return null;
      const result = await downloadDocFromUrl(payload, clinicId, patientId);
      storagePath = result.storagePath;
      sizeBytes = result.sizeBytes;
      mimeType = result.mimeType || mimeType;
    }
  } else if (payload.downloadUrl) {
    const result = await downloadDocFromUrl(payload, clinicId, patientId);
    storagePath = result.storagePath;
    sizeBytes = result.sizeBytes;
    mimeType = result.mimeType || mimeType;
  } else {
    return null;
  }

  const doc = await prisma.patientDocument.create({
    data: {
      clinicId,
      patientId,
      uploadedById: ctx.defaultUserId,
      filename: payload.filename,
      storagePath,
      mimeType,
      sizeBytes,
      category: payload.category || "imported",
      notes: "[Imported]",
    },
  });

  return doc.id;
}

async function promoteInvoice(
  payload: Record<string, unknown>,
  clinicId: string,
  entityMap: Map<string, string>
): Promise<string | null> {
  const patientId = entityMap.get(payload.canonicalPatientId as string);
  if (!patientId) return null;

  const lineItems = (payload.lineItems as Array<Record<string, unknown>>) || [];
  const invoiceNumber = (payload.invoiceNumber as string) || `MIG-${Date.now()}`;

  // Idempotent: check for existing invoice by number
  const existing = await prisma.invoice.findFirst({
    where: { clinicId, invoiceNumber },
  });
  if (existing) return existing.id;

  const status = typeof payload.status === "string" && payload.status.toLowerCase().includes("paid")
    ? "Paid" as const
    : "Void" as const;

  const invoice = await prisma.invoice.create({
    data: {
      clinicId,
      patientId,
      invoiceNumber,
      status,
      subtotal: (payload.subtotal as number) || (payload.total as number) || 0,
      taxAmount: (payload.taxAmount as number) || 0,
      total: (payload.total as number) || 0,
      notes: (payload.notes as string) || null,
      paidAt: payload.paidAt ? new Date(payload.paidAt as string) : null,
      items: {
        create: lineItems.map((item) => ({
          clinicId,
          description: (item.description as string) || "Migrated item",
          quantity: (item.quantity as number) || 1,
          unitPrice: (item.unitPrice as number) || 0,
          total: (item.total as number) || 0,
        })),
      },
    },
  });

  return invoice.id;
}

// --- Helper functions ---

async function findOrCreateChartTemplate(
  clinicId: string,
  templateName: string,
  templateFields: CanonicalChart["templateFields"],
  ctx: PromoteContext
): Promise<string | null> {
  const displayName = `[Imported] ${templateName}`;

  // Check cache first
  const cached = ctx.chartTemplateCache.get(templateName);
  if (cached) return cached;

  // Check DB
  const existing = await prisma.chartTemplate.findFirst({
    where: { clinicId, name: displayName, deletedAt: null },
    select: { id: true },
  });

  if (existing) {
    // Update fields on re-run
    if (templateFields && templateFields.length > 0) {
      await prisma.chartTemplate.update({
        where: { id: existing.id },
        data: {
          fieldsConfig: JSON.stringify(templateFields.map((f) => ({
            key: f.key,
            label: f.label,
            type: f.type,
            ...(f.options ? { options: f.options } : {}),
          }))),
        },
      });
    }
    ctx.chartTemplateCache.set(templateName, existing.id);
    return existing.id;
  }

  if (!templateFields || templateFields.length === 0) return null;

  const template = await prisma.chartTemplate.create({
    data: {
      clinicId,
      type: "chart",
      name: displayName,
      description: `Auto-generated from migrated form template "${templateName}"`,
      fieldsConfig: JSON.stringify(templateFields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        ...(f.options ? { options: f.options } : {}),
      }))),
      status: "Active",
    },
  });

  ctx.chartTemplateCache.set(templateName, template.id);
  return template.id;
}

async function enrichPatientFromFormFields(
  patientId: string,
  sourceFormFields?: CanonicalChart["sourceFormFields"]
): Promise<void> {
  if (!sourceFormFields) return;

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { allergies: true, medicalNotes: true },
  });
  if (!patient) return;

  const updates: Record<string, string> = {};

  for (const field of sourceFormFields) {
    if (field.category !== "patient_medical" || !field.patientField) continue;

    const fieldValue = field.selectedOptions?.length
      ? field.selectedOptions.join(", ")
      : field.value;
    if (!fieldValue) continue;

    const currentValue = patient[field.patientField as keyof typeof patient] as string | null;

    if (!currentValue) {
      // Empty — set directly
      updates[field.patientField] = fieldValue;
    } else if (!currentValue.includes(fieldValue)) {
      // Append new data (avoid duplicates)
      updates[field.patientField] = `${currentValue}; ${fieldValue}`;
    }
  }

  if (Object.keys(updates).length > 0) {
    await prisma.patient.update({
      where: { id: patientId },
      data: updates,
    });
  }
}

async function downloadFromUrl(
  payload: CanonicalPhoto,
  clinicId: string,
  patientId: string
): Promise<{ storagePath: string; sizeBytes: number; mimeType: string | null }> {
  const ext = path.extname(payload.filename) || ".jpg";
  const filename = `${payload.sourceRecordId}${ext}`;
  const storagePath = `storage/photos/${clinicId}/${patientId}/${filename}`;
  const { sizeBytes, mimeType } = await downloadFile(
    payload.downloadUrl!,
    path.join(process.cwd(), storagePath)
  );
  return { storagePath, sizeBytes, mimeType };
}

async function downloadDocFromUrl(
  payload: CanonicalDocument,
  clinicId: string,
  patientId: string
): Promise<{ storagePath: string; sizeBytes: number; mimeType: string | null }> {
  const storagePath = `storage/documents/${clinicId}/${patientId}/${payload.filename}`;
  const { sizeBytes, mimeType } = await downloadFile(
    payload.downloadUrl!,
    path.join(process.cwd(), storagePath)
  );
  return { storagePath, sizeBytes, mimeType };
}

// Post-promote: associate photos to charts via shared appointment references
async function associatePhotosToCharts(
  runId: string,
  clinicId: string,
  entityMap: Map<string, string>
): Promise<void> {
  // Find all promoted photos for this run
  const photoRecords = await prisma.canonicalStagingRecord.findMany({
    where: { runId, entityType: "photo", status: "promoted" },
  });

  let linked = 0;

  for (const photoStaging of photoRecords) {
    try {
      const payload = JSON.parse(photoStaging.payload) as CanonicalPhoto;
      if (!payload.canonicalAppointmentId) continue;

      const neuvviaPhotoId = entityMap.get(photoStaging.canonicalId);
      const neuvviaAppointmentId = entityMap.get(payload.canonicalAppointmentId);
      if (!neuvviaPhotoId || !neuvviaAppointmentId) continue;

      // Find chart linked to that appointment
      const chart = await prisma.chart.findFirst({
        where: { appointmentId: neuvviaAppointmentId, deletedAt: null },
        select: { id: true },
      });
      if (!chart) continue;

      await prisma.photo.update({
        where: { id: neuvviaPhotoId },
        data: { chartId: chart.id },
      });
      linked++;
    } catch {
      // Non-critical — continue
    }
  }

  if (linked > 0) {
    console.log(`[load] Linked ${linked} photos to their charts`);
  }
}
