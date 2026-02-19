import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

const ALLOWED_AUDIO_TYPES = [
  "audio/webm",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mpeg",
  "audio/ogg",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("ai", "create");
    const { id: treatmentCardId } = await params;

    const formData = await request.formData();
    const file = formData.get("audio") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
    }

    // Validate audio type (allow common MediaRecorder formats)
    if (!ALLOWED_AUDIO_TYPES.includes(file.type) && !file.type.startsWith("audio/")) {
      return NextResponse.json({ error: "Invalid audio format" }, { status: 400 });
    }

    // Validate size (25MB - Whisper limit)
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Audio must be under 25MB" }, { status: 400 });
    }

    // Load treatment card and verify access
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

    const isFinalized = card.chart.encounter
      ? card.chart.encounter.status === "Finalized"
      : card.chart.status === "MDSigned";
    if (isFinalized) {
      return NextResponse.json({ error: "Encounter finalized. Changes require addendum." }, { status: 400 });
    }
    if (card.chart.status !== "Draft") {
      return NextResponse.json({ error: "Cannot record for non-draft chart" }, { status: 400 });
    }

    // Store audio securely in internal storage (not publicly accessible)
    const fileId = generateId();
    const ext = file.type.includes("webm") ? ".webm" : file.type.includes("wav") ? ".wav" : ".m4a";
    const filename = `${fileId}${ext}`;
    const storagePath = `storage/ai-audio/${user.clinicId}/${treatmentCardId}/${filename}`;

    const dir = path.join(process.cwd(), "storage/ai-audio", user.clinicId, treatmentCardId);
    await mkdir(dir, { recursive: true });

    const bytes = new Uint8Array(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), bytes);

    // Create AiDraftEvent with kind=VOICE
    const event = await prisma.aiDraftEvent.create({
      data: {
        clinicId: user.clinicId,
        treatmentCardId,
        kind: "VOICE",
        audioUrl: storagePath,
        createdById: user.id,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "VoiceDraftRecorded",
        entityType: "TreatmentCard",
        entityId: treatmentCardId,
        details: JSON.stringify({ draftEventId: event.id }),
      },
    });

    return NextResponse.json({ draftEventId: event.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Voice upload failed";
    if (message.includes("Permission denied") || message.includes("Authentication required")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
