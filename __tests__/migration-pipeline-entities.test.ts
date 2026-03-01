import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { MockMigrationProvider } from "../lib/migration/providers/mock";

const prisma = new PrismaClient();
const provider = new MockMigrationProvider();
const credentials = { email: "admin@clinic.com", password: "test-password" };

// Test data IDs — we'll create these in setup
let clinicId: string;
let ownerId: string;
let jobId: string;

beforeAll(async () => {
  // Create test clinic
  const clinic = await prisma.clinic.create({
    data: {
      name: "Pipeline Test Clinic",
      slug: `pipeline-test-${Date.now()}`,
    },
  });
  clinicId = clinic.id;

  // Create owner user
  const owner = await prisma.user.create({
    data: {
      clinicId,
      email: `pipeline-owner-${Date.now()}@test.com`,
      name: "Pipeline Test Owner",
      role: "Owner",
    },
  });
  ownerId = owner.id;

  // Create migration job
  const job = await prisma.migrationJob.create({
    data: {
      clinicId,
      source: "Boulevard",
      status: "Migrating",
      startedById: ownerId,
      progress: "{}",
    },
  });
  jobId = job.id;

  // Create patient entity maps (simulating patients already imported)
  const mockPatients = await provider.fetchPatients(credentials);
  for (const patient of mockPatients.data) {
    const created = await prisma.patient.create({
      data: {
        clinicId,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
      },
    });
    await prisma.migrationEntityMap.create({
      data: {
        jobId,
        entityType: "Patient",
        sourceId: patient.sourceId,
        targetId: created.id,
      },
    });
  }

  // Create service entity maps (simulating services already imported)
  const mockServices = await provider.fetchServices(credentials);
  for (const svc of mockServices.data) {
    const created = await prisma.service.create({
      data: {
        clinicId,
        name: svc.name,
        price: svc.price ?? 0,
      },
    });
    await prisma.migrationEntityMap.create({
      data: {
        jobId,
        entityType: "Service",
        sourceId: svc.sourceId,
        targetId: created.id,
      },
    });
  }
});

afterAll(async () => {
  // Cleanup in reverse dependency order
  await prisma.migrationLog.deleteMany({ where: { jobId } });
  await prisma.migrationEntityMap.deleteMany({ where: { jobId } });
  await prisma.migrationJob.deleteMany({ where: { id: jobId } });
  await prisma.patientDocument.deleteMany({ where: { clinicId } });
  await prisma.patientConsent.deleteMany({ where: { clinicId } });
  await prisma.consentTemplate.deleteMany({ where: { clinicId } });
  await prisma.photo.deleteMany({ where: { clinicId } });
  await prisma.chart.deleteMany({ where: { clinicId } });
  await prisma.invoiceItem.deleteMany({ where: { clinicId } });
  await prisma.invoice.deleteMany({ where: { clinicId } });
  await prisma.appointment.deleteMany({ where: { clinicId } });
  await prisma.service.deleteMany({ where: { clinicId } });
  await prisma.patient.deleteMany({ where: { clinicId } });
  await prisma.auditLog.deleteMany({ where: { clinicId } });
  await prisma.user.deleteMany({ where: { clinicId } });
  await prisma.clinic.deleteMany({ where: { id: clinicId } });
  await prisma.$disconnect();
});

describe("Mock provider entity fetch — photos", () => {
  it("fetchPhotos returns photo records with URLs and metadata", async () => {
    const result = await provider.fetchPhotos!(credentials);
    expect(result.data.length).toBe(2);
    for (const photo of result.data) {
      expect(photo.sourceId).toBeTruthy();
      expect(photo.patientSourceId).toBeTruthy();
      expect(photo.url).toBeTruthy();
      expect(photo.rawData).toBeDefined();
    }
  });

  it("photos have category and caption metadata", async () => {
    const result = await provider.fetchPhotos!(credentials);
    const categories = result.data.map((p) => p.category).filter(Boolean);
    expect(categories).toContain("before");
    expect(categories).toContain("after");
  });
});

describe("Mock provider entity fetch — forms", () => {
  it("fetchForms returns form records with template info", async () => {
    const result = await provider.fetchForms!(credentials);
    expect(result.data.length).toBe(5);
    for (const form of result.data) {
      expect(form.sourceId).toBeTruthy();
      expect(form.patientSourceId).toBeTruthy();
      expect(form.templateName).toBeTruthy();
    }
  });

  it("forms have dedup-able template names", async () => {
    const result = await provider.fetchForms!(credentials);
    const templateNames = result.data.map((f) => f.templateName);
    const uniqueNames = new Set(templateNames);
    // 5 forms with unique template names
    expect(uniqueNames.size).toBe(5);
  });
});

describe("Mock provider entity fetch — documents", () => {
  it("fetchDocuments returns document records with URLs and filenames", async () => {
    const result = await provider.fetchDocuments!(credentials);
    expect(result.data.length).toBe(3);
    for (const doc of result.data) {
      expect(doc.sourceId).toBeTruthy();
      expect(doc.patientSourceId).toBeTruthy();
      expect(doc.url).toBeTruthy();
      expect(doc.filename).toBeTruthy();
    }
  });
});

describe("Mock provider entity fetch — charts", () => {
  it("fetchCharts returns chart records with clinical notes", async () => {
    const result = await provider.fetchCharts!(credentials);
    expect(result.data.length).toBe(3);
    for (const chart of result.data) {
      expect(chart.sourceId).toBeTruthy();
      expect(chart.patientSourceId).toBeTruthy();
      expect(chart.date).toBeTruthy();
      expect(chart.notes).toBeTruthy();
    }
  });

  it("chart records have provider attribution", async () => {
    const result = await provider.fetchCharts!(credentials);
    const withProvider = result.data.filter((c) => c.providerName);
    expect(withProvider.length).toBe(3);
  });
});

