"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { derivePhase } from "@/lib/today-utils";
import type { AppointmentStatus, AuditAction, ChartStatus, EncounterStatus, Role } from "@prisma/client";
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
  hasEncounter: boolean;
  encounterId: string | null;
  encounterStatus: EncounterStatus | null;
  hasInvoice: boolean;
};

export type TodayPermissions = {
  canConfirm: boolean;
  canCheckIn: boolean;
  canStartSession: boolean;
  canBeginService: boolean;
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
      encounter: { select: { id: true, status: true } },
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
    hasEncounter: !!apt.encounter,
    encounterId: apt.encounter?.id ?? null,
    encounterStatus: apt.encounter?.status ?? null,
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

  const canBeginService = ["FrontDesk", "Provider", "Admin", "Owner"].includes(role);

  return {
    canConfirm: isFrontDeskPlus,
    canCheckIn: isFrontDeskPlus,
    canStartSession: isProviderPlus,
    canBeginService,
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

// ===========================================
// BEGIN SERVICE (unified start session + create chart + treatment card)
// ===========================================

function deriveTreatmentCardType(serviceCategory: string | null | undefined): "Injectable" | "Laser" | "Esthetics" | "Other" {
  if (!serviceCategory) return "Other";
  const lower = serviceCategory.toLowerCase();
  if (lower.includes("injectable") || lower.includes("filler") || lower.includes("neurotoxin")) return "Injectable";
  if (lower.includes("laser") || lower.includes("energy")) return "Laser";
  if (lower.includes("esthetic") || lower.includes("skin treatment") || lower.includes("peel") || lower.includes("microneedling")) return "Esthetics";
  return "Other";
}

export async function beginService(appointmentId: string): Promise<{
  success: boolean;
  data?: { chartId: string; encounterId: string };
  error?: string;
}> {
  const user = await requirePermission("appointments", "edit");

  if (!["FrontDesk", "Provider", "Admin", "Owner"].includes(user.role)) {
    return { success: false, error: "Permission denied" };
  }

  const apt = await prisma.appointment.findFirst({
    where: { id: appointmentId, clinicId: user.clinicId, deletedAt: null },
    include: {
      service: { select: { category: true } },
      chart: { select: { id: true, treatmentCards: { select: { id: true } } } },
      encounter: { select: { id: true, chart: { select: { id: true } } } },
    },
  });

  if (!apt) return { success: false, error: "Appointment not found" };

  // Idempotency: if already InProgress, return existing encounter's chart
  if (apt.status === "InProgress" && apt.encounter?.chart) {
    return { success: true, data: { chartId: apt.encounter.chart.id, encounterId: apt.encounter.id } };
  }

  if (apt.status !== "CheckedIn") {
    return { success: false, error: "Patient must be checked in first" };
  }

  const templateType = deriveTreatmentCardType(apt.service?.category);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Transition appointment to InProgress
    await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: "InProgress", startedAt: new Date() },
    });

    // 2. Create Encounter (idempotent via appointmentId @unique)
    let encounter = apt.encounter;
    if (!encounter) {
      encounter = await tx.encounter.create({
        data: {
          appointmentId,
          clinicId: user.clinicId,
          patientId: apt.patientId,
          providerId: apt.providerId,
          status: "Draft",
        },
        include: { chart: { select: { id: true } } },
      });
    }

    // 3. Create Chart with encounterId + dual-write legacy fields
    let chart = apt.chart ?? encounter.chart;
    if (!chart) {
      const newChart = await tx.chart.create({
        data: {
          clinicId: user.clinicId,
          encounterId: encounter.id,
          // Dual-write legacy fields
          patientId: apt.patientId,
          appointmentId: appointmentId,
          createdById: user.id,
          status: "Draft",
        },
        include: { treatmentCards: { select: { id: true } } },
      });
      chart = newChart;
    }

    // 4. Create initial TreatmentCard if none exists
    const treatmentCards = 'treatmentCards' in chart ? (chart as { treatmentCards: { id: string }[] }).treatmentCards : [];
    let treatmentCardId: string | null = null;
    if (treatmentCards.length === 0) {
      const card = await tx.treatmentCard.create({
        data: {
          chartId: chart.id,
          templateType,
          title: templateType,
          narrativeText: "",
          structuredData: "{}",
          sortOrder: 0,
        },
      });
      treatmentCardId = card.id;
    } else {
      treatmentCardId = treatmentCards[0].id;
    }

    // 5. Audit log
    await tx.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "BeginService",
        entityType: "Appointment",
        entityId: appointmentId,
        details: JSON.stringify({
          appointmentId,
          encounterId: encounter.id,
          chartId: chart.id,
          treatmentCardId,
        }),
      },
    });

    return { chartId: chart.id, encounterId: encounter.id };
  });

  revalidatePath("/today");
  revalidatePath("/calendar");
  return { success: true, data: result };
}
