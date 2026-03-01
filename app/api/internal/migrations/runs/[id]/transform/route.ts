// POST /api/internal/migrations/runs/:id/transform
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
    await orchestrator.runPhase(id, "transform");

    const updated = await prisma.migrationRun.findUnique({
      where: { id },
      select: { status: true, progress: true },
    });

    const progress = JSON.parse(updated?.progress || "{}");

    return NextResponse.json({
      status: updated?.status,
      counts: progress.transformResult?.counts,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Transform failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
