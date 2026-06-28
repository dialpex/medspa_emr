import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { requirePermission, enforceTenantIsolation } from "@/lib/rbac";
import { AuthorizationError } from "@/lib/rbac-core";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

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

    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: "DocumentView",
      entityType: "PatientDocument",
      entityId: id,
    });

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${document.filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to serve document" }, { status: 500 });
  }
}

const DELETE_ALLOWED_ROLES = ["Owner", "Admin", "Provider"];

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requirePermission("patients", "edit");

    if (!DELETE_ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: "Not authorized to delete documents" }, { status: 403 });
    }

    const document = await prisma.patientDocument.findUnique({ where: { id } });
    if (!document || document.deletedAt) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    enforceTenantIsolation(user, document.clinicId);

    await prisma.patientDocument.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: "DocumentDelete",
      entityType: "PatientDocument",
      entityId: id,
      details: JSON.stringify({ filename: document.filename }),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
