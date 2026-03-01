import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { validateTreatmentCard, getCardStatus } from "../lib/templates/validation";
import { PrismaClient } from "@prisma/client";

// ==========================================================================
// Pure validation tests (no DB)
// ==========================================================================

describe("validateTreatmentCard — Injectable", () => {
  it("blocks when lot missing (productName set, areas with units, empty lotEntries)", () => {
    const data = JSON.stringify({
      productName: "Botox",
      areas: [{ areaLabel: "Forehead", units: 20 }],
      totalUnits: 20,
      lotEntries: [],
      outcome: "",
      followUpPlan: "",
      aftercare: "",
    });
    const result = validateTreatmentCard("Injectable", data);
    expect(result.isSignBlocking).toBe(true);
    expect(result.missingHighRiskFields).toContain("lotEntries");
  });

  it("blocks when totalUnits is zero", () => {
    const data = JSON.stringify({
      productName: "Botox",
      areas: [{ areaLabel: "Forehead", units: 20 }],
      totalUnits: 0,
      lotEntries: [{ lotNumber: "C1234", expirationDate: "2027-06" }],
      outcome: "",
      followUpPlan: "",
      aftercare: "",
    });
    const result = validateTreatmentCard("Injectable", data);
    expect(result.isSignBlocking).toBe(true);
    expect(result.missingHighRiskFields).toContain("totalUnits");
  });

  it("passes when complete (lot entries + totalUnits match)", () => {
    const data = JSON.stringify({
      productName: "Botox",
      areas: [{ areaLabel: "Forehead", units: 20 }, { areaLabel: "Glabella", units: 20 }],
      totalUnits: 40,
      lotEntries: [{ lotNumber: "C1234", expirationDate: "2027-06" }],
      outcome: "Good",
      followUpPlan: "2 weeks",
      aftercare: "Ice",
    });
    const result = validateTreatmentCard("Injectable", data);
    expect(result.isSignBlocking).toBe(false);
    expect(result.missingHighRiskFields).toHaveLength(0);
  });

  it("does NOT block when no substantive data (empty productName, no areas)", () => {
    const data = JSON.stringify({
      productName: "",
      areas: [],
      totalUnits: 0,
      lotEntries: [],
      outcome: "",
      followUpPlan: "",
      aftercare: "",
    });
    const result = validateTreatmentCard("Injectable", data);
    expect(result.isSignBlocking).toBe(false);
  });

  it("totalUnits mismatch warning (areas sum 40, totalUnits 30)", () => {
    const data = JSON.stringify({
      productName: "Botox",
      areas: [{ areaLabel: "Forehead", units: 20 }, { areaLabel: "Glabella", units: 20 }],
      totalUnits: 30,
      lotEntries: [{ lotNumber: "C1234", expirationDate: "2027-06" }],
      outcome: "",
      followUpPlan: "",
      aftercare: "",
    });
    const result = validateTreatmentCard("Injectable", data);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("does not match");
  });
});

describe("validateTreatmentCard — Laser", () => {
  it("blocks when deviceName missing", () => {
    const data = JSON.stringify({
      deviceName: "",
      areasTreated: ["Face"],
      parameters: { energy: "30 J/cm²", passes: 2 },
      outcome: "",
      aftercare: "",
    });
    const result = validateTreatmentCard("Laser", data);
    expect(result.isSignBlocking).toBe(true);
    expect(result.missingHighRiskFields).toContain("deviceName");
  });

  it("blocks when energy missing", () => {
    const data = JSON.stringify({
      deviceName: "GentleMax",
      areasTreated: ["Face"],
      parameters: { energy: "", passes: 2 },
      outcome: "",
      aftercare: "",
    });
    const result = validateTreatmentCard("Laser", data);
    expect(result.isSignBlocking).toBe(true);
    expect(result.missingHighRiskFields).toContain("parameters.energy");
  });

  it("blocks when passes missing/zero", () => {
    const data = JSON.stringify({
      deviceName: "GentleMax",
      areasTreated: [],
      parameters: { energy: "30 J/cm²", passes: 0 },
      outcome: "",
      aftercare: "",
    });
    const result = validateTreatmentCard("Laser", data);
    expect(result.isSignBlocking).toBe(true);
    expect(result.missingHighRiskFields).toContain("parameters.passes");
  });

  it("passes when all three present", () => {
    const data = JSON.stringify({
      deviceName: "GentleMax",
      areasTreated: ["Face"],
      parameters: { energy: "30 J/cm²", passes: 2 },
      outcome: "Good",
      aftercare: "Sunscreen",
    });
    const result = validateTreatmentCard("Laser", data);
    expect(result.isSignBlocking).toBe(false);
    expect(result.missingHighRiskFields).toHaveLength(0);
  });
});

