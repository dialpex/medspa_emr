import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, type Role } from "@prisma/client";
import { hasPermission } from "@/lib/rbac-core";

const prisma = new PrismaClient();

interface TestUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  clinicId: string;
}

// Map service category -> TreatmentCardType (mirrors deriveTreatmentCardType in today.ts)
function deriveTreatmentCardType(
  serviceCategory: string | null | undefined
): "Injectable" | "Laser" | "Esthetics" | "Other" {
  if (!serviceCategory) return "Other";
  const lower = serviceCategory.toLowerCase();
  if (
    lower.includes("injectable") ||
    lower.includes("filler") ||
    lower.includes("neurotoxin")
  )
    return "Injectable";
  if (lower.includes("laser") || lower.includes("energy")) return "Laser";
  if (
    lower.includes("esthetic") ||
    lower.includes("skin treatment") ||
    lower.includes("peel") ||
    lower.includes("microneedling")
  )
    return "Esthetics";
  return "Other";
}

// Inline test version of beginService to avoid Next.js session dependencies
async function testBeginService(
  appointmentId: string,
  user: TestUser
): Promise<{ success: boolean; data?: { chartId: string; encounterId: string }; error?: string }> {
  // RBAC check
  if (!hasPermission(user.role, "appointments", "edit")) {
    return {
      success: false,
      error: `Permission denied: ${user.role} cannot edit appointments`,
    };
  }
  if (!["FrontDesk", "Provider", "Admin", "Owner"].includes(user.role)) {
    return { success: false, error: "Permission denied" };
  }

  const apt = await prisma.appointment.findFirst({
    where: { id: appointmentId, clinicId: user.clinicId, deletedAt: null },
    include: {
      service: { select: { category: true } },
      chart: {
        select: { id: true, treatmentCards: { select: { id: true } } },
      },
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
    await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: "InProgress", startedAt: new Date() },
    });

    // Create Encounter
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

    // Create Chart with encounterId + dual-write legacy fields
    let chart = apt.chart ?? encounter.chart;
    if (!chart) {
      const newChart = await tx.chart.create({
        data: {
          clinicId: user.clinicId,
          encounterId: encounter.id,
          patientId: apt.patientId,
          appointmentId: appointmentId,
          createdById: user.id,
          status: "Draft",
        },
        include: { treatmentCards: { select: { id: true } } },
      });
      chart = newChart;
    }

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

  return { success: true, data: result };
}

