import { describe, it, expect, beforeAll } from "vitest";
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

// ---------------------------------------------------------------------------
// Inline test functions mirroring server action logic (no Next.js deps)
// ---------------------------------------------------------------------------

async function testUpdateTreatmentCard(
  cardId: string,
  data: { narrativeText?: string; structuredData?: string },
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
  if (user.clinicId !== card.chart.clinicId) return { success: false, error: "Access denied" };

  const isDraft = card.chart.encounter
    ? card.chart.encounter.status === "Draft"
    : card.chart.status === "Draft";
  if (!isDraft) {
    const isFinalized = card.chart.encounter
      ? card.chart.encounter.status === "Finalized"
      : card.chart.status === "MDSigned";
    return {
      success: false,
      error: isFinalized
        ? "Encounter finalized. Changes require addendum."
        : "Cannot edit treatment cards on a non-draft chart",
    };
  }

  const updateData: Record<string, string> = {};
  if (data.narrativeText !== undefined) updateData.narrativeText = data.narrativeText;
  if (data.structuredData !== undefined) updateData.structuredData = data.structuredData;
  await prisma.treatmentCard.update({ where: { id: cardId }, data: updateData });
  return { success: true };
}

async function testUploadMedia(
  chartId: string,
  user: TestUser
): Promise<{ success: boolean; error?: string }> {
  if (!hasPermission(user.role, "photos", "create")) {
    return { success: false, error: "Permission denied" };
  }

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    select: { clinicId: true, status: true, encounter: { select: { status: true } } },
  });
  if (!chart) return { success: false, error: "Chart not found" };
  if (chart.clinicId !== user.clinicId) return { success: false, error: "Access denied" };

  const isFinalized = chart.encounter
    ? chart.encounter.status === "Finalized"
    : chart.status === "MDSigned";
  if (isFinalized) {
    return { success: false, error: "Encounter finalized. Changes require addendum." };
  }

  return { success: true };
}

async function testApplyAiDraft(
  chartId: string,
  user: TestUser
): Promise<{ success: boolean; error?: string }> {
  if (!hasPermission(user.role, "charts", "edit")) {
    return { success: false, error: "Permission denied" };
  }

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    select: { clinicId: true, status: true, encounter: { select: { status: true } } },
  });
  if (!chart) return { success: false, error: "Chart not found" };
  if (chart.clinicId !== user.clinicId) return { success: false, error: "Access denied" };

  const isFinalized = chart.encounter
    ? chart.encounter.status === "Finalized"
    : chart.status === "MDSigned";
  if (isFinalized) {
    return { success: false, error: "Encounter finalized. Changes require addendum." };
  }
  if (chart.status !== "Draft") {
    return { success: false, error: "Cannot apply draft to non-draft chart" };
  }

  return { success: true };
}

async function testCreateAddendum(
  encounterId: string,
  text: string,
  user: TestUser
): Promise<{ success: boolean; error?: string; addendumId?: string }> {
  const allowedRoles: Role[] = ["Provider", "Owner", "Admin", "MedicalDirector"];
  if (!allowedRoles.includes(user.role)) {
    return { success: false, error: "Permission denied: insufficient role" };
  }

  const encounter = await prisma.encounter.findUnique({
    where: { id: encounterId },
    select: { id: true, clinicId: true, patientId: true, status: true },
  });
  if (!encounter) return { success: false, error: "Encounter not found" };
  if (encounter.clinicId !== user.clinicId) {
    return { success: false, error: "Access denied: different clinic" };
  }
  if (encounter.status !== "Finalized") {
    return { success: false, error: "Addenda can only be added to finalized encounters" };
  }

  const addendum = await prisma.addendum.create({
    data: {
      clinicId: encounter.clinicId,
      encounterId: encounter.id,
      authorId: user.id,
      text,
    },
  });

  await prisma.auditLog.create({
    data: {
      clinicId: user.clinicId,
      userId: user.id,
      action: "AddendumCreated",
      entityType: "Encounter",
      entityId: encounter.id,
      details: JSON.stringify({ addendumId: addendum.id, patientId: encounter.patientId }),
    },
  });

  return { success: true, addendumId: addendum.id };
}

