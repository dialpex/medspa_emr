// POST /api/internal/migrations/runs — Create a new migration run
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, AuthorizationError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("migration", "create");
    const body = await request.json();

    const { sourceVendor, consentText } = body;

    if (!sourceVendor) {
      return NextResponse.json({ error: "sourceVendor is required" }, { status: 400 });
    }

    if (!consentText) {
      return NextResponse.json({ error: "consentText is required for HIPAA compliance" }, { status: 400 });
    }

    const run = await prisma.migrationRun.create({
      data: {
        clinicId: user.clinicId,
        sourceVendor,
        consentText,
        consentSignedAt: new Date(),
        startedById: user.id,
        startedAt: new Date(),
      },
    });

    await prisma.migrationAuditEvent.create({
      data: {
        runId: run.id,
        phase: "create",
        action: "RUN_CREATED",
        actorId: user.id,
        metadata: JSON.stringify({ sourceVendor }),
      },
    });

    return NextResponse.json({ id: run.id, status: run.status }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[Migration] Create run failed:", error);
    return NextResponse.json({ error: "Failed to create migration run" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await requirePermission("migration", "view");

    const runs = await prisma.migrationRun.findMany({
      where: { clinicId: user.clinicId },
      select: {
        id: true,
        sourceVendor: true,
        status: true,
        currentPhase: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        errorMessage: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(runs);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to list runs" }, { status: 500 });
  }
}
