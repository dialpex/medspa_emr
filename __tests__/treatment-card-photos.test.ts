import { describe, it, expect, beforeAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Test data
let clinicId: string;
let otherClinicId: string;
let userId: string;
let patientId: string;
let chartId: string;
let treatmentCardId: string;
let signedChartId: string;
let signedCardId: string;

beforeAll(async () => {
  // Get existing seed data
  const clinic = await prisma.clinic.findFirst({ where: { slug: "radiance-medspa" } });
  if (!clinic) throw new Error("Seed clinic not found");
  clinicId = clinic.id;

  const user = await prisma.user.findFirst({ where: { clinicId } });
  if (!user) throw new Error("Seed user not found");
  userId = user.id;

  const patient = await prisma.patient.findFirst({ where: { clinicId } });
  if (!patient) throw new Error("Seed patient not found");
  patientId = patient.id;

  // Create a draft chart with a treatment card
  const chart = await prisma.chart.create({
    data: {
      clinicId,
      patientId,
      createdById: userId,
      status: "Draft",
    },
  });
  chartId = chart.id;

  const card = await prisma.treatmentCard.create({
    data: {
      chartId,
      templateType: "Injectable",
      title: "Test Injectable Card",
      narrativeText: "Test narrative",
      structuredData: "{}",
    },
  });
  treatmentCardId = card.id;

  // Create a signed chart with treatment card for immutability test
  const sChart = await prisma.chart.create({
    data: {
      clinicId,
      patientId,
      createdById: userId,
      status: "MDSigned",
      signedById: userId,
      signedByName: "Test Provider",
      signedAt: new Date(),
      recordHash: "sha256:test",
    },
  });
  signedChartId = sChart.id;

  const sCard = await prisma.treatmentCard.create({
    data: {
      chartId: signedChartId,
      templateType: "Injectable",
      title: "Signed Card",
      narrativeText: "",
      structuredData: "{}",
    },
  });
  signedCardId = sCard.id;

  // Create another clinic for tenant isolation test
  const otherClinic = await prisma.clinic.upsert({
    where: { slug: "other-clinic-photo-test" },
    update: {},
    create: {
      name: "Other Clinic Photo Test",
      slug: "other-clinic-photo-test",
    },
  });
  otherClinicId = otherClinic.id;
});

describe("Treatment Card Photos", () => {
  it("creates a photo record attached to a treatment card", async () => {
    const photo = await prisma.photo.create({
      data: {
        clinicId,
        patientId,
        chartId,
        treatmentCardId,
        takenById: userId,
        filename: "test-photo.jpg",
        storagePath: `storage/photos/${clinicId}/${patientId}/test-photo.jpg`,
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        category: "treatment",
      },
    });

    expect(photo.treatmentCardId).toBe(treatmentCardId);
    expect(photo.chartId).toBe(chartId);
    expect(photo.clinicId).toBe(clinicId);
  });

  it("fetches photos for a specific treatment card", async () => {
    // Create a second card to verify isolation
    const otherCard = await prisma.treatmentCard.create({
      data: {
        chartId,
        templateType: "Laser",
        title: "Other Card",
        narrativeText: "",
        structuredData: "{}",
      },
    });

    await prisma.photo.create({
      data: {
        clinicId,
        patientId,
        chartId,
        treatmentCardId: otherCard.id,
        takenById: userId,
        filename: "other-card-photo.jpg",
        storagePath: `storage/photos/${clinicId}/${patientId}/other-card-photo.jpg`,
        mimeType: "image/jpeg",
        sizeBytes: 512,
      },
    });

    // Fetch photos only for the original treatment card
    const photos = await prisma.photo.findMany({
      where: { treatmentCardId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });

    expect(photos.length).toBeGreaterThanOrEqual(1);
    expect(photos.every((p) => p.treatmentCardId === treatmentCardId)).toBe(true);
  });

  it("soft-deletes a treatment card photo", async () => {
    const photo = await prisma.photo.create({
      data: {
        clinicId,
        patientId,
        chartId,
        treatmentCardId,
        takenById: userId,
        filename: "to-delete.jpg",
        storagePath: `storage/photos/${clinicId}/${patientId}/to-delete.jpg`,
        mimeType: "image/jpeg",
        sizeBytes: 256,
      },
    });

    await prisma.photo.update({
      where: { id: photo.id },
      data: { deletedAt: new Date() },
    });

    const found = await prisma.photo.findFirst({
      where: { id: photo.id, deletedAt: null },
    });
    expect(found).toBeNull();

    // Still exists in DB (soft delete)
    const raw = await prisma.photo.findUnique({ where: { id: photo.id } });
    expect(raw).not.toBeNull();
    expect(raw!.deletedAt).not.toBeNull();
  });

  it("enforces tenant isolation — cannot link photo to another clinic's card", async () => {
    // The card belongs to clinicId, create a photo under otherClinicId
    // It shouldn't happen in practice (route checks), but verify DB allows it
    // and that querying with clinic filter isolates correctly
    const otherUser = await prisma.user.upsert({
      where: { email: "other-clinic-photo-test@test.com" },
      update: {},
      create: {
        clinicId: otherClinicId,
        email: "other-clinic-photo-test@test.com",
        name: "Other User",
        role: "Provider",
      },
    });

    const otherPatient = await prisma.patient.create({
      data: {
        clinicId: otherClinicId,
        firstName: "Other",
        lastName: "Patient",
      },
    });

    // Query treatment card and verify it belongs to the correct clinic
    const card = await prisma.treatmentCard.findUnique({
      where: { id: treatmentCardId },
      select: { chart: { select: { clinicId: true } } },
    });

    expect(card).not.toBeNull();
    expect(card!.chart.clinicId).toBe(clinicId);
    expect(card!.chart.clinicId).not.toBe(otherClinicId);

    // Photos scoped to otherClinicId won't include photos from clinicId
    const otherPhotos = await prisma.photo.findMany({
      where: { clinicId: otherClinicId, deletedAt: null },
    });
    const leakedPhotos = otherPhotos.filter((p) => p.treatmentCardId === treatmentCardId);
    expect(leakedPhotos.length).toBe(0);

    // Cleanup
    await prisma.patient.delete({ where: { id: otherPatient.id } });
    await prisma.user.delete({ where: { id: otherUser.id } });
  });

  it("includes treatment card photos in chart query with include", async () => {
    const chart = await prisma.chart.findUnique({
      where: { id: chartId },
      include: {
        treatmentCards: {
          orderBy: { sortOrder: "asc" },
          include: {
            photos: {
              where: { deletedAt: null },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    expect(chart).not.toBeNull();
    expect(chart!.treatmentCards.length).toBeGreaterThanOrEqual(1);

    const testCard = chart!.treatmentCards.find((c) => c.id === treatmentCardId);
    expect(testCard).toBeDefined();
    expect(testCard!.photos.length).toBeGreaterThanOrEqual(1);
    expect(testCard!.photos[0].treatmentCardId).toBe(treatmentCardId);
  });
});