describe("validateTreatmentCard — Esthetics", () => {
  it("never blocks", () => {
    const result = validateTreatmentCard("Esthetics", "{}");
    expect(result.isSignBlocking).toBe(false);
  });
});

describe("validateTreatmentCard — Other", () => {
  it("never blocks", () => {
    const result = validateTreatmentCard("Other", "{}");
    expect(result.isSignBlocking).toBe(false);
  });
});

describe("getCardStatus", () => {
  it("returns MissingHighRisk when blocking", () => {
    expect(getCardStatus({ missingHighRiskFields: ["lot"], missingNonCriticalFields: [], warnings: [], isSignBlocking: true }))
      .toBe("MissingHighRisk");
  });

  it("returns Missing when non-critical missing", () => {
    expect(getCardStatus({ missingHighRiskFields: [], missingNonCriticalFields: ["outcome"], warnings: [], isSignBlocking: false }))
      .toBe("Missing");
  });

  it("returns Complete when nothing missing", () => {
    expect(getCardStatus({ missingHighRiskFields: [], missingNonCriticalFields: [], warnings: [], isSignBlocking: false }))
      .toBe("Complete");
  });
});

// ==========================================================================
// Integration tests (DB, inline server logic)
// ==========================================================================

const prisma = new PrismaClient();

// Inline versions of server actions to avoid Next.js deps
async function providerSignChartInline(
  chartId: string,
  user: { id: string; clinicId: string; role: string; name: string }
) {
  const { hasPermission } = await import("../lib/rbac-core");
  if (!hasPermission(user.role as "Provider", "charts", "edit")) {
    return { success: false, error: `Permission denied` };
  }

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    include: {
      encounter: { select: { id: true, status: true } },
      treatmentCards: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!chart) return { success: false, error: "Chart not found" };
  if (chart.clinicId !== user.clinicId) return { success: false, error: "Tenant violation" };

  const isDraft = chart.encounter
    ? chart.encounter.status === "Draft"
    : chart.status === "Draft";
  if (!isDraft) return { success: false, error: "Only draft charts can be signed" };

  const blockingErrors: Array<{ cardId: string; cardTitle: string; missingFields: string[] }> = [];
  for (const card of chart.treatmentCards) {
    const result = validateTreatmentCard(card.templateType, card.structuredData);
    if (result.isSignBlocking) {
      blockingErrors.push({ cardId: card.id, cardTitle: card.title, missingFields: result.missingHighRiskFields });
    }
  }

  if (blockingErrors.length > 0) {
    return { success: false, error: "Blocking", data: { blockingErrors } };
  }

  const signedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.chart.update({
      where: { id: chartId },
      data: {
        status: "MDSigned",
        signedById: user.id,
        signedByName: user.name,
        signedAt,
        recordHash: "sha256:test",
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
      },
    });
  });

  return { success: true };
}

async function updateTreatmentCardInline(
  cardId: string,
  data: { narrativeText?: string; structuredData?: string },
  user: { id: string; clinicId: string; role: string }
) {
  const { hasPermission } = await import("../lib/rbac-core");
  if (!hasPermission(user.role as "Provider", "charts", "edit")) {
    return { success: false, error: "Permission denied" };
  }

  const card = await prisma.treatmentCard.findUnique({
    where: { id: cardId },
    include: {
      chart: { select: { clinicId: true, status: true, encounter: { select: { status: true } } } },
    },
  });

  if (!card) return { success: false, error: "Not found" };
  if (card.chart.clinicId !== user.clinicId) return { success: false, error: "Tenant violation" };

  const isDraft = card.chart.encounter
    ? card.chart.encounter.status === "Draft"
    : card.chart.status === "Draft";
  if (!isDraft) return { success: false, error: "Cannot edit treatment cards on a non-draft chart" };

  const updateData: Record<string, string> = {};
  if (data.narrativeText !== undefined) updateData.narrativeText = data.narrativeText;
  if (data.structuredData !== undefined) updateData.structuredData = data.structuredData;

  await prisma.treatmentCard.update({ where: { id: cardId }, data: updateData });
  return { success: true };
}

