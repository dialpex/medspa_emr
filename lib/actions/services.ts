"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export type ServiceItem = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  duration: number;
  price: number;
  isActive: boolean;
  templateIds: string[];
};

export type TemplateOption = {
  id: string;
  name: string;
  type: string;
};

export async function getServicesForClinic(): Promise<ServiceItem[]> {
  const user = await requirePermission("patients", "view");
  const services = await prisma.service.findMany({
    where: { clinicId: user.clinicId },
    orderBy: { name: "asc" },
    include: {
      serviceTemplates: { select: { templateId: true } },
    },
  });
  return services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category,
    duration: s.duration,
    price: s.price,
    isActive: s.isActive,
    templateIds: s.serviceTemplates.map((st) => st.templateId),
  }));
}

export async function getService(id: string): Promise<ServiceItem | null> {
  const user = await requirePermission("patients", "view");
  const s = await prisma.service.findFirst({
    where: { id, clinicId: user.clinicId },
    include: {
      serviceTemplates: { select: { templateId: true } },
    },
  });
  if (!s) return null;
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category,
    duration: s.duration,
    price: s.price,
    isActive: s.isActive,
    templateIds: s.serviceTemplates.map((st) => st.templateId),
  };
}

export async function getTemplateOptions(): Promise<TemplateOption[]> {
  const user = await requirePermission("patients", "view");
  const templates = await prisma.chartTemplate.findMany({
    where: { clinicId: user.clinicId, isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true },
  });
  return templates;
}

type ServiceInput = {
  name: string;
  description?: string;
  category?: string;
  duration: number;
  price: number;
  templateIds?: string[];
};

export async function createService(input: ServiceInput) {
  const user = await requirePermission("patients", "create");
  if (!input.name || input.duration < 1 || input.price < 0) {
    throw new Error("Invalid service data");
  }
  const service = await prisma.service.create({
    data: {
      clinicId: user.clinicId,
      name: input.name,
      description: input.description || null,
      category: input.category || null,
      duration: input.duration,
      price: input.price,
      serviceTemplates: input.templateIds?.length
        ? {
            create: input.templateIds.map((templateId) => ({ templateId })),
          }
        : undefined,
    },
  });
  revalidatePath("/settings/services");
  return service;
}

export async function updateService(id: string, input: ServiceInput) {
  const user = await requirePermission("patients", "create");
  if (!input.name || input.duration < 1 || input.price < 0) {
    throw new Error("Invalid service data");
  }
  // Verify ownership
  const existing = await prisma.service.findFirst({
    where: { id, clinicId: user.clinicId },
  });
  if (!existing) throw new Error("Service not found");

  await prisma.$transaction([
    prisma.service.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description || null,
        category: input.category || null,
        duration: input.duration,
        price: input.price,
      },
    }),
    prisma.serviceTemplate.deleteMany({ where: { serviceId: id } }),
    ...(input.templateIds?.length
      ? [
          prisma.serviceTemplate.createMany({
            data: input.templateIds.map((templateId) => ({
              serviceId: id,
              templateId,
            })),
          }),
        ]
      : []),
  ]);

  revalidatePath("/settings/services");
  revalidatePath(`/settings/services/${id}`);
}

export async function toggleServiceActive(id: string) {
  const user = await requirePermission("patients", "create");
  const existing = await prisma.service.findFirst({
    where: { id, clinicId: user.clinicId },
  });
  if (!existing) throw new Error("Service not found");
  await prisma.service.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });
  revalidatePath("/settings/services");
}
