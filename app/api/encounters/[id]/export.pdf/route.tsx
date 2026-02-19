/**
 * GET /api/encounters/[id]/export.pdf
 * Generates and returns a PDF for a Finalized encounter.
 */
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { prisma } from "@/lib/prisma";
import {
  requirePermission,
  enforceTenantIsolation,
} from "@/lib/rbac";
import { compositePhotoWithAnnotations } from "@/lib/pdf/photo-compositor";
import { EncounterDocument } from "@/lib/pdf/encounter-pdf";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Auth + permission
    const user = await requirePermission("charts", "view");

    // 2. Fetch encounter with all related data
    const encounter = await prisma.encounter.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            dateOfBirth: true,
          },
        },
        provider: {
          select: { name: true },
        },
        clinic: {
          select: { name: true },
        },
        chart: {
          include: {
            photos: {
              where: { deletedAt: null },
              orderBy: { createdAt: "asc" },
            },
            treatmentCards: {
              orderBy: { sortOrder: "asc" },
              include: {
                photos: {
                  where: { deletedAt: null },
                  orderBy: { createdAt: "asc" },
                },
              },
            },
            signedBy: { select: { name: true } },
            providerSignedBy: { select: { name: true } },
          },
        },
        appointment: {
          select: { startTime: true },
        },
      },
    });

    if (!encounter) {
      return NextResponse.json({ error: "Encounter not found" }, { status: 404 });
    }

    // 3. Tenant isolation
    enforceTenantIsolation(user, encounter.clinicId);

    // 4. Must be Finalized
    if (encounter.status !== "Finalized") {
      return NextResponse.json(
        { error: "Only finalized encounters can be exported" },
        { status: 400 }
      );
    }

    // 5. RBAC refinement: Providers can only export their own
    if (user.role === "Provider" && encounter.providerId !== user.id) {
      return NextResponse.json(
        { error: "Providers can only export their own encounters" },
        { status: 403 }
      );
    }

    // 6. Must have a chart
    const chart = encounter.chart;
    if (!chart) {
      return NextResponse.json(
        { error: "No chart associated with this encounter" },
        { status: 404 }
      );
    }

    // 7. Composite all photos
    const chartPhotos = await Promise.all(
      chart.photos
        .filter((p) => !p.treatmentCardId)
        .map(async (p) => ({
          id: p.id,
          buffer: await compositePhotoWithAnnotations(p.storagePath, p.annotations),
          caption: p.caption,
          category: p.category,
        }))
    );

    const treatmentCards = await Promise.all(
      chart.treatmentCards.map(async (card) => ({
        id: card.id,
        title: card.title,
        templateType: card.templateType,
        narrativeText: card.narrativeText,
        structuredData: card.structuredData,
        photos: await Promise.all(
          card.photos.map(async (p) => ({
            id: p.id,
            buffer: await compositePhotoWithAnnotations(
              p.storagePath,
              p.annotations
            ),
            caption: p.caption,
            category: p.category,
          }))
        ),
      }))
    );

    const generatedAt = new Date().toISOString();

    // 7b. Fetch addenda
    const rawAddenda = await prisma.addendum.findMany({
      where: { encounterId: encounter.id },
      orderBy: { createdAt: "asc" },
    });
    const addendaAuthorIds = [...new Set(rawAddenda.map((a) => a.authorId))];
    const addendaAuthors = addendaAuthorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: addendaAuthorIds } },
          select: { id: true, name: true },
        })
      : [];
    const addendaAuthorMap = new Map(addendaAuthors.map((a) => [a.id, a.name]));
    const addenda = rawAddenda.map((a) => ({
      id: a.id,
      text: a.text,
      createdAt: formatDate(a.createdAt),
      authorName: addendaAuthorMap.get(a.authorId) ?? "Unknown",
    }));

    // 8. Render PDF
    const pdfData = {
      encounterId: encounter.id,
      patientName: `${encounter.patient.lastName}, ${encounter.patient.firstName}`,
      patientDob: encounter.patient.dateOfBirth
        ? formatDate(encounter.patient.dateOfBirth)
        : null,
      providerName: encounter.provider.name,
      clinicName: encounter.clinic.name,
      appointmentDate: formatDate(encounter.appointment?.startTime),
      encounterStartedAt: formatDate(encounter.startedAt),
      finalizedAt: formatDate(encounter.finalizedAt),
      chiefComplaint: chart.chiefComplaint,
      additionalNotes: chart.additionalNotes,
      treatmentCards,
      chartPhotos,
      providerSignedBy: chart.providerSignedBy?.name ?? null,
      providerSignedAt: formatDate(chart.providerSignedAt),
      signedByName: chart.signedByName,
      signedAt: formatDate(chart.signedAt),
      addenda,
      generatedAt: new Date(generatedAt).toLocaleString("en-US"),
    };

    const pdfBuffer = await renderToBuffer(
      <EncounterDocument data={pdfData} />
    );

    // 9. Audit log
    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "ExportPdf",
        entityType: "Encounter",
        entityId: encounter.id,
        details: JSON.stringify({
          patientId: encounter.patientId,
          chartId: chart.id,
        }),
      },
    });

    // 10. Return PDF response
    const safeLastName = encounter.patient.lastName.replace(/[^a-zA-Z0-9]/g, "");
    const safeFirstName = encounter.patient.firstName.replace(/[^a-zA-Z0-9]/g, "");
    const dateStr = encounter.appointment?.startTime
      ? new Date(encounter.appointment.startTime).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const filename = `encounter_${safeLastName}_${safeFirstName}_${dateStr}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "name" in error) {
      const err = error as { name: string; message: string };
      if (err.name === "AuthorizationError" || err.name === "TenantIsolationError") {
        return NextResponse.json({ error: err.message }, { status: 403 });
      }
    }
    console.error("PDF export error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
