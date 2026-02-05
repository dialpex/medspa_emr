"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { AppointmentStatus, Role } from "@prisma/client";

// ===========================================
// TYPES
// ===========================================

export type CalendarAppointment = {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  serviceId: string | null;
  serviceName: string | null;
  roomId: string | null;
  roomName: string | null;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatus;
  notes: string | null;
};

export type Provider = {
  id: string;
  name: string;
  role: Role;
};

export type Room = {
  id: string;
  name: string;
};

export type Service = {
  id: string;
  name: string;
  duration: number;
  price: number;
  category: string | null;
};

export type PatientSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
};

export type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ===========================================
// READ OPERATIONS
// ===========================================

/**
 * Get appointments for a date range with optional filters
 */
export async function getAppointments(
  startDate: Date,
  endDate: Date,
  filters?: { providerId?: string; roomId?: string }
): Promise<CalendarAppointment[]> {
  const user = await requirePermission("appointments", "view");

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId: user.clinicId,
      deletedAt: null,
      startTime: { gte: startDate },
      endTime: { lte: endDate },
      ...(filters?.providerId && { providerId: filters.providerId }),
      ...(filters?.roomId && { roomId: filters.roomId }),
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      provider: { select: { name: true } },
      service: { select: { name: true } },
      room: { select: { name: true } },
    },
    orderBy: { startTime: "asc" },
  });

  return appointments.map((apt) => ({
    id: apt.id,
    patientId: apt.patientId,
    patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
    providerId: apt.providerId,
    providerName: apt.provider.name,
    serviceId: apt.serviceId,
    serviceName: apt.service?.name ?? null,
    roomId: apt.roomId,
    roomName: apt.room?.name ?? null,
    startTime: apt.startTime,
    endTime: apt.endTime,
    status: apt.status,
    notes: apt.notes,
  }));
}

/**
 * Get a single appointment by ID
 */
export async function getAppointment(id: string): Promise<CalendarAppointment | null> {
  const user = await requirePermission("appointments", "view");

  const apt = await prisma.appointment.findFirst({
    where: {
      id,
      clinicId: user.clinicId,
      deletedAt: null,
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      provider: { select: { name: true } },
      service: { select: { name: true } },
      room: { select: { name: true } },
    },
  });

  if (!apt) return null;

  return {
    id: apt.id,
    patientId: apt.patientId,
    patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
    providerId: apt.providerId,
    providerName: apt.provider.name,
    serviceId: apt.serviceId,
    serviceName: apt.service?.name ?? null,
    roomId: apt.roomId,
    roomName: apt.room?.name ?? null,
    startTime: apt.startTime,
    endTime: apt.endTime,
    status: apt.status,
    notes: apt.notes,
  };
}

/**
 * Get all providers (users who can be assigned appointments)
 */
