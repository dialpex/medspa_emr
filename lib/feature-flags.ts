// Re-export types from core (no Next.js deps)
export {
  FEATURES,
  FEATURE_LABELS,
  getTierDefault,
  FeatureNotAvailableError,
  type FeatureFlag,
  type FeatureFlagProvider,
} from "./feature-flags-core";

import { auth } from "./auth";
import { prisma } from "./prisma";
import { FEATURES, FeatureNotAvailableError, type FeatureFlag } from "./feature-flags-core";
import { getFeatureFlagProvider } from "./feature-flags-provider";

async function getClinicContext() {
  const session = await auth();
  if (!session?.user?.clinicId) {
    throw new Error("Authentication required");
  }

  const clinic = await prisma.clinic.findUnique({
    where: { id: session.user.clinicId },
    select: { id: true, tier: true },
  });

  if (!clinic) {
    // Stale session — clinic was deleted (e.g. after DB reseed).
    // Return Standard tier defaults so pages render instead of crashing.
    return { clinicId: session.user.clinicId, tier: "Standard" as const };
  }

  return { clinicId: clinic.id, tier: clinic.tier };
}

/** Check if a feature is enabled for the current session's clinic */
export async function isFeatureEnabled(feature: FeatureFlag): Promise<boolean> {
  const context = await getClinicContext();
  const provider = getFeatureFlagProvider();
  return provider.isEnabled(feature, context);
}

/** Throw FeatureNotAvailableError if feature is disabled. Use in server actions / API routes. */
export async function requireFeature(feature: FeatureFlag): Promise<void> {
  const enabled = await isFeatureEnabled(feature);
  if (!enabled) {
    throw new FeatureNotAvailableError(feature);
  }
}

/** Get all enabled features for the current session's clinic. Used by layout → sidebar. */
export async function getEnabledFeatures(): Promise<FeatureFlag[]> {
  const context = await getClinicContext();
  const provider = getFeatureFlagProvider();

  const results = await Promise.all(
    FEATURES.map(async (f) => ({
      feature: f,
      enabled: await provider.isEnabled(f, context),
    }))
  );

  return results.filter((r) => r.enabled).map((r) => r.feature);
}
