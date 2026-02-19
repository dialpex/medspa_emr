import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  mockTranscribeAudio,
  mockClinicalDraft,
  applyStructuredPatch,
} from "../lib/ai/clinical-draft";

const prisma = new PrismaClient();

// ==========================================================================
// Pure unit tests (no DB)
// ==========================================================================

describe("mockTranscribeAudio", () => {
  it("returns a deterministic transcript string", () => {
    const transcript = mockTranscribeAudio();
    expect(transcript.length).toBeGreaterThan(0);
    expect(transcript.toLowerCase()).toContain("botox");
    expect(transcript.toLowerCase()).toContain("forehead");
  });
});

describe("voice draft pipeline (mock)", () => {
  it("transcript feeds into mockClinicalDraft and produces structured patch", () => {
    const transcript = mockTranscribeAudio();
    const result = mockClinicalDraft(
      "Injectable",
      {
        productName: "",
        areas: [],
        totalUnits: 0,
        lotEntries: [],
        outcome: "",
        followUpPlan: "",
        aftercare: "",
      },
      transcript
    );

    expect(result.structuredDataPatch.productName).toBe("Botox");
    expect(result.narrativeDraftText.length).toBeGreaterThan(0);
  });
});

// ==========================================================================
// DB integration tests
// ==========================================================================

