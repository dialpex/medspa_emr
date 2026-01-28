import { describe, it, expect, beforeAll } from "vitest";
import { PrismaClient, type Role } from "@prisma/client";
import { createHash } from "crypto";

// Import only the pure hasPermission function from rbac-core (no Next.js deps)
import { hasPermission } from "@/lib/rbac-core";

const prisma = new PrismaClient();

// Define the user type locally to avoid importing from rbac which might have Next.js deps
interface TestUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  clinicId: string;
}

// Helper to generate record hash
function generateRecordHash(chart: {
  id: string;
  chiefComplaint: string | null;
  areasTreeated: string | null;
  productsUsed: string | null;
  dosageUnits: string | null;
  technique: string | null;
  aftercareNotes: string | null;
  additionalNotes: string | null;
}): string {
  const content = JSON.stringify({
    id: chart.id,
    chiefComplaint: chart.chiefComplaint,
    areasTreeated: chart.areasTreeated,
    productsUsed: chart.productsUsed,
    dosageUnits: chart.dosageUnits,
    technique: chart.technique,
    aftercareNotes: chart.aftercareNotes,
    additionalNotes: chart.additionalNotes,
  });
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

// Inline test version of updateChart to avoid Next.js dependencies
async function testUpdateChart(
  chartId: string,
  data: { chiefComplaint?: string },
  user: TestUser
): Promise<{ success: boolean; error?: string }> {
  if (!hasPermission(user.role, "charts", "edit")) {
    return {
      success: false,
      error: `Permission denied: ${user.role} cannot edit charts`,
    };
  }

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
  });

  if (!chart) {
    return { success: false, error: "Chart not found" };
  }

  if (user.clinicId !== chart.clinicId) {
    return { success: false, error: "Access denied: resource belongs to different clinic" };
  }

  if (chart.status === "MDSigned") {
    return { success: false, error: "Cannot edit a signed chart" };
  }

  await prisma.chart.update({
    where: { id: chartId },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });

  return { success: true };
}

