// Phase 7: Load — Canonical staging records → Neuvvia domain tables (idempotent)
// Staging-first approach: records go to CanonicalStagingRecord, then get promoted.

import { prisma } from "@/lib/prisma";
import type { CanonicalRecord, CanonicalEntityType } from "../../canonical/schema";

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
  let skipped = 0;
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
  clinicId: string
): Promise<{ promoted: number; errors: Array<{ canonicalId: string; error: string }> }> {
  let promoted = 0;
  const errors: Array<{ canonicalId: string; error: string }> = [];

  const stagedRecords = await prisma.canonicalStagingRecord.findMany({
    where: { runId, status: "staged" },
    orderBy: { createdAt: "asc" },
  });

  // Process in entity order: patients first, then dependents
  const entityOrder: CanonicalEntityType[] = [
    "patient", "appointment", "encounter", "chart",
    "consent", "photo", "document", "invoice",
  ];

  // Entity map for cross-references
  const entityMap = new Map<string, string>(); // canonicalId → neuvviaId

  for (const entityType of entityOrder) {
    const records = stagedRecords.filter((r) => r.entityType === entityType);

    for (const staging of records) {
      try {
        const payload = JSON.parse(staging.payload);
        const neuvviaId = await promoteRecord(
          entityType,
          payload,
          clinicId,
          entityMap
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

  return { promoted, errors };
}

async function promoteRecord(
  entityType: CanonicalEntityType,
  payload: Record<string, unknown>,
  clinicId: string,
  entityMap: Map<string, string>
): Promise<string | null> {
  switch (entityType) {
    case "patient":
      return promotePatient(payload, clinicId);
    case "appointment":
      return promoteAppointment(payload, clinicId, entityMap);
    case "invoice":
      return promoteInvoice(payload, clinicId, entityMap);
    default:
      // Other entity types: store as-is for now, full promote in v.next
      return payload.canonicalId as string;
  }
}

async function promotePatient(
  payload: Record<string, unknown>,
  clinicId: string
): Promise<string> {
  const address = payload.address as Record<string, string> | undefined;

  const patient = await prisma.patient.create({
    data: {
      clinicId,
      firstName: payload.firstName as string,
      lastName: payload.lastName as string,
      email: (payload.email as string) || null,
      phone: (payload.phone as string) || null,
      dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth as string) : null,
      gender: (payload.gender as string) || null,
      address: address?.line1 || null,
      city: address?.city || null,
      state: address?.state || null,
      zipCode: address?.zip || null,
      allergies: (payload.allergies as string) || null,
      medicalNotes: (payload.medicalNotes as string) || null,
    },
  });

  return patient.id;
}

async function promoteAppointment(
  payload: Record<string, unknown>,
  clinicId: string,
  entityMap: Map<string, string>
): Promise<string | null> {
  const patientId = entityMap.get(payload.canonicalPatientId as string);
  if (!patientId) return null;

  // Find or create a provider user
  const providerName = payload.providerName as string;
  let provider = await prisma.user.findFirst({
    where: {
      clinicId,
      OR: [
        { firstName: providerName.split(" ")[0], lastName: providerName.split(" ").slice(1).join(" ") || undefined },
        { firstName: providerName },
      ],
    },
  });

  if (!provider) {
    // Skip if no matching provider found
    return null;
  }

  const appointment = await prisma.appointment.create({
    data: {
      clinicId,
      patientId,
      providerId: provider.id,
      startTime: new Date(payload.startTime as string),
      endTime: payload.endTime ? new Date(payload.endTime as string) : new Date(new Date(payload.startTime as string).getTime() + 3600000),
      status: "Completed",
      notes: (payload.notes as string) || null,
    },
  });

  return appointment.id;
}

async function promoteInvoice(
  payload: Record<string, unknown>,
  clinicId: string,
  entityMap: Map<string, string>
): Promise<string | null> {
  const patientId = entityMap.get(payload.canonicalPatientId as string);
  if (!patientId) return null;

  const lineItems = (payload.lineItems as Array<Record<string, unknown>>) || [];

  const invoice = await prisma.invoice.create({
    data: {
      clinicId,
      patientId,
      status: (payload.status as string) || "paid",
      subtotal: (payload.subtotal as number) || (payload.total as number) || 0,
      taxAmount: (payload.taxAmount as number) || 0,
      totalAmount: (payload.total as number) || 0,
      notes: (payload.notes as string) || null,
      paidAt: payload.paidAt ? new Date(payload.paidAt as string) : null,
      items: {
        create: lineItems.map((item) => ({
          clinicId,
          description: (item.description as string) || "Migrated item",
          quantity: (item.quantity as number) || 1,
          unitPrice: (item.unitPrice as number) || 0,
          totalPrice: (item.total as number) || 0,
        })),
      },
    },
  });

  return invoice.id;
}
