// GET /api/internal/migrations/runs/:id/report
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, AuthorizationError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("migration", "view");
    const { id } = await params;

    const run = await prisma.migrationRun.findFirst({
      where: { id, clinicId: user.clinicId },
      select: {
        id: true,
        sourceVendor: true,
        status: true,
        currentPhase: true,
        sourceProfile: true,
        mappingSpecVersion: true,
        mappingApprovedAt: true,
        progress: true,
        startedAt: true,
        completedAt: true,
        errorMessage: true,
        createdAt: true,
      },
    });

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const progress = JSON.parse(run.progress || "{}");

    // Get audit trail
    const auditEvents = await prisma.migrationAuditEvent.findMany({
      where: { runId: id },
      orderBy: { createdAt: "asc" },
      select: {
        phase: true,
        action: true,
        actorId: true,
        metadata: true,
        createdAt: true,
      },
    });

    // Get ledger summary
    const ledgerSummary = await prisma.migrationRecordLedger.groupBy({
      by: ["entityType", "status"],
      where: { runId: id },
      _count: true,
    });

    return NextResponse.json({
      run: {
        ...run,
        sourceProfile: run.sourceProfile ? JSON.parse(run.sourceProfile) : null,
        progress: undefined, // Don't expose raw progress
      },
      report: progress.report || null,
      auditTrail: auditEvents.map((e) => ({
        ...e,
        metadata: e.metadata ? JSON.parse(e.metadata) : null,
      })),
      ledgerSummary,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to get report" }, { status: 500 });
  }
}
