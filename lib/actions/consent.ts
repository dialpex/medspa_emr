"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

/**
 * Get active consent templates for the current user's clinic.
 */
export async function getConsentTemplatesForClinic() {
  const user = await requirePermission("consents", "view");

  return prisma.consentTemplate.findMany({
    where: {
      clinicId: user.clinicId,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });
}
