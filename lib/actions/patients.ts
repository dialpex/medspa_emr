"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, requirePermissionForClinic } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

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
    createdBy: { name: string };
    signedBy: { name: string } | null;
    signedAt: Date | null;
  }[];
  photos: {
    id: string;
    category: string | null;
    caption: string | null;
    createdAt: Date;
    takenBy: { name: string };
  }[];
  consents: {
    id: string;
    signedAt: Date | null;
    template: { name: string };
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

    return patients.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone: p.phone,
      dateOfBirth: p.dateOfBirth,
      tags: p.tags,
      lastAppointment: p.appointments[0]?.startTime ?? null,
    }));
  }

  const searchTerm = search.trim().toLowerCase();
  const searchDigits = normalizePhone(searchTerm);

  // Fetch all patients for this clinic and filter in memory
  // This handles phone number formatting differences
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

  // Filter patients matching search term
  const filtered = allPatients.filter((p) => {
    const firstName = p.firstName.toLowerCase();
    const lastName = p.lastName.toLowerCase();
    const email = (p.email || "").toLowerCase();
    const phone = p.phone || "";
    const phoneDigits = normalizePhone(phone);

    return (
      firstName.includes(searchTerm) ||
      lastName.includes(searchTerm) ||
      email.includes(searchTerm) ||
      phone.includes(searchTerm) ||
      (searchDigits.length >= 3 && phoneDigits.includes(searchDigits))
    );
  });

  return filtered.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    phone: p.phone,
    dateOfBirth: p.dateOfBirth,
    tags: p.tags,
    lastAppointment: p.appointments[0]?.startTime ?? null,
  }));
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

  return patient;
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

  const [appointments, charts, photos, consents, invoices] = await Promise.all([
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
      },
    }),
    prisma.patientConsent.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        signedAt: true,
        template: { select: { name: true } },
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
  ]);

  return { appointments, charts, photos, consents, invoices };
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
};

/**
 * Create a new patient
 */
export async function createPatient(input: CreatePatientInput): Promise<PatientDetail> {
  const user = await requirePermission("patients", "create");

  const patient = await prisma.patient.create({
    data: {
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
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      clinicId: user.clinicId,
      userId: user.id,
      action: "PatientCreate",
      entityType: "Patient",
      entityId: patient.id,
    },
  });

  revalidatePath("/patients");

  return patient;
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

  const patient = await prisma.patient.update({
    where: { id },
    data: {
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
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      clinicId: user.clinicId,
      userId: user.id,
      action: "PatientUpdate",
      entityType: "Patient",
      entityId: patient.id,
      details: JSON.stringify({ updatedFields: Object.keys(input) }),
    },
  });

  revalidatePath("/patients");
  revalidatePath(`/patients/${id}`);

  return patient;
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
