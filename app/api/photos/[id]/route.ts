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
    const user = await requirePermission("photos", "view");

    const photo = await prisma.photo.findUnique({ where: { id } });
    if (!photo || photo.deletedAt) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    enforceTenantIsolation(user, photo.clinicId);

    const filePath = path.join(process.cwd(), photo.storagePath);
    const fileBuffer = await readFile(filePath);

    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "PhotoView",
        entityType: "Photo",
        entityId: id,
      },
    });

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": photo.mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to serve photo" }, { status: 500 });
  }
}
