import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("photos", "create");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const patientId = formData.get("patientId") as string | null;
    const chartId = formData.get("chartId") as string | null;
    const treatmentCardId = formData.get("treatmentCardId") as string | null;
    const category = formData.get("category") as string | null;

    if (!file || !patientId) {
      return NextResponse.json(
        { error: "File and patientId are required" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG and PNG images are allowed" },
        { status: 400 }
      );
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File must be under 10MB" },
        { status: 400 }
      );
    }

    // Verify patient belongs to clinic
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { clinicId: true },
    });
    if (!patient || patient.clinicId !== user.clinicId) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    // Verify chart is not finalized (chart-level upload)
    if (chartId) {
      const chart = await prisma.chart.findUnique({
        where: { id: chartId },
        select: { clinicId: true, status: true, encounter: { select: { status: true } } },
      });
      if (!chart || chart.clinicId !== user.clinicId) {
        return NextResponse.json({ error: "Chart not found" }, { status: 404 });
      }
      const isFinalized = chart.encounter
        ? chart.encounter.status === "Finalized"
        : chart.status === "MDSigned";
      if (isFinalized) {
        return NextResponse.json({ error: "Encounter finalized. Changes require addendum." }, { status: 400 });
      }
    }

    // Verify treatment card exists and belongs to a chart in the user's clinic
    if (treatmentCardId) {
      const card = await prisma.treatmentCard.findUnique({
        where: { id: treatmentCardId },
        select: { chart: { select: { clinicId: true, status: true, encounter: { select: { status: true } } } } },
      });
      if (!card || card.chart.clinicId !== user.clinicId) {
        return NextResponse.json({ error: "Treatment card not found" }, { status: 404 });
      }
      const isFinalized = card.chart.encounter
        ? card.chart.encounter.status === "Finalized"
        : card.chart.status === "MDSigned";
      if (isFinalized) {
        return NextResponse.json({ error: "Encounter finalized. Changes require addendum." }, { status: 400 });
      }
    }

    const fileId = generateId();
    const ext = file.type === "image/png" ? ".png" : ".jpg";
    const filename = `${fileId}${ext}`;
    const storagePath = `storage/photos/${user.clinicId}/${patientId}/${filename}`;

    const dir = path.join(process.cwd(), "storage/photos", user.clinicId, patientId);
    await mkdir(dir, { recursive: true });

    const bytes = new Uint8Array(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), bytes);

    const photo = await prisma.photo.create({
      data: {
        clinicId: user.clinicId,
        patientId,
        chartId,
        treatmentCardId,
        takenById: user.id,
        filename: file.name,
        storagePath,
        mimeType: file.type,
        sizeBytes: file.size,
        category,
      },
    });

    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "PhotoUpload",
        entityType: "Photo",
        entityId: photo.id,
        details: JSON.stringify({ patientId, chartId, treatmentCardId }),
      },
    });

    return NextResponse.json({ success: true, photo });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
