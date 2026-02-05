"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { derivePhase } from "@/lib/today-utils";
import type { AppointmentStatus, AuditAction, ChartStatus, Role } from "@prisma/client";
import type { JourneyPhase } from "@/lib/today-utils";

// ===========================================
// TYPES
// ===========================================

// Re-export types from shared utils for consumer convenience
export type { JourneyPhase } from "@/lib/today-utils";

export type TodayAppointment = {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string | null;
  patientPhone: string | null;
  providerId: string;
  providerName: string;
  serviceId: string | null;
  serviceName: string | null;
  servicePrice: number | null;
  roomId: string | null;
  roomName: string | null;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatus;
  notes: string | null;
  checkedInAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  checkedOutAt: Date | null;
  phase: JourneyPhase;
  hasChart: boolean;
  chartId: string | null;
  chartStatus: ChartStatus | null;
  hasInvoice: boolean;
};

export type TodayPermissions = {
  canConfirm: boolean;
  canCheckIn: boolean;
  canStartSession: boolean;
  canCompleteSession: boolean;
  canCheckOut: boolean;
  canOpenChart: boolean;
  canEdit: boolean;
};

// ===========================================
// READ OPERATIONS
// ===========================================

export async function getTodayAppointments(filters?: {
  providerId?: string;
  roomId?: string;
  phase?: JourneyPhase;
  search?: string;
}): Promise<TodayAppointment[]> {
  const user = await requirePermission("appointments", "view");

  // Get clinic timezone
  const clinic = await prisma.clinic.findUnique({
    where: { id: user.clinicId },
    select: { timezone: true },
  });
  const tz = clinic?.timezone || "America/New_York";

  // Calculate today's start/end in clinic timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayStr = formatter.format(now); // YYYY-MM-DD

  const startOfDay = new Date(`${todayStr}T00:00:00`);
  const endOfDay = new Date(`${todayStr}T23:59:59.999`);

  // Build where clause
  const where: Record<string, unknown> = {
    clinicId: user.clinicId,
    deletedAt: null,
    startTime: { gte: startOfDay, lte: endOfDay },
  };

  if (filters?.providerId) {
    where.providerId = filters.providerId;
  }
  if (filters?.roomId) {
    where.roomId = filters.roomId;
  }

  // Search filter on patient name, phone, email
  if (filters?.search && filters.search.trim().length >= 2) {
    const term = filters.search.trim().toLowerCase();
    where.patient = {
      OR: [
        { firstName: { contains: term } },
        { lastName: { contains: term } },
        { email: { contains: term } },
        { phone: { contains: term } },
      ],
    };
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      patient: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      provider: { select: { name: true } },
      service: { select: { name: true, price: true } },
      room: { select: { name: true } },
      chart: { select: { id: true, status: true } },
      invoice: { select: { id: true } },
    },
    orderBy: { startTime: "asc" },
  });

  let results: TodayAppointment[] = appointments.map((apt) => ({
    id: apt.id,
    patientId: apt.patientId,
    patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
    patientEmail: apt.patient.email,
    patientPhone: apt.patient.phone,
    providerId: apt.providerId,
    providerName: apt.provider.name,
    serviceId: apt.serviceId,
    serviceName: apt.service?.name ?? null,
    servicePrice: apt.service?.price ? Number(apt.service.price) : null,
    roomId: apt.roomId,
    roomName: apt.room?.name ?? null,
    startTime: apt.startTime,
    endTime: apt.endTime,
    status: apt.status,
    notes: apt.notes,
    checkedInAt: apt.checkedInAt,
    startedAt: apt.startedAt,
    completedAt: apt.completedAt,
    checkedOutAt: apt.checkedOutAt,
    phase: derivePhase(apt),
    hasChart: !!apt.chart,
    chartId: apt.chart?.id ?? null,
    chartStatus: apt.chart?.status ?? null,
    hasInvoice: !!apt.invoice,
  }));

  // Filter by phase if specified
  if (filters?.phase) {
    results = results.filter((apt) => apt.phase === filters.phase);
  }

  return results;
}

export async function getClinicTimezone(): Promise<string> {
  const user = await requirePermission("appointments", "view");

  const clinic = await prisma.clinic.findUnique({
    where: { id: user.clinicId },
    select: { timezone: true },
  });

  return clinic?.timezone || "America/New_York";
}

export async function getTodayPermissions(): Promise<TodayPermissions> {
  const user = await requirePermission("appointments", "view");
  const role = user.role as Role;

  // FrontDesk/Admin/Owner can confirm, check in, check out
  const isFrontDeskPlus = ["FrontDesk", "Admin", "Owner"].includes(role);
  // Provider/Admin/Owner/MD can start and complete sessions
  const isProviderPlus = ["Provider", "Admin", "Owner", "MedicalDirector"].includes(role);

  return {
    canConfirm: isFrontDeskPlus,
    canCheckIn: isFrontDeskPlus,
    canStartSession: isProviderPlus,
    canCompleteSession: isProviderPlus,
    canCheckOut: isFrontDeskPlus,
    canOpenChart: hasPermission(role, "charts", "view"),
    canEdit: hasPermission(role, "appointments", "edit"),
  };
}

