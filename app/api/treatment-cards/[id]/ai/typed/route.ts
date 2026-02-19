import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { generateClinicalDraft } from "@/lib/ai/clinical-draft";
import { parseStructuredData } from "@/lib/templates/schemas";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("ai", "create");
    const { id: treatmentCardId } = await params;

    const body = await request.json();
    const { summaryText } = body;

    if (!summaryText || typeof summaryText !== "string" || summaryText.trim().length === 0) {
      return NextResponse.json({ error: "summaryText is required" }, { status: 400 });
    }

    // Load treatment card → chart → encounter → verify tenant
    const card = await prisma.treatmentCard.findUnique({
      where: { id: treatmentCardId },
      include: { chart: { include: { encounter: { select: { status: true } } } } },
    });

    if (!card) {
      return NextResponse.json({ error: "Treatment card not found" }, { status: 404 });
    }

    if (card.chart.clinicId !== user.clinicId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Verify chart not signed/finalized
    const isFinalized = card.chart.encounter
      ? card.chart.encounter.status === "Finalized"
      : card.chart.status === "MDSigned";
    if (isFinalized) {
      return NextResponse.json({ error: "Encounter finalized. Changes require addendum." }, { status: 400 });
    }
    if (card.chart.status !== "Draft") {
      return NextResponse.json({ error: "Cannot generate draft for non-draft chart" }, { status: 400 });
    }

    // Generate AI draft
    const currentStructured = parseStructuredData(card.templateType, card.structuredData) as Record<string, unknown>;

    const result = await generateClinicalDraft({
      templateType: card.templateType,
      currentStructured,
      currentNarrative: card.narrativeText,
      userSummary: summaryText.trim(),
    });

    // Create AiDraftEvent
    const event = await prisma.aiDraftEvent.create({
      data: {
        clinicId: user.clinicId,
        treatmentCardId,
        kind: "TYPED",
        inputSummaryText: summaryText.trim(),
        modelInfo: JSON.stringify({ provider: process.env.OPENAI_API_KEY ? "openai" : "mock", model: "gpt-4o" }),
        structuredPatch: JSON.stringify(result.structuredDataPatch),
        narrativeDraftText: result.narrativeDraftText,
        missingHighRisk: JSON.stringify(result.missingHighRisk),
        conflicts: JSON.stringify(result.conflicts),
        warnings: JSON.stringify(result.warnings),
        createdById: user.id,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "AiDraftCreated",
        entityType: "TreatmentCard",
        entityId: treatmentCardId,
        details: JSON.stringify({ draftEventId: event.id, kind: "TYPED" }),
      },
    });

    return NextResponse.json({
      draftEventId: event.id,
      structuredPatch: result.structuredDataPatch,
      narrativeDraftText: result.narrativeDraftText,
      missingHighRisk: result.missingHighRisk,
      conflicts: result.conflicts,
      warnings: result.warnings,
    });
  } catch (error) {
    console.error("[AI Draft Typed] Error:", error);
    const message = error instanceof Error ? error.message : "AI draft failed";
    if (message.includes("Permission denied") || message.includes("Authentication required")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
