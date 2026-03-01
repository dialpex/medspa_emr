import { describe, it, expect, beforeAll, afterAll } from "vitest";
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

// Inline record hash generator (matches lib/actions/charts.ts)
function generateRecordHash(chart: {
  id: string;
  chiefComplaint: string | null;
  areasTreated: string | null;
  productsUsed: string | null;
  dosageUnits: string | null;
  aftercareNotes: string | null;
  additionalNotes: string | null;
  treatmentCards?: Array<{
    narrativeText: string;
    structuredData: string;
    sortOrder: number;
  }>;
}): string {
  const cards = (chart.treatmentCards ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({ narrative: c.narrativeText, structured: c.structuredData }));

  const content = JSON.stringify({
    id: chart.id,
    chiefComplaint: chart.chiefComplaint,
    areasTreated: chart.areasTreated,
    productsUsed: chart.productsUsed,
    dosageUnits: chart.dosageUnits,
    aftercareNotes: chart.aftercareNotes,
    additionalNotes: chart.additionalNotes,
    treatmentCards: cards,
  });
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

// Inline providerSign that mirrors _providerSign logic
async function testProviderSign(
  chartId: string,
  user: TestUser
): Promise<{ success: boolean; error?: string }> {
  if (!hasPermission(user.role, "charts", "edit")) {
    return { success: false, error: `Permission denied: ${user.role} cannot edit charts` };
  }

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    include: {
      encounter: { select: { id: true, status: true } },
      treatmentCards: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!chart) return { success: false, error: "Chart not found" };
  if (user.clinicId !== chart.clinicId) {
    return { success: false, error: "Access denied: resource belongs to different clinic" };
  }

  const isDraft = chart.encounter
    ? chart.encounter.status === "Draft"
    : chart.status === "Draft";
  if (!isDraft) return { success: false, error: "Only draft charts can be signed" };

  // Load user's requiresMDReview
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { requiresMDReview: true },
  });

  const signedAt = new Date();
  const recordHash = generateRecordHash({ ...chart, treatmentCards: chart.treatmentCards });

  if (fullUser?.requiresMDReview) {
    await prisma.$transaction(async (tx) => {
      await tx.chart.update({
        where: { id: chartId },
        data: {
          status: "NeedsSignOff",
          providerSignedAt: signedAt,
          providerSignedById: user.id,
          recordHash,
          updatedAt: signedAt,
        },
      });
      if (chart.encounter) {
        await tx.encounter.update({
          where: { id: chart.encounter.id },
          data: { status: "PendingReview" },
        });
      }
      await tx.auditLog.create({
        data: {
          clinicId: user.clinicId,
          userId: user.id,
          action: "ChartProviderSign",
          entityType: "Chart",
          entityId: chartId,
          details: JSON.stringify({
            patientId: chart.patientId,
            encounterId: chart.encounter?.id,
            submittedForReview: true,
            recordHash,
          }),
        },
      });
    });
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.chart.update({
        where: { id: chartId },
        data: {
          status: "MDSigned",
          signedById: user.id,
          signedByName: user.name,
          signedAt,
          recordHash,
          updatedAt: signedAt,
        },
      });
      if (chart.encounter) {
        await tx.encounter.update({
          where: { id: chart.encounter.id },
          data: { status: "Finalized", finalizedAt: signedAt },
        });
      }
      await tx.auditLog.create({
        data: {
          clinicId: user.clinicId,
          userId: user.id,
          action: "ChartProviderSign",
          entityType: "Chart",
          entityId: chartId,
          details: JSON.stringify({
            patientId: chart.patientId,
            encounterId: chart.encounter?.id,
            finalizedDirectly: true,
            recordHash,
          }),
        },
      });
    });
  }

  return { success: true };
}

