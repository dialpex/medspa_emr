"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, requirePermissionForClinic } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { validateInput } from "@/lib/validation/helpers";
import { createPatientSchema, updatePatientSchema } from "@/lib/validation/schemas";
import { revalidatePath } from "next/cache";
import { encryptPatientData, decryptPatientData, decryptPatientList } from "@/lib/encryption/patient-encryption";

export type PatientListItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: Date | null;
  tags: string | null;
  lastAppointment: Date | null;
};

export type PatientDetail = {
  id: string;
  clinicId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  allergies: string | null;
  medicalNotes: string | null;
  tags: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PatientTimeline = {
  appointments: {
    id: string;
    startTime: Date;
    endTime: Date;
    status: string;
    service: { name: string } | null;
    provider: { name: string };
  }[];
  charts: {
    id: string;
    status: string;
    chiefComplaint: string | null;
    createdAt: Date;
    createdBy: { name: string } | null;
    signedBy: { name: string } | null;
    signedAt: Date | null;
    encounter: { id: string; status: string; provider: { name: string } } | null;
  }[];
  photos: {
    id: string;
    category: string | null;
    caption: string | null;
    createdAt: Date;
    takenBy: { name: string };
    chart: {
      id: string;
      appointment: {
        id: string;
        startTime: Date;
        service: { name: string } | null;
      } | null;
    } | null;
  }[];
  consents: {
    id: string;
    signedAt: Date | null;
    template: { name: string };
    templateSnapshot: string | null;
    createdAt: Date;
  }[];
  invoices: {
    id: string;
    invoiceNumber: string;
    status: string;
    total: number;
    createdAt: Date;
    paidAt: Date | null;
  }[];
  documents: {
    id: string;
    filename: string;
    category: string | null;
    notes: string | null;
    createdAt: Date;
    uploadedBy: { name: string };
  }[];
};

/**
 * Normalize phone number - extract digits only
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Get patients list with optional search
 */
export async function getPatients(search?: string): Promise<PatientListItem[]> {
  const user = await requirePermission("patients", "view");

  const baseWhere = {
    clinicId: user.clinicId,
    deletedAt: null,
  };

  // If no search, return all patients
  if (!search || !search.trim()) {
    const patients = await prisma.patient.findMany({
      where: baseWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        tags: true,
        appointments: {
          where: { deletedAt: null },
          orderBy: { startTime: "desc" },
          take: 1,
          select: { startTime: true },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return patients.map((p) => {
      const d = decryptPatientData(p as any);
      return {
        id: d.id,
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        phone: d.phone,
        dateOfBirth: d.dateOfBirth,
        tags: d.tags,
        lastAppointment: p.appointments[0]?.startTime ?? null,
      };
    });
  }

  const searchTerm = search.trim().toLowerCase();
  const searchDigits = normalizePhone(searchTerm);

  // Fetch all patients for this clinic and filter in memory
  // (required because PHI fields are encrypted — no DB-level text search)
  const allPatients = await prisma.patient.findMany({
    where: baseWhere,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      tags: true,
      appointments: {
        where: { deletedAt: null },
        orderBy: { startTime: "desc" },
        take: 1,
        select: { startTime: true },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  // Decrypt then filter — required because PHI fields are encrypted at rest
  const results: PatientListItem[] = [];
  for (const p of allPatients) {
    const d = decryptPatientData(p as any);
    const firstName = (d.firstName as string).toLowerCase();
    const lastName = (d.lastName as string).toLowerCase();
    const email = ((d.email as string) || "").toLowerCase();
    const phone = (d.phone as string) || "";
    const phoneDigits = normalizePhone(phone);

    if (
      firstName.includes(searchTerm) ||
      lastName.includes(searchTerm) ||
      email.includes(searchTerm) ||
      phone.includes(searchTerm) ||
      (searchDigits.length >= 3 && phoneDigits.includes(searchDigits))
    ) {
      results.push({
        id: d.id as string,
        firstName: d.firstName as string,
        lastName: d.lastName as string,
        email: d.email as string | null,
        phone: d.phone as string | null,
        dateOfBirth: d.dateOfBirth as Date | null,
        tags: d.tags as string | null,
        lastAppointment: p.appointments[0]?.startTime ?? null,
      });
    }
  }

  return results;
}

/**
 * Get single patient by ID
 */
export async function getPatient(id: string): Promise<PatientDetail | null> {
  const user = await requirePermission("patients", "view");

  const patient = await prisma.patient.findFirst({
    where: {
      id,
      clinicId: user.clinicId,
      deletedAt: null,
    },
  });

  if (patient) {
    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: "PatientView",
      entityType: "Patient",
      entityId: patient.id,
    });
    return decryptPatientData(patient as any) as PatientDetail;
  }

  return null;
}

/**
 * Get patient timeline (grouped by type)
 */
export async function getPatientTimeline(patientId: string): Promise<PatientTimeline> {
  const user = await requirePermission("patients", "view");

  // Verify patient belongs to user's clinic
  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
      clinicId: user.clinicId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!patient) {
    throw new Error("Patient not found");
  }

  const [appointments, charts, photos, consents, invoices, documents] = await Promise.all([
    prisma.appointment.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { startTime: "desc" },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        service: { select: { name: true } },
        provider: { select: { name: true } },
      },
    }),
    prisma.chart.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        chiefComplaint: true,
        createdAt: true,
        createdBy: { select: { name: true } },
        signedBy: { select: { name: true } },
        signedAt: true,
        encounter: { select: { id: true, status: true, provider: { select: { name: true } } } },
      },
    }),
    prisma.photo.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        category: true,
        caption: true,
        createdAt: true,
        takenBy: { select: { name: true } },
        chart: {
          select: {
            id: true,
            appointment: {
              select: {
                id: true,
                startTime: true,
                service: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.patientConsent.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        signedAt: true,
        template: { select: { name: true } },
        templateSnapshot: true,
        createdAt: true,
      },
    }),
    prisma.invoice.findMany({
      where: { patientId, clinicId: user.clinicId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        total: true,
        createdAt: true,
        paidAt: true,
      },
    }),
    prisma.patientDocument.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        filename: true,
        category: true,
        notes: true,
        createdAt: true,
        uploadedBy: { select: { name: true } },
      },
    }),
  ]);

  await createAuditLog({
    clinicId: user.clinicId,
    userId: user.id,
    action: "PatientView",
    entityType: "Patient",
    entityId: patientId,
    details: JSON.stringify({ scope: "timeline" }),
  });

  return { appointments, charts, photos, consents, invoices, documents };
}