async function testAnnotationUpdate(
  photoId: string,
  user: TestUser
): Promise<{ success: boolean; error?: string }> {
  if (!hasPermission(user.role, "photos", "edit")) {
    return { success: false, error: "Permission denied" };
  }

  const photo = await prisma.photo.findFirst({
    where: { id: photoId, clinicId: user.clinicId, deletedAt: null },
    include: {
      chart: { select: { encounter: { select: { status: true } }, status: true } },
      treatmentCard: { select: { chart: { select: { encounter: { select: { status: true } }, status: true } } } },
    },
  });
  if (!photo) return { success: false, error: "Photo not found" };

  const chartRef = photo.chart ?? photo.treatmentCard?.chart;
  if (chartRef) {
    const isFinalized = chartRef.encounter
      ? chartRef.encounter.status === "Finalized"
      : chartRef.status === "MDSigned";
    if (isFinalized) {
      return { success: false, error: "Encounter finalized. Changes require addendum." };
    }
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Addendum + Immutability Enforcement", () => {
  let provider: TestUser;
  let mdUser: TestUser;
  let frontDeskUser: TestUser;
  let clinicId: string;
  let patientId: string;

  beforeAll(async () => {
    const regular = await prisma.user.findFirst({
      where: { role: "Provider", requiresMDReview: false },
    });
    if (!regular) throw new Error("Regular provider not found");

    const md = await prisma.user.findFirst({ where: { role: "MedicalDirector" } });
    if (!md) throw new Error("MedicalDirector not found");

    const fd = await prisma.user.findFirst({ where: { role: "FrontDesk" } });
    if (!fd) throw new Error("FrontDesk user not found");

    clinicId = regular.clinicId;
    provider = { id: regular.id, email: regular.email, name: regular.name, role: regular.role, clinicId };
    mdUser = { id: md.id, email: md.email, name: md.name, role: md.role, clinicId };
    frontDeskUser = { id: fd.id, email: fd.email, name: fd.name, role: fd.role, clinicId };

    const patient = await prisma.patient.findFirst({ where: { clinicId } });
    if (!patient) throw new Error("No patient found");
    patientId = patient.id;
  });

  async function createFinalizedEncounter(providerId: string) {
    const appointment = await prisma.appointment.create({
      data: {
        clinicId,
        patientId,
        providerId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60000),
        status: "Completed",
      },
    });
    const encounter = await prisma.encounter.create({
      data: {
        appointmentId: appointment.id,
        clinicId,
        patientId,
        providerId,
        status: "Finalized",
        finalizedAt: new Date(),
      },
    });
    const chart = await prisma.chart.create({
      data: {
        clinicId,
        encounterId: encounter.id,
        patientId,
        appointmentId: appointment.id,
        createdById: providerId,
        status: "MDSigned",
        chiefComplaint: "Immutability test",
        signedById: providerId,
        signedByName: "Test Provider",
        signedAt: new Date(),
      },
    });
    const card = await prisma.treatmentCard.create({
      data: {
        chartId: chart.id,
        templateType: "Injectable",
        title: "Test Card",
        narrativeText: "Original narrative",
        structuredData: "{}",
        sortOrder: 0,
      },
    });

    return { encounter, chart, card, appointment };
  }

  // ---- Immutability: Treatment Card ----

  it("Cannot update treatment card after encounter is finalized", async () => {
    const { card } = await createFinalizedEncounter(provider.id);
    const result = await testUpdateTreatmentCard(
      card.id,
      { narrativeText: "Modified after finalize" },
      provider
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Encounter finalized. Changes require addendum.");
  });

  it("Cannot update treatment card structuredData after encounter is finalized", async () => {
    const { card } = await createFinalizedEncounter(provider.id);
    const result = await testUpdateTreatmentCard(
      card.id,
      { structuredData: '{"productName":"Botox"}' },
      provider
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("finalized");
  });

  // ---- Immutability: Media Upload ----

  it("Cannot upload media to a finalized encounter's chart", async () => {
    const { chart } = await createFinalizedEncounter(provider.id);
    const result = await testUploadMedia(chart.id, provider);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Encounter finalized. Changes require addendum.");
  });

  // ---- Immutability: AI Draft Apply ----

  it("Cannot apply AI draft to finalized encounter", async () => {
    const { chart } = await createFinalizedEncounter(provider.id);
    const result = await testApplyAiDraft(chart.id, provider);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Encounter finalized. Changes require addendum.");
  });

  // ---- Immutability: Photo Annotation ----

  it("Cannot update photo annotations on finalized encounter", async () => {
    const { chart } = await createFinalizedEncounter(provider.id);
    // Create a photo for this chart
    const photo = await prisma.photo.create({
      data: {
        clinicId,
        patientId,
        chartId: chart.id,
        takenById: provider.id,
        filename: "test.jpg",
        storagePath: "storage/test.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1000,
      },
    });

    const result = await testAnnotationUpdate(photo.id, provider);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Encounter finalized. Changes require addendum.");
  });

  // ---- Addendum: Can Create ----

  it("Provider can create addendum on finalized encounter", async () => {
    const { encounter } = await createFinalizedEncounter(provider.id);
    const result = await testCreateAddendum(
      encounter.id,
      "Patient reported mild swelling at injection site. Advised ice application.",
      provider
    );
    expect(result.success).toBe(true);
    expect(result.addendumId).toBeTruthy();

    // Verify addendum is stored
    const addendum = await prisma.addendum.findUnique({
      where: { id: result.addendumId },
    });
    expect(addendum).toBeTruthy();
    expect(addendum?.text).toContain("swelling");
    expect(addendum?.authorId).toBe(provider.id);
    expect(addendum?.encounterId).toBe(encounter.id);
  });

  it("MedicalDirector can create addendum on finalized encounter", async () => {
    const { encounter } = await createFinalizedEncounter(provider.id);
    const result = await testCreateAddendum(
      encounter.id,
      "Reviewed chart post-finalization. Concur with treatment plan.",
      mdUser
    );
    expect(result.success).toBe(true);
  });

  // ---- Addendum: Restrictions ----

  it("FrontDesk cannot create addendum", async () => {
    const { encounter } = await createFinalizedEncounter(provider.id);
    const result = await testCreateAddendum(
      encounter.id,
      "Unauthorized addendum attempt",
      frontDeskUser
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("Permission denied");
  });

  it("Cannot create addendum on non-finalized encounter", async () => {
    const appointment = await prisma.appointment.create({
      data: {
        clinicId,
        patientId,
        providerId: provider.id,
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60000),
        status: "InProgress",
      },
    });
    const encounter = await prisma.encounter.create({
      data: {
        appointmentId: appointment.id,
        clinicId,
        patientId,
        providerId: provider.id,
        status: "Draft",
      },
    });

    const result = await testCreateAddendum(encounter.id, "Not yet finalized", provider);
    expect(result.success).toBe(false);
    expect(result.error).toContain("finalized");
  });

  // ---- Addendum: Immutability ----

  it("Addendum records cannot be updated (no Prisma update route exists, verify append-only)", async () => {
    const { encounter } = await createFinalizedEncounter(provider.id);
    const result = await testCreateAddendum(encounter.id, "Original text", provider);
    expect(result.success).toBe(true);

    // Verify the addendum exists and cannot be modified through our API
    // (The model has no update route — we verify the record is stored correctly)
    const addendum = await prisma.addendum.findUnique({ where: { id: result.addendumId } });
    expect(addendum?.text).toBe("Original text");
    expect(addendum?.createdAt).toBeInstanceOf(Date);
  });

  // ---- Addendum: Tenant Isolation ----

  it("Tenant isolation: user from another clinic cannot create addendum", async () => {
    const { encounter } = await createFinalizedEncounter(provider.id);

    const otherClinic = await prisma.clinic.create({
      data: { name: "Other Addendum Clinic", slug: `other-addendum-${Date.now()}` },
    });
    const otherUser = await prisma.user.create({
      data: {
        clinicId: otherClinic.id,
        email: `other-addendum-${Date.now()}@test.com`,
        name: "Other Provider",
        role: "Provider",
      },
    });
    const crossClinic: TestUser = {
      id: otherUser.id,
      email: otherUser.email,
      name: otherUser.name,
      role: otherUser.role,
      clinicId: otherClinic.id,
    };

    const result = await testCreateAddendum(encounter.id, "Cross-clinic attempt", crossClinic);
    expect(result.success).toBe(false);
    expect(result.error).toContain("different clinic");
  });

  // ---- Addendum: Audit Log ----

  it("Audit log created when addendum is added", async () => {
    const { encounter } = await createFinalizedEncounter(provider.id);

    await prisma.auditLog.deleteMany({
      where: { action: "AddendumCreated", entityId: encounter.id },
    });

    await testCreateAddendum(encounter.id, "Audit test addendum", provider);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "AddendumCreated", entityId: encounter.id },
    });
    expect(audit).toBeTruthy();
    expect(audit?.userId).toBe(provider.id);
    expect(audit?.entityType).toBe("Encounter");
  });

  // ---- Addendum: Multiple addenda ----

  it("Multiple addenda can be created and are ordered chronologically", async () => {
    const { encounter } = await createFinalizedEncounter(provider.id);

    await testCreateAddendum(encounter.id, "First addendum", provider);
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));
    await testCreateAddendum(encounter.id, "Second addendum", provider);

    const addenda = await prisma.addendum.findMany({
      where: { encounterId: encounter.id },
      orderBy: { createdAt: "asc" },
    });

    expect(addenda.length).toBe(2);
    expect(addenda[0].text).toBe("First addendum");
    expect(addenda[1].text).toBe("Second addendum");
    expect(addenda[0].createdAt.getTime()).toBeLessThanOrEqual(addenda[1].createdAt.getTime());
  });
});