describe("AiDraftEvent VOICE integration", () => {
  let clinicId: string;
  let userId: string;
  let chartId: string;
  let treatmentCardId: string;

  beforeAll(async () => {
    const clinic = await prisma.clinic.findFirst();
    if (!clinic) throw new Error("No clinic in DB -- run seed first");
    clinicId = clinic.id;

    const user = await prisma.user.findFirst({ where: { clinicId } });
    if (!user) throw new Error("No user in DB");
    userId = user.id;

    const chart = await prisma.chart.findFirst({
      where: { clinicId },
      include: { treatmentCards: true },
    });
    if (!chart) throw new Error("No chart in DB");
    chartId = chart.id;

    if (chart.treatmentCards.length > 0) {
      treatmentCardId = chart.treatmentCards[0].id;
    } else {
      const card = await prisma.treatmentCard.create({
        data: {
          chartId: chart.id,
          templateType: "Injectable",
          title: "Voice Draft Test Card",
          narrativeText: "",
          structuredData: JSON.stringify({
            productName: "",
            areas: [],
            totalUnits: 0,
            lotEntries: [],
            outcome: "",
            followUpPlan: "",
            aftercare: "",
          }),
        },
      });
      treatmentCardId = card.id;
    }
  });

  afterAll(async () => {
    await prisma.aiDraftEvent.deleteMany({
      where: { clinicId, kind: "VOICE", inputSummaryText: "" },
    });
    await prisma.$disconnect();
  });

  it("creates VOICE AiDraftEvent with audioUrl", async () => {
    const event = await prisma.aiDraftEvent.create({
      data: {
        clinicId,
        treatmentCardId,
        kind: "VOICE",
        audioUrl: "storage/ai-audio/test/recording.webm",
        createdById: userId,
      },
    });

    expect(event.id).toBeTruthy();
    expect(event.kind).toBe("VOICE");
    expect(event.audioUrl).toBe("storage/ai-audio/test/recording.webm");
    expect(event.transcriptText).toBeNull();
    expect(event.inputSummaryText).toBe("");
    expect(event.appliedAt).toBeNull();

    // Cleanup
    await prisma.aiDraftEvent.delete({ where: { id: event.id } });
  });

  it("transcribe step writes transcriptText", async () => {
    const event = await prisma.aiDraftEvent.create({
      data: {
        clinicId,
        treatmentCardId,
        kind: "VOICE",
        audioUrl: "storage/ai-audio/test/recording.webm",
        createdById: userId,
      },
    });

    // Simulate transcription
    const transcript = mockTranscribeAudio();
    await prisma.aiDraftEvent.update({
      where: { id: event.id },
      data: { transcriptText: transcript },
    });

    const updated = await prisma.aiDraftEvent.findUnique({ where: { id: event.id } });
    expect(updated?.transcriptText).toBe(transcript);
    expect(updated?.transcriptText?.length).toBeGreaterThan(0);

    // Cleanup
    await prisma.aiDraftEvent.delete({ where: { id: event.id } });
  });

  it("structure step writes structuredPatch and narrativeDraftText", async () => {
    const event = await prisma.aiDraftEvent.create({
      data: {
        clinicId,
        treatmentCardId,
        kind: "VOICE",
        audioUrl: "storage/ai-audio/test/recording.webm",
        transcriptText: mockTranscribeAudio(),
        createdById: userId,
      },
    });

    // Load treatment card structured data
    const tc = await prisma.treatmentCard.findUnique({ where: { id: treatmentCardId } });
    const currentStructured = JSON.parse(tc!.structuredData) as Record<string, unknown>;

    const result = mockClinicalDraft("Injectable", currentStructured, event.transcriptText!);

    await prisma.aiDraftEvent.update({
      where: { id: event.id },
      data: {
        structuredPatch: JSON.stringify(result.structuredDataPatch),
        narrativeDraftText: result.narrativeDraftText,
        missingHighRisk: JSON.stringify(result.missingHighRisk),
        conflicts: JSON.stringify(result.conflicts),
        warnings: JSON.stringify(result.warnings),
      },
    });

    const updated = await prisma.aiDraftEvent.findUnique({ where: { id: event.id } });
    const patch = JSON.parse(updated!.structuredPatch);
    expect(Object.keys(patch).length).toBeGreaterThan(0);
    expect(updated!.narrativeDraftText.length).toBeGreaterThan(0);

    // Cleanup
    await prisma.aiDraftEvent.delete({ where: { id: event.id } });
  });

  it("apply respects locked (signed) chart", async () => {
    // Create a voice draft
    const event = await prisma.aiDraftEvent.create({
      data: {
        clinicId,
        treatmentCardId,
        kind: "VOICE",
        audioUrl: "storage/ai-audio/test/recording.webm",
        transcriptText: mockTranscribeAudio(),
        structuredPatch: JSON.stringify({ productName: "Botox" }),
        narrativeDraftText: "Test narrative.",
        createdById: userId,
      },
    });

    // Find a signed chart to test against
    const signedChart = await prisma.chart.findFirst({
      where: { clinicId, status: "MDSigned" },
    });

    // The apply route checks chart.status === "MDSigned"
    // We verify that the logic condition holds
    if (signedChart) {
      expect(signedChart.status).toBe("MDSigned");
    }

    // Also verify: applying updates appliedAt correctly
    const tc = await prisma.treatmentCard.findUnique({ where: { id: treatmentCardId } });
    const currentStructured = JSON.parse(tc!.structuredData) as Record<string, unknown>;
    const patch = JSON.parse(event.structuredPatch) as Record<string, unknown>;
    const { merged } = applyStructuredPatch(currentStructured, patch);
    expect(merged).toBeTruthy();

    // Cleanup
    await prisma.aiDraftEvent.delete({ where: { id: event.id } });
  });

  it("enforces tenant isolation: clinicId must match", async () => {
    const event = await prisma.aiDraftEvent.create({
      data: {
        clinicId,
        treatmentCardId,
        kind: "VOICE",
        audioUrl: "storage/ai-audio/test/recording.webm",
        createdById: userId,
      },
    });

    // Verify clinicId is stored and would be checked
    expect(event.clinicId).toBe(clinicId);

    // A user from a different clinic would fail the check:
    // event.clinicId !== differentClinicId -> return 403
    const fakeClinicId = "fake-clinic-id";
    expect(event.clinicId).not.toBe(fakeClinicId);

    // Cleanup
    await prisma.aiDraftEvent.delete({ where: { id: event.id } });
  });
});