export async function getAppointmentTimestamps(id: string): Promise<{
  checkedInAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  checkedOutAt: Date | null;
}> {
  const user = await requirePermission("appointments", "view");

  const apt = await prisma.appointment.findFirst({
    where: { id, clinicId: user.clinicId, deletedAt: null },
    select: {
      checkedInAt: true,
      startedAt: true,
      completedAt: true,
      checkedOutAt: true,
    },
  });

  return {
    checkedInAt: apt?.checkedInAt ?? null,
    startedAt: apt?.startedAt ?? null,
    completedAt: apt?.completedAt ?? null,
    checkedOutAt: apt?.checkedOutAt ?? null,
  };
}

// ===========================================
// WORKFLOW MUTATIONS
// ===========================================

async function writeAuditLog(
  clinicId: string,
  userId: string,
  action: AuditAction,
  entityId: string,
  details?: Record<string, unknown>
) {
  await prisma.auditLog.create({
    data: {
      clinicId,
      userId,
      action,
      entityType: "Appointment",
      entityId,
      details: details ? JSON.stringify(details) : null,
    },
  });
}

export async function confirmAppointment(id: string) {
  const user = await requirePermission("appointments", "edit");
  if (!["FrontDesk", "Admin", "Owner"].includes(user.role)) {
    return { success: false, error: "Permission denied" };
  }

  const apt = await prisma.appointment.findFirst({
    where: { id, clinicId: user.clinicId, deletedAt: null },
  });
  if (!apt) return { success: false, error: "Appointment not found" };
  if (apt.status !== "Scheduled") {
    return { success: false, error: "Can only confirm scheduled appointments" };
  }

  await prisma.appointment.update({
    where: { id },
    data: { status: "Confirmed" },
  });

  await writeAuditLog(user.clinicId, user.id, "AppointmentConfirm", id, {
    previousStatus: apt.status,
  });

  revalidatePath("/today");
  revalidatePath("/calendar");
  return { success: true };
}

export async function checkInAppointment(id: string) {
  const user = await requirePermission("appointments", "edit");
  if (!["FrontDesk", "Admin", "Owner"].includes(user.role)) {
    return { success: false, error: "Permission denied" };
  }

  const apt = await prisma.appointment.findFirst({
    where: { id, clinicId: user.clinicId, deletedAt: null },
  });
  if (!apt) return { success: false, error: "Appointment not found" };
  if (!["Scheduled", "Confirmed"].includes(apt.status)) {
    return { success: false, error: "Can only check in scheduled or confirmed appointments" };
  }

  await prisma.appointment.update({
    where: { id },
    data: {
      status: "CheckedIn",
      checkedInAt: new Date(),
    },
  });

  await writeAuditLog(user.clinicId, user.id, "AppointmentCheckIn", id, {
    previousStatus: apt.status,
  });

  revalidatePath("/today");
  revalidatePath("/calendar");
  return { success: true };
}

export async function startSession(id: string) {
  const user = await requirePermission("appointments", "edit");
  if (!["Provider", "Admin", "Owner", "MedicalDirector"].includes(user.role)) {
    return { success: false, error: "Permission denied" };
  }

  const apt = await prisma.appointment.findFirst({
    where: { id, clinicId: user.clinicId, deletedAt: null },
  });
  if (!apt) return { success: false, error: "Appointment not found" };
  if (apt.status !== "CheckedIn") {
    return { success: false, error: "Patient must be checked in first" };
  }

  await prisma.appointment.update({
    where: { id },
    data: {
      status: "InProgress",
      startedAt: new Date(),
    },
  });

  await writeAuditLog(user.clinicId, user.id, "AppointmentStart", id, {
    previousStatus: apt.status,
  });

  revalidatePath("/today");
  revalidatePath("/calendar");
  return { success: true };
}

export async function completeSession(id: string) {
  const user = await requirePermission("appointments", "edit");
  if (!["Provider", "Admin", "Owner", "MedicalDirector"].includes(user.role)) {
    return { success: false, error: "Permission denied" };
  }

  const apt = await prisma.appointment.findFirst({
    where: { id, clinicId: user.clinicId, deletedAt: null },
  });
  if (!apt) return { success: false, error: "Appointment not found" };
  if (apt.status !== "InProgress") {
    return { success: false, error: "Session must be in progress to complete" };
  }

  await prisma.appointment.update({
    where: { id },
    data: {
      status: "Completed",
      completedAt: new Date(),
    },
  });

  await writeAuditLog(user.clinicId, user.id, "AppointmentComplete", id, {
    previousStatus: apt.status,
  });

  revalidatePath("/today");
  revalidatePath("/calendar");
  return { success: true };
}

export async function checkOutAppointment(id: string) {
  const user = await requirePermission("appointments", "edit");
  if (!["FrontDesk", "Admin", "Owner"].includes(user.role)) {
    return { success: false, error: "Permission denied" };
  }

  const apt = await prisma.appointment.findFirst({
    where: { id, clinicId: user.clinicId, deletedAt: null },
  });
  if (!apt) return { success: false, error: "Appointment not found" };
  if (apt.status !== "Completed") {
    return { success: false, error: "Appointment must be completed to check out" };
  }
  if (apt.checkedOutAt) {
    return { success: false, error: "Already checked out" };
  }

  await prisma.appointment.update({
    where: { id },
    data: { checkedOutAt: new Date() },
  });

  await writeAuditLog(user.clinicId, user.id, "AppointmentCheckOut", id);

  revalidatePath("/today");
  revalidatePath("/calendar");
  return { success: true };
}
