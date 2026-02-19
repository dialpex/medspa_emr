import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { generateClinicalDraft } from "@/lib/ai/clinical-draft";
import { parseStructuredData } from "@/lib/templates/schemas";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("ai", "create");
    const { id: draftEventId } = await params;

    const event = await prisma.aiDraftEvent.findUnique({
      where: { id: draftEventId },
      include: {
        treatmentCard: {
          include: { chart: { include: { encounter: { select: { status: true } } } } },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Draft event not found" }, { status: 404 });
    }

    if (event.clinicId !== user.clinicId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (event.kind !== "VOICE") {
      return NextResponse.json({ error: "Not a voice draft" }, { status: 400 });
    }

    if (!event.transcriptText) {
      return NextResponse.json({ error: "Transcript not yet available" }, { status: 400 });
    }

    const isFinalized = event.treatmentCard.chart.encounter
      ? event.treatmentCard.chart.encounter.status === "Finalized"
      : event.treatmentCard.chart.status === "MDSigned";
    if (isFinalized) {
      return NextResponse.json({ error: "Encounter finalized. Changes require addendum." }, { status: 400 });
    }
    if (event.treatmentCard.chart.status !== "Draft") {
      return NextResponse.json({ error: "Chart is not in draft status" }, { status: 400 });
    }

    // Already structured - return cached result
    const existingPatch = JSON.parse(event.structuredPatch);
    if (Object.keys(existingPatch).length > 0) {
      return NextResponse.json({
        draftEventId: event.id,
        structuredPatch: existingPatch,
        narrativeDraftText: event.narrativeDraftText,
        missingHighRisk: JSON.parse(event.missingHighRisk),
        conflicts: JSON.parse(event.conflicts),
        warnings: JSON.parse(event.warnings),
        transcriptText: event.transcriptText,
      });
    }

    // Use transcript as input to the same clinical draft pipeline
    const currentStructured = parseStructuredData(
      event.treatmentCard.templateType,
      event.treatmentCard.structuredData
    ) as Record<string, unknown>;

    const result = await generateClinicalDraft({
      templateType: event.treatmentCard.templateType,
      currentStructured,
      currentNarrative: event.treatmentCard.narrativeText,
      userSummary: event.transcriptText,
    });

    // Save results
    await prisma.aiDraftEvent.update({
      where: { id: draftEventId },
      data: {
        modelInfo: JSON.stringify({
          provider: process.env.OPENAI_API_KEY ? "openai" : "mock",
          model: "gpt-4o",
        }),
        structuredPatch: JSON.stringify(result.structuredDataPatch),
        narrativeDraftText: result.narrativeDraftText,
        missingHighRisk: JSON.stringify(result.missingHighRisk),
        conflicts: JSON.stringify(result.conflicts),
        warnings: JSON.stringify(result.warnings),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "AiDraftCreated",
        entityType: "TreatmentCard",
        entityId: event.treatmentCardId,
        details: JSON.stringify({ draftEventId, kind: "VOICE" }),
      },
    });

    return NextResponse.json({
      draftEventId: event.id,
      structuredPatch: result.structuredDataPatch,
      narrativeDraftText: result.narrativeDraftText,
      missingHighRisk: result.missingHighRisk,
      conflicts: result.conflicts,
      warnings: result.warnings,
      transcriptText: event.transcriptText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Structure failed";
    if (message.includes("Permission denied") || message.includes("Authentication required")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