export type CreatePatientInput = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  allergies?: string;
  medicalNotes?: string;
  tags?: string;
  status?: string;
};

/**
 * Create a new patient
 */
export async function createPatient(input: CreatePatientInput): Promise<PatientDetail> {
  const user = await requirePermission("patients", "create");
  const validated = validateInput(createPatientSchema, input);

  const patient = await prisma.patient.create({
    data: encryptPatientData({
      clinicId: user.clinicId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email || null,
      phone: input.phone || null,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      gender: input.gender || null,
      address: input.address || null,
      city: input.city || null,
      state: input.state || null,
      zipCode: input.zipCode || null,
      allergies: input.allergies || null,
      medicalNotes: input.medicalNotes || null,
      tags: input.tags || null,
    }) as any,
  });

  await createAuditLog({
    clinicId: user.clinicId,
    userId: user.id,
    action: "PatientCreate",
    entityType: "Patient",
    entityId: patient.id,
  });

  revalidatePath("/patients");

  return decryptPatientData(patient as any) as PatientDetail;
}

export type UpdatePatientInput = Partial<CreatePatientInput>;

/**
 * Update an existing patient
 */
export async function updatePatient(
  id: string,
  input: UpdatePatientInput
): Promise<PatientDetail> {
  const user = await requirePermission("patients", "edit");
  validateInput(updatePatientSchema, input);

  // Verify patient belongs to user's clinic
  const existing = await prisma.patient.findFirst({
    where: {
      id,
      clinicId: user.clinicId,
      deletedAt: null,
    },
  });

  if (!existing) {
    throw new Error("Patient not found");
  }

  const updateData = encryptPatientData({
    ...(input.firstName !== undefined && { firstName: input.firstName }),
    ...(input.lastName !== undefined && { lastName: input.lastName }),
    ...(input.email !== undefined && { email: input.email || null }),
    ...(input.phone !== undefined && { phone: input.phone || null }),
    ...(input.dateOfBirth !== undefined && {
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
    }),
    ...(input.gender !== undefined && { gender: input.gender || null }),
    ...(input.address !== undefined && { address: input.address || null }),
    ...(input.city !== undefined && { city: input.city || null }),
    ...(input.state !== undefined && { state: input.state || null }),
    ...(input.zipCode !== undefined && { zipCode: input.zipCode || null }),
    ...(input.allergies !== undefined && { allergies: input.allergies || null }),
    ...(input.medicalNotes !== undefined && { medicalNotes: input.medicalNotes || null }),
    ...(input.tags !== undefined && { tags: input.tags || null }),
    ...(input.status !== undefined && { status: input.status as "Active" | "Fired" }),
  });

  const patient = await prisma.patient.update({
    where: { id },
    data: updateData as any,
  });

  await createAuditLog({
    clinicId: user.clinicId,
    userId: user.id,
    action: "PatientUpdate",
    entityType: "Patient",
    entityId: patient.id,
    details: JSON.stringify({ updatedFields: Object.keys(input) }),
  });

  revalidatePath("/patients");
  revalidatePath(`/patients/${id}`);

  return decryptPatientData(patient as any) as PatientDetail;
}

/**
 * Soft delete a patient
 */
export async function deletePatient(id: string): Promise<void> {
  const user = await requirePermission("patients", "delete");

  // Verify patient belongs to user's clinic
  const existing = await prisma.patient.findFirst({
    where: {
      id,
      clinicId: user.clinicId,
      deletedAt: null,
    },
  });

  if (!existing) {
    throw new Error("Patient not found");
  }

  await prisma.patient.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/patients");
}
