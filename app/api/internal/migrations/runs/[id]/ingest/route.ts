// POST /api/internal/migrations/runs/:id/ingest
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
    const user = await requirePermission("migration", "create");
    const { id } = await params;

    const run = await prisma.migrationRun.findFirst({
      where: { id, clinicId: user.clinicId },
    });

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Accept file uploads or trigger API/browser ingest
    const body = await request.json().catch(() => ({}));

    // Store ingest config in progress
    await prisma.migrationRun.update({
      where: { id },
      data: {
        progress: JSON.stringify({
          ...JSON.parse(run.progress || "{}"),
          credentials: body.credentials,
          encryptedCredentials: body.encryptedCredentials,
          emrUrl: body.emrUrl,
        }),
      },
    });

    const store = new LocalArtifactStore();
    const orchestrator = new MigrationOrchestrator({ store });

    await orchestrator.runPhase(id, "ingest");

    const updated = await prisma.migrationRun.findUnique({
      where: { id },
      select: { status: true, currentPhase: true },
    });

    return NextResponse.json({ status: updated?.status, phase: updated?.currentPhase });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[Migration] Ingest failed:", error);
    const message = error instanceof Error ? error.message : "Ingest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
