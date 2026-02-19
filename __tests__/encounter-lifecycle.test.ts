import { describe, it, expect, beforeAll } from "vitest";
import { PrismaClient, type Role } from "@prisma/client";
import { createHash } from "crypto";
import { hasPermission } from "@/lib/rbac-core";

const prisma = new PrismaClient();

interface TestUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  clinicId: string;
}

function deriveTreatmentCardType(
  serviceCategory: string | null | undefined
): "Injectable" | "Laser" | "Esthetics" | "Other" {
  if (!serviceCategory) return "Other";
  const lower = serviceCategory.toLowerCase();
  if (lower.includes("injectable") || lower.includes("filler")) return "Injectable";
  if (lower.includes("laser")) return "Laser";
  if (lower.includes("esthetic") || lower.includes("peel")) return "Esthetics";
  return "Other";
}

// Inline beginService
async function testBeginService(
  appointmentId: string,
  user: TestUser
): Promise<{ success: boolean; data?: { chartId: string; encounterId: string }; error?: string }> {
  if (!hasPermission(user.role, "appointments", "edit")) {
    return { success: false, error: `Permission denied` };
  }
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

  if (apt.status === "InProgress" && apt.encounter?.chart) {
    return { success: true, data: { chartId: apt.encounter.chart.id, encounterId: apt.encounter.id } };
  }

  if (apt.status !== "CheckedIn") {
    return { success: false, error: "Patient must be checked in first" };
  }

  const templateType = deriveTreatmentCardType(apt.service?.category);

  const result = await prisma.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: "InProgress", startedAt: new Date() },
    });

    const encounter = await tx.encounter.create({
      data: {
        appointmentId,
        clinicId: user.clinicId,
        patientId: apt.patientId,
        providerId: apt.providerId,
        status: "Draft",
      },
    });

    const chart = await tx.chart.create({
      data: {
        clinicId: user.clinicId,
        encounterId: encounter.id,
        patientId: apt.patientId,
        appointmentId,
        createdById: user.id,
        status: "Draft",
      },
    });

    await tx.treatmentCard.create({
      data: {
        chartId: chart.id,
        templateType,
        title: templateType,
        narrativeText: "",
        structuredData: "{}",
        sortOrder: 0,
      },
    });

    return { chartId: chart.id, encounterId: encounter.id };
  });

  return { success: true, data: result };
}

// Inline submitForReview (dual-write)
async function testSubmitForReview(
  chartId: string,
  user: TestUser
): Promise<{ success: boolean; error?: string }> {
  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    include: { encounter: { select: { id: true, status: true } } },
  });

  if (!chart) return { success: false, error: "Chart not found" };
  if (user.clinicId !== chart.clinicId) return { success: false, error: "Access denied" };

  const isDraft = chart.encounter
    ? chart.encounter.status === "Draft"
    : chart.status === "Draft";
  if (!isDraft) return { success: false, error: "Only draft charts can be submitted" };

  await prisma.chart.update({
    where: { id: chartId },
    data: { status: "NeedsSignOff" },
  });

  if (chart.encounter) {
    await prisma.encounter.update({
      where: { id: chart.encounter.id },
      data: { status: "PendingReview" },
    });
  }

  return { success: true };
}

// Inline signChart (dual-write)
async function testSignChart(
  chartId: string,
  user: TestUser
): Promise<{ success: boolean; error?: string }> {
  if (!hasPermission(user.role, "charts", "sign")) {
    return { success: false, error: `Permission denied` };
  }

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    include: { encounter: { select: { id: true, status: true } } },
  });

  if (!chart) return { success: false, error: "Chart not found" };
  if (user.clinicId !== chart.clinicId) return { success: false, error: "Access denied" };

  const isNeedsSignOff = chart.encounter
    ? chart.encounter.status === "PendingReview"
    : chart.status === "NeedsSignOff";
  if (!isNeedsSignOff) return { success: false, error: "Chart not ready for signing" };

  const signedAt = new Date();
  const content = JSON.stringify({ id: chart.id, chiefComplaint: chart.chiefComplaint });
  const recordHash = `sha256:${createHash("sha256").update(content).digest("hex")}`;

  await prisma.chart.update({
    where: { id: chartId },
    data: {
      status: "MDSigned",
      signedById: user.id,
      signedByName: user.name,
      signedAt,
      recordHash,
    },
  });

  if (chart.encounter) {
    await prisma.encounter.update({
      where: { id: chart.encounter.id },
      data: { status: "Finalized", finalizedAt: signedAt },
    });
  }

  return { success: true };
}

// Inline updateChart
async function testUpdateChart(
  chartId: string,
  data: { chiefComplaint?: string },
  user: TestUser
): Promise<{ success: boolean; error?: string }> {
  if (!hasPermission(user.role, "charts", "edit")) {
    return { success: false, error: `Permission denied` };
  }

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    include: { encounter: { select: { status: true } } },
  });

  if (!chart) return { success: false, error: "Chart not found" };
  if (user.clinicId !== chart.clinicId) return { success: false, error: "Access denied" };

  const effectiveStatus = chart.encounter?.status === "Finalized" ? "MDSigned" : chart.status;
  if (effectiveStatus === "MDSigned") {
    return { success: false, error: "Cannot edit a signed chart" };
  }

  await prisma.chart.update({
    where: { id: chartId },
    data: { ...data, updatedAt: new Date() },
  });

  return { success: true };
}

