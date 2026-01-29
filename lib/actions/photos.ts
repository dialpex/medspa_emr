"use server";

import { prisma } from "@/lib/prisma";
import {
  requirePermission,
  enforceTenantIsolation,
  AuthorizationError,
} from "@/lib/rbac";

export async function createPhotoRecord(data: {
  patientId: string;
  chartId?: string;
  filename: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  category?: string;
  caption?: string;
}) {
  try {
    const user = await requirePermission("photos", "create");

    const photo = await prisma.photo.create({
      data: {
        clinicId: user.clinicId,
        patientId: data.patientId,
        chartId: data.chartId,
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

    const photo = await prisma.photo.findUnique({ where: { id } });
    if (!photo) return { success: false as const, error: "Photo not found" };
    enforceTenantIsolation(user, photo.clinicId);

    await prisma.photo.update({
      where: { id },
      data: { annotations },
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

    const photo = await prisma.photo.findUnique({ where: { id } });
    if (!photo) return { success: false as const, error: "Photo not found" };
    enforceTenantIsolation(user, photo.clinicId);

    await prisma.photo.update({
      where: { id },
      data: { deletedAt: new Date() },
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

  const chart = await prisma.chart.findUnique({ where: { id: chartId } });
  if (!chart) return [];
  enforceTenantIsolation(user, chart.clinicId);

  return prisma.photo.findMany({
    where: { chartId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}
