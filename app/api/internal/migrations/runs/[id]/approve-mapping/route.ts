// POST /api/internal/migrations/runs/:id/approve-mapping
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, AuthorizationError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { LocalArtifactStore } from "@/lib/migration/storage/local-store";
import { MigrationOrchestrator } from "@/lib/migration/pipeline/orchestrator";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("migration", "edit");
    const { id } = await params;

    const run = await prisma.migrationRun.findFirst({
      where: { id, clinicId: user.clinicId },
    });

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    if (run.mappingSpecVersion === 0) {
      return NextResponse.json({ error: "No mapping spec to approve" }, { status: 400 });
    }

    const store = new LocalArtifactStore();
    const orchestrator = new MigrationOrchestrator({ store });
    await orchestrator.approveMapping(id, user.id);

    return NextResponse.json({
      status: "MappingApproved",
      approvedAt: new Date().toISOString(),
      approvedBy: user.id,
      version: run.mappingSpecVersion,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Approval failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