describe("Encounter Lifecycle", () => {
  let clinic: { id: string };
  let providerUser: TestUser;
  let mdUser: TestUser;
  let patientId: string;
  let serviceId: string;

  beforeAll(async () => {
    clinic = await prisma.clinic.create({
      data: {
        name: "Test Clinic - Encounter Lifecycle",
        slug: `test-encounter-${Date.now()}`,
      },
    });

    const provider = await prisma.user.create({
      data: {
        clinicId: clinic.id,
        email: `provider-enc-${Date.now()}@test.com`,
        name: "Test Provider",
        role: "Provider",
      },
    });
    providerUser = {
      id: provider.id,
      email: provider.email,
      name: provider.name,
      role: provider.role,
      clinicId: provider.clinicId,
    };

    const md = await prisma.user.create({
      data: {
        clinicId: clinic.id,
        email: `md-enc-${Date.now()}@test.com`,
        name: "Test MD",
        role: "MedicalDirector",
      },
    });
    mdUser = {
      id: md.id,
      email: md.email,
      name: md.name,
      role: md.role,
      clinicId: md.clinicId,
    };

    const patient = await prisma.patient.create({
      data: { clinicId: clinic.id, firstName: "Test", lastName: "Patient" },
    });
    patientId = patient.id;

    const service = await prisma.service.create({
      data: {
        clinicId: clinic.id,
        name: "Test Botox",
        duration: 30,
        price: 350,
        category: "Injectables",
      },
    });
    serviceId = service.id;
  });

  it("encounter is created with Draft status after beginService", async () => {
    const apt = await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId,
        providerId: providerUser.id,
        serviceId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60000),
        status: "CheckedIn",
        checkedInAt: new Date(),
      },
    });

    const result = await testBeginService(apt.id, providerUser);
    expect(result.success).toBe(true);

    const encounter = await prisma.encounter.findUnique({
      where: { id: result.data!.encounterId },
    });
    expect(encounter!.status).toBe("Draft");
    expect(encounter!.finalizedAt).toBeNull();
  });

  it("full lifecycle: Draft -> PendingReview -> Finalized", async () => {
    const apt = await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId,
        providerId: providerUser.id,
        serviceId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60000),
        status: "CheckedIn",
        checkedInAt: new Date(),
      },
    });

    // Begin service -> encounter Draft
    const beginResult = await testBeginService(apt.id, providerUser);
    expect(beginResult.success).toBe(true);
    const { encounterId, chartId } = beginResult.data!;

    let encounter = await prisma.encounter.findUnique({ where: { id: encounterId } });
    expect(encounter!.status).toBe("Draft");

    // Submit for review -> encounter PendingReview
    const submitResult = await testSubmitForReview(chartId, providerUser);
    expect(submitResult.success).toBe(true);

    encounter = await prisma.encounter.findUnique({ where: { id: encounterId } });
    expect(encounter!.status).toBe("PendingReview");

    const chart = await prisma.chart.findUnique({ where: { id: chartId } });
    expect(chart!.status).toBe("NeedsSignOff");

    // Sign -> encounter Finalized
    const signResult = await testSignChart(chartId, mdUser);
    expect(signResult.success).toBe(true);

    encounter = await prisma.encounter.findUnique({ where: { id: encounterId } });
    expect(encounter!.status).toBe("Finalized");
    expect(encounter!.finalizedAt).not.toBeNull();

    const signedChart = await prisma.chart.findUnique({ where: { id: chartId } });
    expect(signedChart!.status).toBe("MDSigned");
  });

  it("encounter has 1:1 with chart and 1:1 with appointment", async () => {
    const apt = await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId,
        providerId: providerUser.id,
        serviceId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60000),
        status: "CheckedIn",
        checkedInAt: new Date(),
      },
    });

    const result = await testBeginService(apt.id, providerUser);
    expect(result.success).toBe(true);

    const encounter = await prisma.encounter.findUnique({
      where: { id: result.data!.encounterId },
      include: { chart: true, appointment: true },
    });

    expect(encounter!.chart).not.toBeNull();
    expect(encounter!.chart!.id).toBe(result.data!.chartId);
    expect(encounter!.appointment.id).toBe(apt.id);
  });

  it("tenant isolation on encounters", async () => {
    const otherClinic = await prisma.clinic.create({
      data: { name: "Other Clinic", slug: `other-enc-${Date.now()}` },
    });
    const otherProvider = await prisma.user.create({
      data: {
        clinicId: otherClinic.id,
        email: `other-enc-${Date.now()}@test.com`,
        name: "Other Provider",
        role: "Provider",
      },
    });
    const otherUser: TestUser = {
      id: otherProvider.id,
      email: otherProvider.email,
      name: otherProvider.name,
      role: otherProvider.role,
      clinicId: otherProvider.clinicId,
    };

    const apt = await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId,
        providerId: providerUser.id,
        serviceId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60000),
        status: "CheckedIn",
        checkedInAt: new Date(),
      },
    });

    // Other clinic user cannot begin service
    const result = await testBeginService(apt.id, otherUser);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Appointment not found");
  });

  it("cannot modify chart when encounter is Finalized", async () => {
    const apt = await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId,
        providerId: providerUser.id,
        serviceId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60000),
        status: "CheckedIn",
        checkedInAt: new Date(),
      },
    });

    const beginResult = await testBeginService(apt.id, providerUser);
    const { chartId, encounterId } = beginResult.data!;

    // Submit and sign
    await testSubmitForReview(chartId, providerUser);
    await testSignChart(chartId, mdUser);

    // Verify encounter is finalized
    const encounter = await prisma.encounter.findUnique({ where: { id: encounterId } });
    expect(encounter!.status).toBe("Finalized");

    // Try to edit chart -> should fail
    const editResult = await testUpdateChart(
      chartId,
      { chiefComplaint: "Should not work" },
      providerUser
    );
    expect(editResult.success).toBe(false);
    expect(editResult.error).toBe("Cannot edit a signed chart");
  });
});
