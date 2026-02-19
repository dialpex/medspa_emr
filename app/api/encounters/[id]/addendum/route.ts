/**
 * POST /api/encounters/[id]/addendum
 * Creates an append-only addendum for a Finalized encounter.
 * No update or delete endpoints exist — addenda are immutable.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, enforceTenantIsolation } from "@/lib/rbac";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: encounterId } = await params;
    const user = await requirePermission("charts", "edit");

    // Only Provider, Owner, Admin, MedicalDirector can create addenda
    const allowedRoles = ["Provider", "Owner", "Admin", "MedicalDirector"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: "Permission denied: insufficient role to create addendum" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Addendum text is required" },
        { status: 400 }
      );
    }

    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      select: {
        id: true,
        clinicId: true,
        patientId: true,
        status: true,
      },
    });

    if (!encounter) {
      return NextResponse.json(
        { error: "Encounter not found" },
        { status: 404 }
      );
    }

    // Tenant isolation
    enforceTenantIsolation(user, encounter.clinicId);

    // Must be Finalized
    if (encounter.status !== "Finalized") {
      return NextResponse.json(
        { error: "Addenda can only be added to finalized encounters" },
        { status: 400 }
      );
    }

    // Create addendum (append-only)
    const addendum = await prisma.addendum.create({
      data: {
        clinicId: encounter.clinicId,
        encounterId: encounter.id,
        authorId: user.id,
        text: text.trim(),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "AddendumCreated",
        entityType: "Encounter",
        entityId: encounter.id,
        details: JSON.stringify({
          addendumId: addendum.id,
          patientId: encounter.patientId,
        }),
      },
    });

    // Fetch author name for response
    const author = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true },
    });

    return NextResponse.json({
      success: true,
      addendum: {
        id: addendum.id,
        text: addendum.text,
        createdAt: addendum.createdAt.toISOString(),
        authorName: author?.name ?? "Unknown",
      },
    });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "name" in error) {
      const err = error as { name: string; message: string };
      if (err.name === "AuthorizationError" || err.name === "TenantIsolationError") {
        return NextResponse.json({ error: err.message }, { status: 403 });
      }
    }
    console.error("Addendum creation error:", error);
    return NextResponse.json(
      { error: "Failed to create addendum" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/encounters/[id]/addendum
 * Lists all addenda for an encounter, chronologically.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: encounterId } = await params;
    const user = await requirePermission("charts", "view");

    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      select: { id: true, clinicId: true },
    });

    if (!encounter) {
      return NextResponse.json(
        { error: "Encounter not found" },
        { status: 404 }
      );
    }

    enforceTenantIsolation(user, encounter.clinicId);

    const addenda = await prisma.addendum.findMany({
      where: { encounterId },
      orderBy: { createdAt: "asc" },
    });

    // Fetch author names
    const authorIds = [...new Set(addenda.map((a) => a.authorId))];
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, name: true },
    });
    const authorMap = new Map(authors.map((a) => [a.id, a.name]));

    return NextResponse.json({
      addenda: addenda.map((a) => ({
        id: a.id,
        text: a.text,
        createdAt: a.createdAt.toISOString(),
        authorName: authorMap.get(a.authorId) ?? "Unknown",
      })),
    });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "name" in error) {
      const err = error as { name: string; message: string };
      if (err.name === "AuthorizationError" || err.name === "TenantIsolationError") {
        return NextResponse.json({ error: err.message }, { status: 403 });
      }
    }
    return NextResponse.json(
      { error: "Failed to fetch addenda" },
      { status: 500 }
    );
  }
}
