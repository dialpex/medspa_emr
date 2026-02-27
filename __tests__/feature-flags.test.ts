import { describe, it, expect } from "vitest";
import {
  getTierDefault,
  FEATURES,
  FEATURE_LABELS,
  FeatureNotAvailableError,
  type FeatureFlag,
  type FeatureFlagProvider,
} from "../lib/feature-flags-core";

describe("getTierDefault", () => {
  it("Standard tier: Pro-only features are off", () => {
    expect(getTierDefault("Standard", "sms_messaging")).toBe(false);
    expect(getTierDefault("Standard", "notification_automation")).toBe(false);
    expect(getTierDefault("Standard", "ai_voice_draft")).toBe(false);
    expect(getTierDefault("Standard", "e_prescribe")).toBe(false);
    expect(getTierDefault("Standard", "lab_results")).toBe(false);
  });

  it("Standard tier: all-tier features are on", () => {
    expect(getTierDefault("Standard", "ai_chat")).toBe(true);
    expect(getTierDefault("Standard", "marketing_tools")).toBe(true);
  });

  it("Pro tier: all features are on", () => {
    for (const feature of FEATURES) {
      expect(getTierDefault("Pro", feature)).toBe(true);
    }
  });
});

describe("FEATURE_LABELS", () => {
  it("every feature has a label", () => {
    for (const feature of FEATURES) {
      expect(FEATURE_LABELS[feature]).toBeDefined();
      expect(typeof FEATURE_LABELS[feature]).toBe("string");
    }
  });
});

describe("FeatureNotAvailableError", () => {
  it("has correct name and feature property", () => {
    const error = new FeatureNotAvailableError("sms_messaging");
    expect(error.name).toBe("FeatureNotAvailableError");
    expect(error.feature).toBe("sms_messaging");
    expect(error.message).toContain("SMS Messaging");
    expect(error.message).toContain("not available");
  });

  it("is an instance of Error", () => {
    const error = new FeatureNotAvailableError("ai_chat");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("FeatureFlagProvider interface", () => {
  it("mock provider can override tier defaults", async () => {
    const overrides: Record<string, boolean> = {
      sms_messaging: true, // force-enable a Pro feature for Standard
    };

    const mockProvider: FeatureFlagProvider = {
      async isEnabled(feature, context) {
        if (feature in overrides) return overrides[feature];
        return getTierDefault(context.tier, feature);
      },
    };

    // Standard tier but with override
    expect(
      await mockProvider.isEnabled("sms_messaging", {
        clinicId: "test",
        tier: "Standard",
      })
    ).toBe(true);

    // No override — falls back to tier default
    expect(
      await mockProvider.isEnabled("notification_automation", {
        clinicId: "test",
        tier: "Standard",
      })
    ).toBe(false);

    // Pro tier, no override needed
    expect(
      await mockProvider.isEnabled("ai_voice_draft", {
        clinicId: "test",
        tier: "Pro",
      })
    ).toBe(true);
  });
});
