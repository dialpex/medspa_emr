import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requirePermission } from "@/lib/rbac";
import { AuthorizationError } from "@/lib/rbac-core";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
];

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("patients", "edit");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const patientId = formData.get("patientId") as string | null;
    const category = formData.get("category") as string | null;
    const notes = formData.get("notes") as string | null;

    if (!file || !patientId) {
      return NextResponse.json(
        { error: "File and patientId are required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PDF and image files are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File must be under 20MB" },
        { status: 400 }
      );
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { clinicId: true },
    });
    if (!patient || patient.clinicId !== user.clinicId) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const fileId = generateId();
    const ext = path.extname(file.name) || ".bin";
    const filename = `${fileId}${ext}`;
    const storagePath = `storage/documents/${user.clinicId}/${patientId}/${filename}`;

    const dir = path.join(process.cwd(), "storage/documents", user.clinicId, patientId);
    await mkdir(dir, { recursive: true });

    const rawBytes = new Uint8Array(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), rawBytes);

    const document = await prisma.patientDocument.create({
      data: {
        clinicId: user.clinicId,
        patientId,
        uploadedById: user.id,
        filename: file.name,
        storagePath,
        mimeType: file.type,
        sizeBytes: file.size,
        category,
        notes,
      },
    });

    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: "DocumentUpload",
      entityType: "PatientDocument",
      entityId: document.id,
      details: JSON.stringify({ patientId, category }),
    });

    return NextResponse.json({ success: true, document });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
