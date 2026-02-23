"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { FEATURES, FEATURE_LABELS, getTierDefault } from "@/lib/feature-flags-core";
import type { FeatureFlag } from "@/lib/feature-flags-core";
import type { ClinicTier } from "@prisma/client";

export type FeatureFlagStatus = {
  feature: FeatureFlag;
  label: string;
  enabled: boolean;
  tierDefault: boolean;
  hasOverride: boolean;
};

export type FeatureFlagsData = {
  tier: ClinicTier;
  flags: FeatureFlagStatus[];
};

export type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function getFeatureFlagsAdmin(): Promise<FeatureFlagsData> {
  const user = await requirePermission("users", "edit"); // Owner/Admin only

  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: user.clinicId },
    select: { tier: true },
  });

  const overrides = await prisma.clinicFeatureOverride.findMany({
    where: { clinicId: user.clinicId },
  });

  const overrideMap = new Map(overrides.map((o) => [o.feature, o.enabled]));

  const flags: FeatureFlagStatus[] = FEATURES.map((feature) => {
    const tierDefault = getTierDefault(clinic.tier, feature);
    const override = overrideMap.get(feature);
    return {
      feature,
      label: FEATURE_LABELS[feature],
      enabled: override !== undefined ? override : tierDefault,
      tierDefault,
      hasOverride: override !== undefined,
    };
  });

  return { tier: clinic.tier, flags };
}

export async function toggleFeatureFlag(
  feature: FeatureFlag,
  enabled: boolean
): Promise<ActionResult> {
  const user = await requirePermission("users", "edit");

  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: user.clinicId },
    select: { tier: true },
  });

  const tierDefault = getTierDefault(clinic.tier, feature);

  if (enabled === tierDefault) {
    // Remove override — matches tier default
    await prisma.clinicFeatureOverride.deleteMany({
      where: { clinicId: user.clinicId, feature },
    });
  } else {
    // Upsert override
    await prisma.clinicFeatureOverride.upsert({
      where: { clinicId_feature: { clinicId: user.clinicId, feature } },
      create: { clinicId: user.clinicId, feature, enabled },
      update: { enabled },
    });
  }

  revalidatePath("/settings");
  revalidatePath("/");
  return { success: true };
}

export async function updateClinicTier(
  tier: ClinicTier
): Promise<ActionResult> {
  const user = await requirePermission("users", "edit");

  await prisma.clinic.update({
    where: { id: user.clinicId },
    data: { tier },
  });

  // Clear all overrides when tier changes — start fresh with new defaults
  await prisma.clinicFeatureOverride.deleteMany({
    where: { clinicId: user.clinicId },
  });

  revalidatePath("/settings");
  revalidatePath("/");
  return { success: true };
}
