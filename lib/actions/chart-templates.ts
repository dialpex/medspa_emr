"use server";

import { prisma } from "@/lib/prisma";
import {
  requirePermission,
  enforceTenantIsolation,
  AuthorizationError,
} from "@/lib/rbac";
import type { TemplateFieldConfig } from "@/lib/types/charts";

export interface TemplateInput {
  type?: string;
  name: string;
  description?: string;
  category?: string;
  fieldsConfig: TemplateFieldConfig[];
  isActive?: boolean;
}

export async function getTemplates() {
  const user = await requirePermission("charts", "view");

  return prisma.chartTemplate.findMany({
    where: {
      clinicId: user.clinicId,
      isActive: true,
      deletedAt: null,
    },
    orderBy: { name: "asc" },
  });
}

export async function getAllTemplates() {
  const user = await requirePermission("charts", "view");

  return prisma.chartTemplate.findMany({
    where: {
      clinicId: user.clinicId,
      deletedAt: null,
    },
    orderBy: { name: "asc" },
  });
}

export async function getTemplate(id: string) {
  const user = await requirePermission("charts", "view");

  const template = await prisma.chartTemplate.findUnique({
    where: { id },
  });

  if (!template) return null;
  enforceTenantIsolation(user, template.clinicId);

  return template;
}

export async function createTemplate(input: TemplateInput) {
  try {
    const user = await requirePermission("charts", "create");

    const template = await prisma.chartTemplate.create({
      data: {
        clinicId: user.clinicId,
        type: input.type ?? "chart",
        name: input.name,
        description: input.description,
        category: input.category,
        fieldsConfig: JSON.stringify(input.fieldsConfig),
        isActive: input.isActive ?? true,
      },
    });

    return { success: true as const, data: template };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false as const, error: error.message };
    }
    throw error;
  }
}

export async function updateTemplate(id: string, input: Partial<TemplateInput>) {
  try {
    const user = await requirePermission("charts", "edit");

    const existing = await prisma.chartTemplate.findUnique({ where: { id } });
    if (!existing) return { success: false as const, error: "Template not found" };
    enforceTenantIsolation(user, existing.clinicId);

    const template = await prisma.chartTemplate.update({
      where: { id },
      data: {
        ...(input.type !== undefined && { type: input.type }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.fieldsConfig !== undefined && {
          fieldsConfig: JSON.stringify(input.fieldsConfig),
        }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    return { success: true as const, data: template };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false as const, error: error.message };
    }
    throw error;
  }
}

export async function deleteTemplate(id: string) {
  try {
    const user = await requirePermission("charts", "delete");

    const existing = await prisma.chartTemplate.findUnique({ where: { id } });
    if (!existing) return { success: false as const, error: "Template not found" };
    enforceTenantIsolation(user, existing.clinicId);

    if (existing.isSystem) {
      return { success: false as const, error: "Cannot delete system templates" };
    }

    await prisma.chartTemplate.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false as const, error: error.message };
    }
    throw error;
  }
}
