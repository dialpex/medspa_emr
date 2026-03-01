// POST /api/internal/migrations/runs/:id/validate
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, AuthorizationError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { LocalArtifactStore } from "@/lib/migration/storage/local-store";
import { MigrationOrchestrator } from "@/lib/migration/pipeline/orchestrator";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("migration", "create");
    const { id } = await params;

    const run = await prisma.migrationRun.findFirst({
      where: { id, clinicId: user.clinicId },
    });

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const store = new LocalArtifactStore();
    const orchestrator = new MigrationOrchestrator({ store });

    try {
      await orchestrator.runPhase(id, "validate");
    } catch (validationError) {
      // Validation failures are expected — return the report, not a 500
      const updated = await prisma.migrationRun.findUnique({
        where: { id },
        select: { progress: true },
      });
      const progress = JSON.parse(updated?.progress || "{}");

      return NextResponse.json({
        status: "ValidationFailed",
        report: progress.validateResult?.report,
        error: validationError instanceof Error ? validationError.message : "Validation failed",
      }, { status: 422 });
    }

    const updated = await prisma.migrationRun.findUnique({
      where: { id },
      select: { status: true, progress: true },
    });
    const progress = JSON.parse(updated?.progress || "{}");

    return NextResponse.json({
      status: updated?.status,
      report: progress.validateResult?.report,
      samplingPacket: progress.validateResult?.samplingPacket,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Validation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
