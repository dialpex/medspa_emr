"use server";

import { prisma } from "@/lib/prisma";
import {
  requirePermission,
  AuthorizationError,
} from "@/lib/rbac";

export async function createPhotoRecord(data: {
  patientId: string;
  chartId?: string;
  treatmentCardId?: string;
  filename: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  category?: string;
  caption?: string;
}) {
  try {
    const user = await requirePermission("photos", "create");

    // Immutability: reject uploads to finalized encounters
    if (data.chartId) {
      const chart = await prisma.chart.findUnique({
        where: { id: data.chartId },
        select: { encounter: { select: { status: true } }, status: true },
      });
      if (chart) {
        const isFinalized = chart.encounter
          ? chart.encounter.status === "Finalized"
          : chart.status === "MDSigned";
        if (isFinalized) {
          return { success: false as const, error: "Encounter finalized. Changes require addendum." };
        }
      }
    }
    if (data.treatmentCardId) {
      const card = await prisma.treatmentCard.findUnique({
        where: { id: data.treatmentCardId },
        select: { chart: { select: { encounter: { select: { status: true } }, status: true } } },
      });
      if (card) {
        const isFinalized = card.chart.encounter
          ? card.chart.encounter.status === "Finalized"
          : card.chart.status === "MDSigned";
        if (isFinalized) {
          return { success: false as const, error: "Encounter finalized. Changes require addendum." };
        }
      }
    }

    const photo = await prisma.photo.create({
      data: {
        clinicId: user.clinicId,
        patientId: data.patientId,
        chartId: data.chartId,
        treatmentCardId: data.treatmentCardId,
        takenById: user.id,
        filename: data.filename,
        storagePath: data.storagePath,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        category: data.category,
        caption: data.caption,
      },
    });

    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "PhotoUpload",
        entityType: "Photo",
        entityId: photo.id,
        details: JSON.stringify({ patientId: data.patientId, chartId: data.chartId }),
      },
    });

    return { success: true as const, data: photo };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false as const, error: error.message };
    }
    throw error;
  }
}

export async function updatePhotoAnnotations(id: string, annotations: string) {
  try {
    const user = await requirePermission("photos", "edit");

    const photo = await prisma.photo.findFirst({
      where: { id, clinicId: user.clinicId, deletedAt: null },
      include: {
        chart: { select: { encounter: { select: { status: true } }, status: true } },
        treatmentCard: { select: { chart: { select: { encounter: { select: { status: true } }, status: true } } } },
      },
    });
    if (!photo) return { success: false as const, error: "Photo not found" };

    // Immutability: reject annotation updates on finalized encounters
    const chartRef = photo.chart ?? photo.treatmentCard?.chart;
    if (chartRef) {
      const isFinalized = chartRef.encounter
        ? chartRef.encounter.status === "Finalized"
        : chartRef.status === "MDSigned";
      if (isFinalized) {
        return { success: false as const, error: "Encounter finalized. Changes require addendum." };
      }
    }

    await prisma.photo.update({
      where: { id },
      data: { annotations },
    });

    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "PhotoAnnotationUpdate",
        entityType: "Photo",
        entityId: id,
        details: JSON.stringify({ patientId: photo.patientId }),
      },
    });

    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false as const, error: error.message };
    }
    throw error;
  }
}

export async function deletePhoto(id: string) {
  try {
    const user = await requirePermission("photos", "delete");

    const photo = await prisma.photo.findFirst({
      where: { id, clinicId: user.clinicId, deletedAt: null },
      include: {
        chart: { select: { encounter: { select: { status: true } }, status: true } },
        treatmentCard: { select: { chart: { select: { encounter: { select: { status: true } }, status: true } } } },
      },
    });
    if (!photo) return { success: false as const, error: "Photo not found" };

    // Immutability: reject deletion on finalized encounters
    const chartRef = photo.chart ?? photo.treatmentCard?.chart;
    if (chartRef) {
      const isFinalized = chartRef.encounter
        ? chartRef.encounter.status === "Finalized"
        : chartRef.status === "MDSigned";
      if (isFinalized) {
        return { success: false as const, error: "Encounter finalized. Changes require addendum." };
      }
    }

    await prisma.photo.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "PhotoDelete",
        entityType: "Photo",
        entityId: id,
        details: JSON.stringify({ patientId: photo.patientId, filename: photo.filename }),
      },
    });

    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false as const, error: error.message };
    }
    throw error;
  }
}

export async function getPhotosForChart(chartId: string) {
  const user = await requirePermission("photos", "view");

  const chart = await prisma.chart.findFirst({
    where: { id: chartId, clinicId: user.clinicId, deletedAt: null },
  });
  if (!chart) return [];

  const photos = await prisma.photo.findMany({
    where: { chartId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  if (photos.length > 0) {
    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "PhotoView",
        entityType: "Chart",
        entityId: chartId,
        details: JSON.stringify({ photoCount: photos.length }),
      },
    });
  }

  return photos;
}

export async function getPhotosForTreatmentCard(cardId: string) {
  const user = await requirePermission("photos", "view");

  const card = await prisma.treatmentCard.findUnique({
    where: { id: cardId },
    select: { chart: { select: { clinicId: true } } },
  });
  if (!card || card.chart.clinicId !== user.clinicId) return [];

  return prisma.photo.findMany({
    where: { treatmentCardId: cardId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}