async function updateChartInline(
  chartId: string,
  data: Record<string, string>,
  user: { id: string; clinicId: string; role: string }
) {
  const { hasPermission } = await import("../lib/rbac-core");
  if (!hasPermission(user.role as "Provider", "charts", "edit")) {
    return { success: false, error: "Permission denied" };
  }

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    include: { encounter: { select: { status: true } } },
  });

  if (!chart) return { success: false, error: "Not found" };
  if (chart.clinicId !== user.clinicId) return { success: false, error: "Tenant violation" };

  const effectiveStatus = chart.encounter?.status === "Finalized" ? "MDSigned" : chart.status;
  if (effectiveStatus === "MDSigned") {
    return { success: false, error: "Cannot edit a signed chart" };
  }

  await prisma.chart.update({ where: { id: chartId }, data: { ...data, updatedAt: new Date() } });
  return { success: true };
}

describe("Integration: Provider Sign", () => {
  let clinicId: string;
  let providerId: string;
  let chartId: string;
  let cardId: string;
  let provider: { id: string; clinicId: string; role: string; name: string };

  // Track created entities for cleanup
  const createdChartIds: string[] = [];

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: createdChartIds } } });
    await prisma.treatmentCard.deleteMany({ where: { chartId: { in: createdChartIds } } });
    await prisma.chart.deleteMany({ where: { id: { in: createdChartIds } } });
  });

  beforeAll(async () => {
    // Use the seeded data — find the Draft chart with treatment cards
    const clinic = await prisma.clinic.findFirst();
    if (!clinic) throw new Error("No clinic found — run seed first");
    clinicId = clinic.id;

    const providerUser = await prisma.user.findFirst({ where: { clinicId, role: "Provider" } });
    if (!providerUser) throw new Error("No provider found");
    providerId = providerUser.id;
    provider = { id: providerId, clinicId, role: "Provider", name: providerUser.name };

    // Create a fresh chart for testing
    const patient = await prisma.patient.findFirst({ where: { clinicId } });
    if (!patient) throw new Error("No patient found");

    const chart = await prisma.chart.create({
      data: {
        clinicId,
        patientId: patient.id,
        createdById: providerId,
        status: "Draft",
        chiefComplaint: "Test chart for provider sign",
      },
    });
    chartId = chart.id;
    createdChartIds.push(chart.id);

    const card = await prisma.treatmentCard.create({
      data: {
        chartId,
        templateType: "Injectable",
        title: "Injectable",
        narrativeText: "Test narrative",
        structuredData: JSON.stringify({
          productName: "Botox",
          areas: [{ areaLabel: "Forehead", units: 20 }],
          totalUnits: 20,
          lotEntries: [{ lotNumber: "C1234", expirationDate: "2027-06" }],
          outcome: "",
          followUpPlan: "",
          aftercare: "",
        }),
        sortOrder: 0,
      },
    });
    cardId = card.id;
  });

  it("provider can sign draft chart with complete Injectable data", async () => {
    const result = await providerSignChartInline(chartId, provider);
    expect(result.success).toBe(true);

    const chart = await prisma.chart.findUnique({ where: { id: chartId } });
    expect(chart?.status).toBe("MDSigned");
    expect(chart?.signedByName).toBe(provider.name);
  });

  it("provider sign blocked by missing lot entries", async () => {
    // Create another chart with incomplete data
    const patient = await prisma.patient.findFirst({ where: { clinicId } });
    const chart2 = await prisma.chart.create({
      data: {
        clinicId,
        patientId: patient!.id,
        createdById: providerId,
        status: "Draft",
        chiefComplaint: "Incomplete chart",
      },
    });
    createdChartIds.push(chart2.id);

    await prisma.treatmentCard.create({
      data: {
        chartId: chart2.id,
        templateType: "Injectable",
        title: "Injectable",
        narrativeText: "",
        structuredData: JSON.stringify({
          productName: "Botox",
          areas: [{ areaLabel: "Forehead", units: 20 }],
          totalUnits: 20,
          lotEntries: [], // Missing!
          outcome: "",
          followUpPlan: "",
          aftercare: "",
        }),
        sortOrder: 0,
      },
    });

    const result = await providerSignChartInline(chart2.id, provider);
    expect(result.success).toBe(false);
    const data = result.data as { blockingErrors?: Array<{ cardTitle: string; missingFields: string[] }> };
    expect(data?.blockingErrors).toBeDefined();
    expect(data?.blockingErrors?.[0]?.missingFields).toContain("lotEntries");
  });

  it("lock prevents updateTreatmentCard after signing", async () => {
    // chartId was signed in the first test
    const result = await updateTreatmentCardInline(
      cardId,
      { narrativeText: "Should fail" },
      provider
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("non-draft");
  });

  it("lock prevents updateChart after signing", async () => {
    const result = await updateChartInline(
      chartId,
      { chiefComplaint: "Should fail" },
      provider
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("signed chart");
  });
});