// Inline updateChart test variant
async function testUpdateChart(
  chartId: string,
  data: { chiefComplaint?: string },
  user: TestUser
): Promise<{ success: boolean; error?: string }> {
  if (!hasPermission(user.role, "charts", "edit")) {
    return { success: false, error: `Permission denied: ${user.role} cannot edit charts` };
  }

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    include: { encounter: { select: { status: true } } },
  });
  if (!chart) return { success: false, error: "Chart not found" };
  if (user.clinicId !== chart.clinicId) {
    return { success: false, error: "Access denied" };
  }

  const isDraft = chart.encounter
    ? chart.encounter.status === "Draft"
    : chart.status === "Draft";
  if (!isDraft) {
    return { success: false, error: "Cannot edit a non-draft chart" };
  }

  await prisma.chart.update({ where: { id: chartId }, data: { ...data, updatedAt: new Date() } });
  return { success: true };
}

// Inline updateTreatmentCard test variant
async function testUpdateTreatmentCard(
  cardId: string,
  data: { narrativeText?: string },
  user: TestUser
): Promise<{ success: boolean; error?: string }> {
  if (!hasPermission(user.role, "charts", "edit")) {
    return { success: false, error: `Permission denied: ${user.role} cannot edit charts` };
  }

  const card = await prisma.treatmentCard.findUnique({
    where: { id: cardId },
    include: {
      chart: {
        select: { id: true, clinicId: true, status: true, encounter: { select: { status: true } } },
      },
    },
  });
  if (!card) return { success: false, error: "Treatment card not found" };
  if (user.clinicId !== card.chart.clinicId) {
    return { success: false, error: "Access denied" };
  }

  const isDraft = card.chart.encounter
    ? card.chart.encounter.status === "Draft"
    : card.chart.status === "Draft";
  if (!isDraft) {
    return { success: false, error: "Cannot edit treatment cards on a non-draft chart" };
  }

  const updateData: { narrativeText?: string } = {};
  if (data.narrativeText !== undefined) updateData.narrativeText = data.narrativeText;
  await prisma.treatmentCard.update({ where: { id: cardId }, data: updateData });
  return { success: true };
}

// Inline coSign test variant
async function testCoSign(
  chartId: string,
  user: TestUser
): Promise<{ success: boolean; error?: string }> {
  if (!hasPermission(user.role, "charts", "sign")) {
    return { success: false, error: `Permission denied: ${user.role} cannot co-sign charts` };
  }

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    include: {
      encounter: { select: { id: true, status: true } },
      treatmentCards: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!chart) return { success: false, error: "Chart not found" };
  if (user.clinicId !== chart.clinicId) {
    return { success: false, error: "Access denied: resource belongs to different clinic" };
  }

  const isNeedsSignOff = chart.encounter
    ? chart.encounter.status === "PendingReview"
    : chart.status === "NeedsSignOff";
  if (!isNeedsSignOff) {
    return { success: false, error: "Only charts pending review can be co-signed" };
  }

  if (!chart.providerSignedAt) {
    return { success: false, error: "Chart has not been provider-signed yet" };
  }

  const signedAt = new Date();
  const recordHash = generateRecordHash({ ...chart, treatmentCards: chart.treatmentCards });

  await prisma.$transaction(async (tx) => {
    await tx.chart.update({
      where: { id: chartId },
      data: {
        status: "MDSigned",
        signedById: user.id,
        signedByName: user.name,
        signedAt,
        recordHash,
        updatedAt: signedAt,
      },
    });
    if (chart.encounter) {
      await tx.encounter.update({
        where: { id: chart.encounter.id },
        data: { status: "Finalized", finalizedAt: signedAt },
      });
    }
    await tx.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "MDCoSign",
        entityType: "Chart",
        entityId: chartId,
        details: JSON.stringify({
          patientId: chart.patientId,
          encounterId: chart.encounter?.id,
          providerSignedById: chart.providerSignedById,
          recordHash,
        }),
      },
    });
  });

  return { success: true };
}

