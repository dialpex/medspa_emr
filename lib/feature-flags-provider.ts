import type { ClinicTier } from "@prisma/client";
import { prisma } from "./prisma";
import {
  getTierDefault,
  type FeatureFlag,
  type FeatureFlagProvider,
} from "./feature-flags-core";

class PrismaFeatureFlagProvider implements FeatureFlagProvider {
  async isEnabled(
    feature: FeatureFlag,
    context: { clinicId: string; tier: ClinicTier }
  ): Promise<boolean> {
    // Check for per-clinic override first
    const override = await prisma.clinicFeatureOverride.findUnique({
      where: { clinicId_feature: { clinicId: context.clinicId, feature } },
      select: { enabled: true },
    });

    if (override !== null) {
      return override.enabled;
    }

    // Fall back to tier default
    return getTierDefault(context.tier, feature);
  }
}

// Singleton with swap support for testing / future provider migration
let provider: FeatureFlagProvider = new PrismaFeatureFlagProvider();

export function getFeatureFlagProvider(): FeatureFlagProvider {
  return provider;
}

export function setFeatureFlagProvider(p: FeatureFlagProvider): void {
  provider = p;
}