describe("Begin Service", () => {
  let clinic: { id: string };
  let providerUser: TestUser;
  let frontDeskUser: TestUser;
  let billingUser: TestUser;
  let otherClinicUser: TestUser;
  let patientId: string;
  let injectableServiceId: string;
  let consultationServiceId: string;

  // Track all clinic IDs for cascade cleanup
  const createdClinicIds: string[] = [];

  afterAll(async () => {
    // Delete all data created by these test clinics in FK-safe order
    for (const cId of createdClinicIds) {
      await prisma.auditLog.deleteMany({ where: { clinicId: cId } });
      await prisma.photo.deleteMany({ where: { clinicId: cId } });
      await prisma.addendum.deleteMany({ where: { clinicId: cId } });
      await prisma.treatmentCard.deleteMany({ where: { chart: { clinicId: cId } } });
      await prisma.chart.deleteMany({ where: { clinicId: cId } });
      await prisma.encounter.deleteMany({ where: { clinicId: cId } });
      await prisma.appointment.deleteMany({ where: { clinicId: cId } });
      await prisma.service.deleteMany({ where: { clinicId: cId } });
      await prisma.patient.deleteMany({ where: { clinicId: cId } });
      await prisma.user.deleteMany({ where: { clinicId: cId } });
      await prisma.clinic.delete({ where: { id: cId } }).catch(() => {});
    }
  });

  beforeAll(async () => {
    // Create test clinic
    clinic = await prisma.clinic.create({
      data: {
        name: "Test Clinic - Begin Service",
        slug: `test-begin-service-${Date.now()}`,
      },
    });
    createdClinicIds.push(clinic.id);

    // Create users
    const provider = await prisma.user.create({
      data: {
        clinicId: clinic.id,
        email: `provider-bs-${Date.now()}@test.com`,
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

    const fd = await prisma.user.create({
      data: {
        clinicId: clinic.id,
        email: `frontdesk-bs-${Date.now()}@test.com`,
        name: "Test FrontDesk",
        role: "FrontDesk",
      },
    });
    frontDeskUser = {
      id: fd.id,
      email: fd.email,
      name: fd.name,
      role: fd.role,
      clinicId: fd.clinicId,
    };

    const billing = await prisma.user.create({
      data: {
        clinicId: clinic.id,
        email: `billing-bs-${Date.now()}@test.com`,
        name: "Test Billing",
        role: "Billing",
      },
    });
    billingUser = {
      id: billing.id,
      email: billing.email,
      name: billing.name,
      role: billing.role,
      clinicId: billing.clinicId,
    };

    // Other clinic for tenant isolation test
    const otherClinic = await prisma.clinic.create({
      data: {
        name: "Other Clinic",
        slug: `other-clinic-bs-${Date.now()}`,
      },
    });
    createdClinicIds.push(otherClinic.id);
    const otherUser = await prisma.user.create({
      data: {
        clinicId: otherClinic.id,
        email: `other-provider-bs-${Date.now()}@test.com`,
        name: "Other Provider",
        role: "Provider",
      },
    });
    otherClinicUser = {
      id: otherUser.id,
      email: otherUser.email,
      name: otherUser.name,
      role: otherUser.role,
      clinicId: otherUser.clinicId,
    };

    // Create patient
    const patient = await prisma.patient.create({
      data: {
        clinicId: clinic.id,
        firstName: "Test",
        lastName: "Patient",
      },
    });
    patientId = patient.id;

    // Create services
    const injectableSvc = await prisma.service.create({
      data: {
        clinicId: clinic.id,
        name: "Test Botox",
        duration: 30,
        price: 350,
        category: "Injectables",
      },
    });
    injectableServiceId = injectableSvc.id;

    const consultSvc = await prisma.service.create({
      data: {
        clinicId: clinic.id,
        name: "Test Consultation",
        duration: 30,
        price: 100,
        category: "Consultation",
      },
    });
    consultationServiceId = consultSvc.id;
  });

  it("should create encounter, chart and treatment card on begin service", async () => {
    const apt = await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId,
        providerId: providerUser.id,
        serviceId: injectableServiceId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60000),
        status: "CheckedIn",
        checkedInAt: new Date(),
      },
    });

    const result = await testBeginService(apt.id, providerUser);
    expect(result.success).toBe(true);
    expect(result.data?.chartId).toBeDefined();
    expect(result.data?.encounterId).toBeDefined();

    // Verify encounter exists
    const encounter = await prisma.encounter.findUnique({
      where: { id: result.data!.encounterId },
    });
    expect(encounter).not.toBeNull();
    expect(encounter!.status).toBe("Draft");
    expect(encounter!.appointmentId).toBe(apt.id);
    expect(encounter!.patientId).toBe(patientId);
    expect(encounter!.providerId).toBe(providerUser.id);

    // Verify chart exists with encounterId
    const chart = await prisma.chart.findUnique({
      where: { id: result.data!.chartId },
      include: { treatmentCards: true },
    });
    expect(chart).not.toBeNull();
    expect(chart!.status).toBe("Draft");
    expect(chart!.encounterId).toBe(encounter!.id);
    expect(chart!.treatmentCards).toHaveLength(1);
    expect(chart!.treatmentCards[0].templateType).toBe("Injectable");

    // Verify appointment transitioned
    const updated = await prisma.appointment.findUnique({
      where: { id: apt.id },
    });
    expect(updated!.status).toBe("InProgress");
    expect(updated!.startedAt).not.toBeNull();
  });

  it("should be idempotent — second call returns same encounter and chart", async () => {
    const apt = await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId,
        providerId: providerUser.id,
        serviceId: injectableServiceId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60000),
        status: "CheckedIn",
        checkedInAt: new Date(),
      },
    });

    const result1 = await testBeginService(apt.id, providerUser);
    expect(result1.success).toBe(true);

    const result2 = await testBeginService(apt.id, providerUser);
    expect(result2.success).toBe(true);
    expect(result2.data?.chartId).toBe(result1.data?.chartId);
    expect(result2.data?.encounterId).toBe(result1.data?.encounterId);

    // Verify only one encounter, one chart, one treatment card
    const encounters = await prisma.encounter.findMany({
      where: { appointmentId: apt.id },
    });
    expect(encounters).toHaveLength(1);

    const charts = await prisma.chart.findMany({
      where: { appointmentId: apt.id },
      include: { treatmentCards: true },
    });
    expect(charts).toHaveLength(1);
    expect(charts[0].treatmentCards).toHaveLength(1);
  });

  it("should allow FrontDesk to begin service but deny Billing", async () => {
    const apt = await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId,
        providerId: providerUser.id,
        serviceId: injectableServiceId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60000),
        status: "CheckedIn",
        checkedInAt: new Date(),
      },
    });

    // FrontDesk can begin service
    const fdResult = await testBeginService(apt.id, frontDeskUser);
    expect(fdResult.success).toBe(true);

    // Billing cannot
    const apt2 = await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId,
        providerId: providerUser.id,
        serviceId: injectableServiceId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60000),
        status: "CheckedIn",
        checkedInAt: new Date(),
      },
    });
    const billingResult = await testBeginService(apt2.id, billingUser);
    expect(billingResult.success).toBe(false);
    expect(billingResult.error).toContain("Permission denied");
  });

  it("should enforce tenant isolation", async () => {
    const apt = await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId,
        providerId: providerUser.id,
        serviceId: injectableServiceId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60000),
        status: "CheckedIn",
        checkedInAt: new Date(),
      },
    });

    // User from other clinic cannot access this appointment
    const result = await testBeginService(apt.id, otherClinicUser);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Appointment not found");
  });

  it("should reject if appointment is not CheckedIn", async () => {
    const apt = await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId,
        providerId: providerUser.id,
        serviceId: injectableServiceId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60000),
        status: "Scheduled",
      },
    });

    const result = await testBeginService(apt.id, providerUser);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Patient must be checked in first");
  });

  it("should derive template type from service category", async () => {
    // Injectable service → Injectable card type
    const apt1 = await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId,
        providerId: providerUser.id,
        serviceId: injectableServiceId, // category: "Injectables"
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60000),
        status: "CheckedIn",
        checkedInAt: new Date(),
      },
    });

    const result1 = await testBeginService(apt1.id, providerUser);
    expect(result1.success).toBe(true);
    const chart1 = await prisma.chart.findUnique({
      where: { id: result1.data!.chartId },
      include: { treatmentCards: true },
    });
    expect(chart1!.treatmentCards[0].templateType).toBe("Injectable");

    // Consultation service → Other card type
    const apt2 = await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId,
        providerId: providerUser.id,
        serviceId: consultationServiceId, // category: "Consultation"
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60000),
        status: "CheckedIn",
        checkedInAt: new Date(),
      },
    });

    const result2 = await testBeginService(apt2.id, providerUser);
    expect(result2.success).toBe(true);
    const chart2 = await prisma.chart.findUnique({
      where: { id: result2.data!.chartId },
      include: { treatmentCards: true },
    });
    expect(chart2!.treatmentCards[0].templateType).toBe("Other");
  });
});