export async function getProviders(): Promise<Provider[]> {
  const user = await requirePermission("appointments", "view");

  const providers = await prisma.user.findMany({
    where: {
      clinicId: user.clinicId,
      isActive: true,
      role: { in: ["Owner", "Admin", "Provider", "MedicalDirector"] },
    },
    select: {
      id: true,
      name: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });

  return providers;
}

/**
 * Get all active rooms
 */
export async function getRooms(): Promise<Room[]> {
  const user = await requirePermission("appointments", "view");

  const rooms = await prisma.room.findMany({
    where: {
      clinicId: user.clinicId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  return rooms;
}

/**
 * Get all active services
 */
export async function getServices(): Promise<Service[]> {
  const user = await requirePermission("appointments", "view");

  const services = await prisma.service.findMany({
    where: {
      clinicId: user.clinicId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      duration: true,
      price: true,
      category: true,
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return services;
}

/**
 * Search patients by name, email, or phone
 */
export async function searchPatients(query: string): Promise<PatientSearchResult[]> {
  const user = await requirePermission("patients", "view");

  if (!query || query.trim().length < 2) {
    return [];
  }

  const searchTerm = query.trim().toLowerCase();

  const patients = await prisma.patient.findMany({
    where: {
      clinicId: user.clinicId,
      deletedAt: null,
      OR: [
        { firstName: { contains: searchTerm } },
        { lastName: { contains: searchTerm } },
        { email: { contains: searchTerm } },
        { phone: { contains: searchTerm } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
    take: 10,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return patients;
}

// ===========================================
// APPOINTMENT DETAIL (for slide-out panel)
// ===========================================

export type AppointmentDetail = {
  id: string;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatus;
  notes: string | null;
  createdAt: Date;
  providerName: string;
  serviceName: string | null;
  servicePrice: number | null;
  roomName: string | null;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  patientEmail: string | null;
  patientPhone: string | null;
  patientDateOfBirth: Date | null;
  patientGender: string | null;
  patientAllergies: string | null;
  patientCreatedAt: Date;
  patientVisitCount: number;
};

/**
 * Get appointment with full patient details (for slide-out panel)
 */
export async function getAppointmentWithPatient(
  id: string
): Promise<AppointmentDetail | null> {
  const user = await requirePermission("appointments", "view");

  const apt = await prisma.appointment.findFirst({
    where: {
      id,
      clinicId: user.clinicId,
      deletedAt: null,
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          dateOfBirth: true,
          gender: true,
          allergies: true,
          createdAt: true,
          _count: {
            select: {
              appointments: {
                where: { status: "Completed", deletedAt: null },
              },
            },
          },
        },
      },
      provider: { select: { name: true } },
      service: { select: { name: true, price: true } },
      room: { select: { name: true } },
    },
  });

  if (!apt) return null;

  return {
    id: apt.id,
    startTime: apt.startTime,
    endTime: apt.endTime,
    status: apt.status,
    notes: apt.notes,
    createdAt: apt.createdAt,
    providerName: apt.provider.name,
    serviceName: apt.service?.name ?? null,
    servicePrice: apt.service?.price ? Number(apt.service.price) : null,
    roomName: apt.room?.name ?? null,
    patientId: apt.patient.id,
    patientFirstName: apt.patient.firstName,
    patientLastName: apt.patient.lastName,
    patientEmail: apt.patient.email,
    patientPhone: apt.patient.phone,
    patientDateOfBirth: apt.patient.dateOfBirth,
    patientGender: apt.patient.gender,
    patientAllergies: apt.patient.allergies,
    patientCreatedAt: apt.patient.createdAt,
    patientVisitCount: apt.patient._count.appointments,
  };
}

// ===========================================
// CREATE/UPDATE/DELETE OPERATIONS
// ===========================================

export type CreateAppointmentInput = {
  patientId: string;
  providerId: string;
  serviceId?: string;
  roomId?: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  notes?: string;
};

/**
 * Create a new appointment
 */
export async function createAppointment(
  input: CreateAppointmentInput
): Promise<ActionResult<CalendarAppointment>> {
  const user = await requirePermission("appointments", "create");

  // Verify patient belongs to clinic
  const patient = await prisma.patient.findFirst({
    where: {
      id: input.patientId,
      clinicId: user.clinicId,
      deletedAt: null,
    },
  });

  if (!patient) {
    return { success: false, error: "Patient not found" };
  }

  // Verify provider belongs to clinic
  const provider = await prisma.user.findFirst({
    where: {
      id: input.providerId,
      clinicId: user.clinicId,
      isActive: true,
    },
  });

  if (!provider) {
    return { success: false, error: "Provider not found" };
  }

  // Verify service if provided
  if (input.serviceId) {
    const service = await prisma.service.findFirst({
      where: {
        id: input.serviceId,
        clinicId: user.clinicId,
        isActive: true,
      },
    });
    if (!service) {
      return { success: false, error: "Service not found" };
    }
  }

  // Verify room if provided
  if (input.roomId) {
    const room = await prisma.room.findFirst({
      where: {
        id: input.roomId,
        clinicId: user.clinicId,
        isActive: true,
      },
    });
    if (!room) {
      return { success: false, error: "Room not found" };
    }
  }

  const appointment = await prisma.appointment.create({
    data: {
      clinicId: user.clinicId,
      patientId: input.patientId,
      providerId: input.providerId,
      serviceId: input.serviceId || null,
      roomId: input.roomId || null,
      startTime: new Date(input.startTime),
      endTime: new Date(input.endTime),
      notes: input.notes || null,
      status: "Scheduled",
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      provider: { select: { name: true } },
      service: { select: { name: true } },
      room: { select: { name: true } },
    },
  });

  revalidatePath("/calendar");

  return {
    success: true,
    data: {
      id: appointment.id,
      patientId: appointment.patientId,
      patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
      providerId: appointment.providerId,
      providerName: appointment.provider.name,
      serviceId: appointment.serviceId,
      serviceName: appointment.service?.name ?? null,
      roomId: appointment.roomId,
      roomName: appointment.room?.name ?? null,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      status: appointment.status,
      notes: appointment.notes,
    },
  };
}

export type UpdateAppointmentInput = {
  patientId?: string;
  providerId?: string;
  serviceId?: string | null;
  roomId?: string | null;
  startTime?: string;
  endTime?: string;
  notes?: string;
};

/**
 * Update an existing appointment
 */
export async function updateAppointment(
  id: string,
  input: UpdateAppointmentInput
): Promise<ActionResult> {
  const user = await requirePermission("appointments", "edit");

  // Verify appointment exists and belongs to clinic
  const existing = await prisma.appointment.findFirst({
    where: {
      id,
      clinicId: user.clinicId,
      deletedAt: null,
    },
  });

  if (!existing) {
    return { success: false, error: "Appointment not found" };
  }

  // Build update data
  const updateData: Record<string, unknown> = {};

  if (input.patientId !== undefined) {
    const patient = await prisma.patient.findFirst({
      where: { id: input.patientId, clinicId: user.clinicId, deletedAt: null },
    });
    if (!patient) return { success: false, error: "Patient not found" };
    updateData.patientId = input.patientId;
  }

  if (input.providerId !== undefined) {
    const provider = await prisma.user.findFirst({
      where: { id: input.providerId, clinicId: user.clinicId, isActive: true },
    });
    if (!provider) return { success: false, error: "Provider not found" };
    updateData.providerId = input.providerId;
  }

  if (input.serviceId !== undefined) {
    if (input.serviceId) {
      const service = await prisma.service.findFirst({
        where: { id: input.serviceId, clinicId: user.clinicId, isActive: true },
      });
      if (!service) return { success: false, error: "Service not found" };
    }
    updateData.serviceId = input.serviceId || null;
  }

  if (input.roomId !== undefined) {
    if (input.roomId) {
      const room = await prisma.room.findFirst({
        where: { id: input.roomId, clinicId: user.clinicId, isActive: true },
      });
      if (!room) return { success: false, error: "Room not found" };
    }
    updateData.roomId = input.roomId || null;
  }

  if (input.startTime !== undefined) {
    updateData.startTime = new Date(input.startTime);
  }

  if (input.endTime !== undefined) {
    updateData.endTime = new Date(input.endTime);
  }

  if (input.notes !== undefined) {
    updateData.notes = input.notes || null;
  }

  await prisma.appointment.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/calendar");

  return { success: true };
}

/**
 * Update appointment status
 */
export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus
): Promise<ActionResult> {
  const user = await requirePermission("appointments", "edit");

  const existing = await prisma.appointment.findFirst({
    where: {
      id,
      clinicId: user.clinicId,
      deletedAt: null,
    },
  });

  if (!existing) {
    return { success: false, error: "Appointment not found" };
  }

  await prisma.appointment.update({
    where: { id },
    data: { status },
  });

  revalidatePath("/calendar");
  revalidatePath("/today");

  return { success: true };
}

/**
 * Soft delete an appointment
 */
export async function deleteAppointment(id: string): Promise<ActionResult> {
  const user = await requirePermission("appointments", "delete");

  const existing = await prisma.appointment.findFirst({
    where: {
      id,
      clinicId: user.clinicId,
      deletedAt: null,
    },
  });

  if (!existing) {
    return { success: false, error: "Appointment not found" };
  }

  await prisma.appointment.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/calendar");

  return { success: true };
}

// ===========================================
// PERMISSION HELPERS
// ===========================================

/**
 * Get user's appointment permissions
 */
export async function getAppointmentPermissions(): Promise<{
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}> {
  const user = await requirePermission("appointments", "view");

  return {
    canView: true, // If we got here, they can view
    canCreate: hasPermission(user.role, "appointments", "create"),
    canEdit: hasPermission(user.role, "appointments", "edit"),
    canDelete: hasPermission(user.role, "appointments", "delete"),
  };
}

/**
 * Get last 5 purchased items (services/products) for a patient
 */
export type PatientTransaction = {
  id: string;
  description: string;
  date: Date;
  amount: number;
  isService: boolean;
};

export async function getPatientTransactionHistory(
  patientId: string
): Promise<PatientTransaction[]> {
  const user = await requirePermission("invoices", "view");

  const items = await prisma.invoiceItem.findMany({
    where: {
      deletedAt: null,
      clinicId: user.clinicId,
      invoice: {
        patientId,
        clinicId: user.clinicId,
        deletedAt: null,
      },
    },
    include: {
      invoice: { select: { createdAt: true } },
    },
    orderBy: { invoice: { createdAt: "desc" } },
    take: 5,
  });

  return items.map((item) => ({
    id: item.id,
    description: item.description,
    date: item.invoice.createdAt,
    amount: item.total,
    isService: !!item.serviceId,
  }));
}

/**
 * Quick create a patient for inline appointment creation
 */
export async function quickCreatePatient(input: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}): Promise<PatientSearchResult> {
  const user = await requirePermission("patients", "create");

  const patient = await prisma.patient.create({
    data: {
      clinicId: user.clinicId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email || null,
      phone: input.phone || null,
    },
  });

  revalidatePath("/patients");

  return {
    id: patient.id,
    firstName: patient.firstName,
    lastName: patient.lastName,
    email: patient.email,
    phone: patient.phone,
  };
}