describe("MD Review + Co-sign", () => {
  let mdUser: TestUser;
  let npProvider: TestUser;
  let regularProvider: TestUser;
  let frontDeskUser: TestUser;
  let clinicId: string;
  let patientId: string;

  // Track created entities for cleanup
  const createdAppointmentIds: string[] = [];
  const createdEncounterIds: string[] = [];
  const createdChartIds: string[] = [];
  const createdTreatmentCardIds: string[] = [];
  const createdClinicIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const md = await prisma.user.findFirst({ where: { role: "MedicalDirector" } });
    if (!md) throw new Error("MedicalDirector not found");

    const np = await prisma.user.findFirst({
      where: { role: "Provider", requiresMDReview: true },
    });
    if (!np) throw new Error("NP provider with requiresMDReview=true not found");

    const regular = await prisma.user.findFirst({
      where: { role: "Provider", requiresMDReview: false },
    });
    if (!regular) throw new Error("Regular provider not found");

    const fd = await prisma.user.findFirst({ where: { role: "FrontDesk" } });
    if (!fd) throw new Error("FrontDesk user not found");

    clinicId = md.clinicId;
    mdUser = { id: md.id, email: md.email, name: md.name, role: md.role, clinicId };
    npProvider = { id: np.id, email: np.email, name: np.name, role: np.role, clinicId };
    regularProvider = { id: regular.id, email: regular.email, name: regular.name, role: regular.role, clinicId };
    frontDeskUser = { id: fd.id, email: fd.email, name: fd.name, role: fd.role, clinicId };

    const patient = await prisma.patient.findFirst({ where: { clinicId } });
    if (!patient) throw new Error("No patient found");
    patientId = patient.id;
  });

  afterAll(async () => {
    // Clean up in FK-safe order
    await prisma.auditLog.deleteMany({ where: { entityId: { in: createdChartIds } } });
    await prisma.treatmentCard.deleteMany({ where: { id: { in: createdTreatmentCardIds } } });
    await prisma.chart.deleteMany({ where: { id: { in: createdChartIds } } });
    await prisma.encounter.deleteMany({ where: { id: { in: createdEncounterIds } } });
    await prisma.appointment.deleteMany({ where: { id: { in: createdAppointmentIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.clinic.deleteMany({ where: { id: { in: createdClinicIds } } });
  });

  async function createDraftChartWithEncounter(providerId: string) {
    const appointment = await prisma.appointment.create({
      data: {
        clinicId,
        patientId,
        providerId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60000),
        status: "InProgress",
      },
    });
    createdAppointmentIds.push(appointment.id);

    const encounter = await prisma.encounter.create({
      data: {
        appointmentId: appointment.id,
        clinicId,
        patientId,
        providerId,
        status: "Draft",
      },
    });
    createdEncounterIds.push(encounter.id);

    const chart = await prisma.chart.create({
      data: {
        clinicId,
        encounterId: encounter.id,
        patientId,
        appointmentId: appointment.id,
        createdById: providerId,
        status: "Draft",
        chiefComplaint: "Test chart for MD review",
      },
    });
    createdChartIds.push(chart.id);

    return { chart, encounter, appointment };
  }

  it("NP provider signs → PendingReview, providerSignedAt set", async () => {
    const { chart } = await createDraftChartWithEncounter(npProvider.id);

    const result = await testProviderSign(chart.id, npProvider);
    expect(result.success).toBe(true);

    const updated = await prisma.chart.findUnique({ where: { id: chart.id } });
    expect(updated?.status).toBe("NeedsSignOff");
    expect(updated?.providerSignedAt).toBeTruthy();
    expect(updated?.providerSignedById).toBe(npProvider.id);
    expect(updated?.recordHash).toMatch(/^sha256:/);
    expect(updated?.signedById).toBeNull();
    expect(updated?.signedAt).toBeNull();

    const enc = await prisma.encounter.findUnique({
      where: { id: updated?.encounterId ?? "" },
    });
    expect(enc?.status).toBe("PendingReview");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "ChartProviderSign", entityId: chart.id },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
    const details = JSON.parse(audit!.details!);
    expect(details.submittedForReview).toBe(true);
  });

  it("Regular provider signs → Finalized directly", async () => {
    const { chart } = await createDraftChartWithEncounter(regularProvider.id);

    const result = await testProviderSign(chart.id, regularProvider);
    expect(result.success).toBe(true);

    const updated = await prisma.chart.findUnique({ where: { id: chart.id } });
    expect(updated?.status).toBe("MDSigned");
    expect(updated?.signedById).toBe(regularProvider.id);
    expect(updated?.signedAt).toBeTruthy();

    const enc = await prisma.encounter.findUnique({
      where: { id: updated?.encounterId ?? "" },
    });
    expect(enc?.status).toBe("Finalized");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "ChartProviderSign", entityId: chart.id },
      orderBy: { createdAt: "desc" },
    });
    const details = JSON.parse(audit!.details!);
    expect(details.finalizedDirectly).toBe(true);
  });

  it("After NP provider sign (PendingReview), chart updates are rejected", async () => {
    const { chart } = await createDraftChartWithEncounter(npProvider.id);
    await testProviderSign(chart.id, npProvider);

    const result = await testUpdateChart(
      chart.id,
      { chiefComplaint: "Should be blocked" },
      npProvider
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("non-draft");
  });

  it("After NP provider sign (PendingReview), treatment card updates are rejected", async () => {
    const { chart } = await createDraftChartWithEncounter(npProvider.id);

    const card = await prisma.treatmentCard.create({
      data: {
        chartId: chart.id,
        templateType: "Injectable",
        title: "Test Card",
        narrativeText: "original",
        structuredData: "{}",
        sortOrder: 0,
      },
    });
    createdTreatmentCardIds.push(card.id);

    await testProviderSign(chart.id, npProvider);

    const result = await testUpdateTreatmentCard(
      card.id,
      { narrativeText: "Should be blocked" },
      npProvider
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("non-draft");
  });

  it("MD co-signs PendingReview chart → Finalized + signedAt set", async () => {
    const { chart } = await createDraftChartWithEncounter(npProvider.id);
    await testProviderSign(chart.id, npProvider);

    const result = await testCoSign(chart.id, mdUser);
    expect(result.success).toBe(true);

    const updated = await prisma.chart.findUnique({ where: { id: chart.id } });
    expect(updated?.status).toBe("MDSigned");
    expect(updated?.signedById).toBe(mdUser.id);
    expect(updated?.signedByName).toBe(mdUser.name);
    expect(updated?.signedAt).toBeTruthy();
    expect(updated?.providerSignedById).toBe(npProvider.id);
    expect(updated?.providerSignedAt).toBeTruthy();

    const enc = await prisma.encounter.findUnique({
      where: { id: updated?.encounterId ?? "" },
    });
    expect(enc?.status).toBe("Finalized");
    expect(enc?.finalizedAt).toBeTruthy();

    const audit = await prisma.auditLog.findFirst({
      where: { action: "MDCoSign", entityId: chart.id },
    });
    expect(audit).toBeTruthy();
    expect(audit?.userId).toBe(mdUser.id);
  });

  it("Non-MD cannot co-sign (permission denied)", async () => {
    const { chart } = await createDraftChartWithEncounter(npProvider.id);
    await testProviderSign(chart.id, npProvider);

    expect(hasPermission("FrontDesk", "charts", "sign")).toBe(false);
    const result = await testCoSign(chart.id, frontDeskUser);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Permission denied");
  });

  it("Co-sign on Draft chart fails (must be PendingReview)", async () => {
    const { chart } = await createDraftChartWithEncounter(npProvider.id);

    const result = await testCoSign(chart.id, mdUser);
    expect(result.success).toBe(false);
    expect(result.error).toContain("pending review");
  });

  it("Tenant isolation on co-sign", async () => {
    const { chart } = await createDraftChartWithEncounter(npProvider.id);
    await testProviderSign(chart.id, npProvider);

    const otherClinic = await prisma.clinic.create({
      data: { name: "Other Clinic", slug: `other-clinic-cosign-${Date.now()}` },
    });
    createdClinicIds.push(otherClinic.id);
    const otherMD: TestUser = {
      id: `other-md-${Date.now()}`,
      email: `other-md-${Date.now()}@test.com`,
      name: "Other MD",
      role: "MedicalDirector",
      clinicId: otherClinic.id,
    };

    const createdUser = await prisma.user.create({
      data: {
        id: otherMD.id,
        clinicId: otherClinic.id,
        email: otherMD.email,
        name: otherMD.name,
        role: "MedicalDirector",
      },
    });
    createdUserIds.push(createdUser.id);

    const result = await testCoSign(chart.id, otherMD);
    expect(result.success).toBe(false);
    expect(result.error).toContain("different clinic");
  });
});
