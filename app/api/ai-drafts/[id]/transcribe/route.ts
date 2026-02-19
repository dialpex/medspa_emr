import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { transcribeAudio } from "@/lib/ai/clinical-draft";

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

    if (!event.audioUrl) {
      return NextResponse.json({ error: "No audio recorded" }, { status: 400 });
    }

    if (event.transcriptText) {
      // Already transcribed - return cached
      return NextResponse.json({ transcriptText: event.transcriptText });
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

    // Transcribe
    const audioPath = path.join(process.cwd(), event.audioUrl);
    const transcriptText = await transcribeAudio(audioPath);

    // Save transcript
    await prisma.aiDraftEvent.update({
      where: { id: draftEventId },
      data: { transcriptText },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "TranscriptCreated",
        entityType: "TreatmentCard",
        entityId: event.treatmentCardId,
        details: JSON.stringify({ draftEventId }),
      },
    });

    return NextResponse.json({ transcriptText });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    if (message.includes("Permission denied") || message.includes("Authentication required")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
