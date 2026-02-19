"use server";

import { prisma } from "@/lib/prisma";

/**
 * Get active consent templates for a clinic.
 */
export async function getConsentTemplatesForClinic(clinicId: string) {
  return prisma.consentTemplate.findMany({
    where: {
      clinicId,
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
