// POST /api/internal/migrations/runs/:id/edit-mapping
// Saves a user-edited MappingSpec as a new version before approval.
// This enables Phase 4 learning: the diff between draft and approved
// spec is detected at reconcile time and stored as high-confidence corrections.

import { NextRequest, NextResponse } from "next/server";
import { requirePermission, AuthorizationError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { validateMappingSpec } from "@/lib/migration/canonical/mapping-spec";

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

    if (run.mappingApprovedAt) {
      return NextResponse.json(
        { error: "Cannot edit mapping after approval" },
        { status: 400 }
      );
    }

    if (run.mappingSpecVersion === 0) {
      return NextResponse.json(
        { error: "No draft mapping to edit" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { mappingSpec } = body;

    if (!mappingSpec) {
      return NextResponse.json(
        { error: "mappingSpec is required" },
        { status: 400 }
      );
    }

    // Validate the edited spec structurally
    const validation = validateMappingSpec(mappingSpec);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Invalid mapping spec",
          details: validation.errors.map((e) => e.message),
        },
        { status: 422 }
      );
    }

    // Save as new version
    const newVersion = run.mappingSpecVersion + 1;
    await prisma.migrationMappingSpec.create({
      data: {
        runId: id,
        version: newVersion,
        spec: JSON.stringify(mappingSpec),
      },
    });

    await prisma.migrationRun.update({
      where: { id },
      data: { mappingSpecVersion: newVersion },
    });

    // Audit trail
    await prisma.migrationAuditEvent.create({
      data: {
        runId: id,
        phase: "draft_mapping",
        action: "MAPPING_EDITED_BY_USER",
        actorId: user.id,
        metadata: JSON.stringify({
          previousVersion: run.mappingSpecVersion,
          newVersion,
        }),
      },
    });

    return NextResponse.json({
      version: newVersion,
      message: "Mapping spec saved. Review and approve when ready.",
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Edit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