// Inline test version of signChart to avoid Next.js dependencies
async function testSignChart(
  chartId: string,
  user: TestUser
): Promise<{ success: boolean; error?: string }> {
  if (!hasPermission(user.role, "charts", "sign")) {
    return {
      success: false,
      error: `Permission denied: ${user.role} cannot sign charts`,
    };
  }

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
  });

  if (!chart) {
    return { success: false, error: "Chart not found" };
  }

  if (user.clinicId !== chart.clinicId) {
    return { success: false, error: "Access denied: resource belongs to different clinic" };
  }

  if (chart.status !== "NeedsSignOff") {
    return {
      success: false,
      error: "Only charts with NeedsSignOff status can be signed",
    };
  }

  const recordHash = generateRecordHash(chart);
  const signedAt = new Date();

  await prisma.chart.update({
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

  await prisma.auditLog.create({
    data: {
      clinicId: user.clinicId,
      userId: user.id,
      action: "ChartSign",
      entityType: "Chart",
      entityId: chartId,
      details: JSON.stringify({
        patientId: chart.patientId,
        previousStatus: "NeedsSignOff",
        newStatus: "MDSigned",
        recordHash,
      }),
    },
  });

  return { success: true };
}

describe("MedicalDirector Permissions", () => {
  let medicalDirector: TestUser;
  let provider: TestUser;
  let draftChartId: string;
  let clinicId: string;

  beforeAll(async () => {
    // Get the seeded Medical Director user
    const mdUser = await prisma.user.findFirst({
      where: { role: "MedicalDirector" },
    });

    if (!mdUser) {
      throw new Error("Medical Director user not found in seeded data");
    }

    medicalDirector = {
      id: mdUser.id,
      email: mdUser.email,
      name: mdUser.name,
      role: mdUser.role,
      clinicId: mdUser.clinicId,
    };

    clinicId = mdUser.clinicId;

    // Get a provider user for comparison
    const providerUser = await prisma.user.findFirst({
      where: { role: "Provider" },
    });

    if (!providerUser) {
      throw new Error("Provider user not found in seeded data");
    }

    provider = {
      id: providerUser.id,
      email: providerUser.email,
      name: providerUser.name,
      role: providerUser.role,
      clinicId: providerUser.clinicId,
    };

    // Find or create a draft chart for testing
    let draftChart = await prisma.chart.findFirst({
      where: { status: "Draft", clinicId },
    });

    if (!draftChart) {
      // Create a draft chart for testing
      const patient = await prisma.patient.findFirst({
        where: { clinicId },
      });

      if (!patient) {
        throw new Error("No patient found in seeded data");
      }

      draftChart = await prisma.chart.create({
        data: {
          clinicId,
          patientId: patient.id,
          createdById: providerUser.id,
          status: "Draft",
          chiefComplaint: "Test draft chart",
        },
      });
    }

    draftChartId = draftChart.id;
  });

  describe("RBAC Permission Checks", () => {
    it("MedicalDirector should have view permission for charts", () => {
      expect(hasPermission("MedicalDirector", "charts", "view")).toBe(true);
    });

    it("MedicalDirector should NOT have edit permission for charts", () => {
      expect(hasPermission("MedicalDirector", "charts", "edit")).toBe(false);
    });

    it("MedicalDirector should have sign permission for charts", () => {
      expect(hasPermission("MedicalDirector", "charts", "sign")).toBe(true);
    });

    it("Provider should have edit permission for charts", () => {
      expect(hasPermission("Provider", "charts", "edit")).toBe(true);
    });

    it("Provider should NOT have sign permission for charts", () => {
      expect(hasPermission("Provider", "charts", "sign")).toBe(false);
    });
  });

  describe("Chart Edit Operations", () => {
    it("MedicalDirector cannot edit chart content", async () => {
      const result = await testUpdateChart(
        draftChartId,
        { chiefComplaint: "Updated by MD - should fail" },
        medicalDirector
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
      expect(result.error).toContain("MedicalDirector");
      expect(result.error).toContain("cannot edit");
    });

    it("Provider can edit chart content", async () => {
      const result = await testUpdateChart(
        draftChartId,
        { chiefComplaint: "Updated by Provider - should succeed" },
        provider
      );

      expect(result.success).toBe(true);

      // Verify the update was applied
      const updatedChart = await prisma.chart.findUnique({
        where: { id: draftChartId },
      });

      expect(updatedChart?.chiefComplaint).toBe(
        "Updated by Provider - should succeed"
      );
    });
  });

  describe("Chart Sign Operations", () => {
    it("MedicalDirector can sign a NeedsSignOff chart", async () => {
      // Create a new chart in NeedsSignOff status for this test
      const patient = await prisma.patient.findFirst({
        where: { clinicId },
      });

      if (!patient) {
        throw new Error("No patient found");
      }

      const newChart = await prisma.chart.create({
        data: {
          clinicId,
          patientId: patient.id,
          createdById: provider.id,
          status: "NeedsSignOff",
          chiefComplaint: "Test chart for signing",
        },
      });

      const result = await testSignChart(newChart.id, medicalDirector);
      expect(result.success).toBe(true);

      // Verify the chart was signed
      const signedChart = await prisma.chart.findUnique({
        where: { id: newChart.id },
      });

      expect(signedChart?.status).toBe("MDSigned");
      expect(signedChart?.signedById).toBe(medicalDirector.id);
      expect(signedChart?.signedByName).toBe(medicalDirector.name);
      expect(signedChart?.signedAt).toBeTruthy();
      expect(signedChart?.recordHash).toMatch(/^sha256:/);

      // Verify audit log was created
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: "ChartSign",
          entityId: newChart.id,
          userId: medicalDirector.id,
        },
      });

      expect(auditLog).toBeTruthy();
      expect(auditLog?.entityType).toBe("Chart");
    });

    it("Provider cannot sign charts", async () => {
      // Create a new chart in NeedsSignOff status
      const patient = await prisma.patient.findFirst({
        where: { clinicId },
      });

      if (!patient) {
        throw new Error("No patient found");
      }

      const chart = await prisma.chart.create({
        data: {
          clinicId,
          patientId: patient.id,
          createdById: provider.id,
          status: "NeedsSignOff",
          chiefComplaint: "Test chart - provider should not be able to sign",
        },
      });

      const result = await testSignChart(chart.id, provider);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
      expect(result.error).toContain("Provider");
      expect(result.error).toContain("cannot sign");

      // Verify chart status was not changed
      const unchangedChart = await prisma.chart.findUnique({
        where: { id: chart.id },
      });

      expect(unchangedChart?.status).toBe("NeedsSignOff");
      expect(unchangedChart?.signedById).toBeNull();
    });

    it("MedicalDirector cannot sign a Draft chart", async () => {
      const result = await testSignChart(draftChartId, medicalDirector);

      expect(result.success).toBe(false);
      expect(result.error).toContain("NeedsSignOff");
    });
  });
});