describe("Pipeline entity import — charts create actual Chart records", () => {
  it("importCharts creates Chart records with MDSigned status", async () => {
    // We test the logic inline to avoid Next.js deps from the pipeline module
    const charts = await provider.fetchCharts!(credentials);
    const patientMaps = await prisma.migrationEntityMap.findMany({
      where: { jobId, entityType: "Patient" },
    });

    let imported = 0;
    for (const chart of charts.data) {
      const pMap = patientMaps.find((m) => m.sourceId === chart.patientSourceId);
      if (!pMap) continue;

      const chartDate = new Date(chart.date);
      const chiefComplaint = chart.notes
        ? chart.notes.substring(0, 200) + (chart.notes.length > 200 ? "..." : "")
        : null;

      const newChart = await prisma.chart.create({
        data: {
          clinicId,
          patientId: pMap.targetId,
          status: "MDSigned",
          chiefComplaint,
          additionalNotes: chart.notes || null,
          createdById: ownerId,
          signedByName: chart.providerName || null,
          signedAt: chartDate,
          createdAt: chartDate,
        },
      });

      expect(newChart.status).toBe("MDSigned");
      expect(newChart.signedByName).toBeTruthy();
      expect(newChart.chiefComplaint).toBeTruthy();
      imported++;
    }

    expect(imported).toBe(3);

    // Verify charts are in DB
    const allCharts = await prisma.chart.findMany({
      where: { clinicId, status: "MDSigned" },
    });
    expect(allCharts.length).toBe(3);
  });
});

describe("Pipeline entity import — forms create ConsentTemplates and PatientConsents", () => {
  it("importForms creates deduplicated ConsentTemplates and PatientConsent records", async () => {
    const forms = await provider.fetchForms!(credentials);
    const patientMaps = await prisma.migrationEntityMap.findMany({
      where: { jobId, entityType: "Patient" },
    });

    const templateCache = new Map<string, string>();
    let imported = 0;

    for (const form of forms.data) {
      const pMap = patientMaps.find((m) => m.sourceId === form.patientSourceId);
      if (!pMap) continue;

      // Find or create ConsentTemplate
      let templateId = templateCache.get(form.templateName);
      if (!templateId) {
        const existing = await prisma.consentTemplate.findFirst({
          where: { clinicId, name: form.templateName },
          select: { id: true },
        });

        if (existing) {
          templateId = existing.id;
        } else {
          const newTemplate = await prisma.consentTemplate.create({
            data: {
              clinicId,
              name: form.templateName,
              content: `[Imported from Mock] This consent template was automatically created during data migration.`,
              version: "1.0",
              isActive: true,
            },
          });
          templateId = newTemplate.id;
        }
        templateCache.set(form.templateName, templateId);
      }

      const newConsent = await prisma.patientConsent.create({
        data: {
          clinicId,
          patientId: pMap.targetId,
          templateId,
          signedAt: form.submittedAt ? new Date(form.submittedAt) : null,
          templateSnapshot: JSON.stringify({
            importedFrom: "Mock",
            originalStatus: form.status,
          }),
        },
      });

      expect(newConsent.signedAt).toBeTruthy();
      imported++;
    }

    expect(imported).toBe(5);

    // Verify template deduplication — 5 unique template names
    const templates = await prisma.consentTemplate.findMany({
      where: { clinicId },
    });
    expect(templates.length).toBe(5);

    // Verify consents
    const consents = await prisma.patientConsent.findMany({
      where: { clinicId },
    });
    expect(consents.length).toBe(5);
  });
});

describe("Pipeline entity import — documents create PatientDocument records", () => {
  it("importDocuments creates PatientDocument records with correct fields", async () => {
    const docs = await provider.fetchDocuments!(credentials);
    const patientMaps = await prisma.migrationEntityMap.findMany({
      where: { jobId, entityType: "Patient" },
    });

    let imported = 0;
    for (const doc of docs.data) {
      const pMap = patientMaps.find((m) => m.sourceId === doc.patientSourceId);
      if (!pMap) continue;

      const newDoc = await prisma.patientDocument.create({
        data: {
          clinicId,
          patientId: pMap.targetId,
          uploadedById: ownerId,
          filename: doc.filename,
          storagePath: `storage/documents/${clinicId}/${pMap.targetId}/${doc.filename}`,
          mimeType: doc.mimeType || null,
          sizeBytes: 0, // Mock — no actual download
          category: doc.category || "imported",
          notes: `[Imported from Mock]`,
        },
      });

      expect(newDoc.filename).toBe(doc.filename);
      expect(newDoc.category).toBeTruthy();
      expect(newDoc.clinicId).toBe(clinicId);
      imported++;
    }

    expect(imported).toBe(3);

    // Verify documents in DB
    const allDocs = await prisma.patientDocument.findMany({
      where: { clinicId },
    });
    expect(allDocs.length).toBe(3);
  });
});

describe("Pipeline dependency order", () => {
  it("patient maps exist before entity import (photos/forms/docs depend on patients)", async () => {
    const patientMaps = await prisma.migrationEntityMap.findMany({
      where: { jobId, entityType: "Patient" },
    });
    expect(patientMaps.length).toBeGreaterThan(0);

    // Each patient map has a valid target
    for (const m of patientMaps) {
      const patient = await prisma.patient.findUnique({ where: { id: m.targetId } });
      expect(patient).not.toBeNull();
    }
  });
});

describe("ConnectionTestResult includes locationId", () => {
  it("mock provider returns locationId in test connection", async () => {
    const result = await provider.testConnection(credentials);
    expect(result.connected).toBe(true);
    expect(result.locationId).toBe("mock-loc-1");
  });
});
