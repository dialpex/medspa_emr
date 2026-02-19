import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { applyStructuredPatch } from "@/lib/ai/clinical-draft";
import { parseStructuredData } from "@/lib/templates/schemas";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("charts", "edit");
    const { id: draftEventId } = await params;

    // Load draft event → treatment card → chart → encounter
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

    // Tenant isolation
    if (event.clinicId !== user.clinicId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Verify chart not signed/finalized
    const isFinalized = event.treatmentCard.chart.encounter
      ? event.treatmentCard.chart.encounter.status === "Finalized"
      : event.treatmentCard.chart.status === "MDSigned";
    if (isFinalized) {
      return NextResponse.json({ error: "Encounter finalized. Changes require addendum." }, { status: 400 });
    }
    if (event.treatmentCard.chart.status === "MDSigned" || event.treatmentCard.chart.status === "NeedsSignOff") {
      return NextResponse.json({ error: "Cannot apply draft to signed chart" }, { status: 400 });
    }

    // Verify not already applied
    if (event.appliedAt) {
      return NextResponse.json({ error: "Draft already applied" }, { status: 400 });
    }

    // Re-apply patch at apply time (handles edits between generate and apply)
    const currentStructured = parseStructuredData(
      event.treatmentCard.templateType,
      event.treatmentCard.structuredData
    ) as Record<string, unknown>;

    const patch = JSON.parse(event.structuredPatch) as Record<string, unknown>;
    const { merged } = applyStructuredPatch(currentStructured, patch);

    // Update treatment card
    await prisma.treatmentCard.update({
      where: { id: event.treatmentCardId },
      data: {
        structuredData: JSON.stringify(merged),
        narrativeText: event.narrativeDraftText,
      },
    });

    // Mark draft as applied
    await prisma.aiDraftEvent.update({
      where: { id: draftEventId },
      data: { appliedAt: new Date() },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "AiDraftApplied",
        entityType: "TreatmentCard",
        entityId: event.treatmentCardId,
        details: JSON.stringify({ draftEventId }),
      },
    });

    return NextResponse.json({
      success: true,
      updatedStructuredData: merged,
      updatedNarrativeText: event.narrativeDraftText,
    });
  } catch (error) {
    console.error("[AI Draft Apply] Error:", error);
    const message = error instanceof Error ? error.message : "Apply draft failed";
    if (message.includes("Permission denied") || message.includes("Authentication required")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
