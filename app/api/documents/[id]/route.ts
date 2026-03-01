import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { requirePermission, enforceTenantIsolation } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requirePermission("patients", "view");

    const document = await prisma.patientDocument.findUnique({ where: { id } });
    if (!document || document.deletedAt) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    enforceTenantIsolation(user, document.clinicId);

    const filePath = path.join(process.cwd(), document.storagePath);
    const fileBuffer = await readFile(filePath);

    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "DocumentView",
        entityType: "PatientDocument",
        entityId: id,
      },
    });

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${document.filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to serve document" }, { status: 500 });
  }
}
