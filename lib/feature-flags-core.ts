import type { ClinicTier } from "@prisma/client";

// All feature flags — add new flags here
export const FEATURES = [
  "sms_messaging",
  "notification_automation",
  "ai_voice_draft",
  "ai_chat",
  "marketing_tools",
  "e_prescribe",
  "lab_results",
  "data_migration",
] as const;

export type FeatureFlag = (typeof FEATURES)[number];

// Default feature availability per tier
const TIER_FEATURES: Record<ClinicTier, Record<FeatureFlag, boolean>> = {
  Standard: {
    sms_messaging: false,
    notification_automation: false,
    ai_voice_draft: false,
    ai_chat: true,
    marketing_tools: true,
    e_prescribe: false,
    lab_results: false,
    data_migration: true,
  },
  Pro: {
    sms_messaging: true,
    notification_automation: true,
    ai_voice_draft: true,
    ai_chat: true,
    marketing_tools: true,
    e_prescribe: true,
    lab_results: true,
    data_migration: true,
  },
};

// UI display names for each feature
export const FEATURE_LABELS: Record<FeatureFlag, string> = {
  sms_messaging: "SMS Messaging",
  notification_automation: "Notification Automation",
  ai_voice_draft: "AI Voice Draft",
  ai_chat: "AI Chat Copilot",
  marketing_tools: "Marketing Tools",
  e_prescribe: "E-Prescribe",
  lab_results: "Lab Results",
  data_migration: "Data Migration",
};

/** Get the tier default for a feature */
export function getTierDefault(tier: ClinicTier, feature: FeatureFlag): boolean {
  return TIER_FEATURES[tier]?.[feature] ?? false;
}

/** Provider interface — swap implementation to migrate to LaunchDarkly/Flagsmith */
export interface FeatureFlagProvider {
  isEnabled(
    feature: FeatureFlag,
    context: { clinicId: string; tier: ClinicTier }
  ): Promise<boolean>;
}

export class FeatureNotAvailableError extends Error {
  public readonly feature: FeatureFlag;

  constructor(feature: FeatureFlag) {
    super(
      `${FEATURE_LABELS[feature]} is not available on your current plan.`
    );
    this.name = "FeatureNotAvailableError";
    this.feature = feature;
  }
}
