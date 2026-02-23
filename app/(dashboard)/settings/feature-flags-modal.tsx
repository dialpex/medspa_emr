"use client";

import { useState, useTransition } from "react";
import { XIcon, RotateCcwIcon } from "lucide-react";
import {
  toggleFeatureFlag,
  updateClinicTier,
  type FeatureFlagsData,
  type FeatureFlagStatus,
} from "@/lib/actions/feature-flags";
import type { ClinicTier } from "@prisma/client";

const TIER_OPTIONS: { value: ClinicTier; label: string; description: string }[] = [
  { value: "Standard", label: "Standard", description: "Core features included" },
  { value: "Pro", label: "Pro", description: "All features unlocked" },
];

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
        checked ? "bg-purple-600" : "bg-gray-300"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

export function FeatureFlagsModal({
  data,
  onClose,
}: {
  data: FeatureFlagsData;
  onClose: () => void;
}) {
  const [tier, setTier] = useState<ClinicTier>(data.tier);
  const [flags, setFlags] = useState<FeatureFlagStatus[]>(data.flags);
  const [isPending, startTransition] = useTransition();

  const handleTierChange = (newTier: ClinicTier) => {
    startTransition(async () => {
      const result = await updateClinicTier(newTier);
      if (result.success) {
        setTier(newTier);
        // Reset flags to new tier defaults (overrides cleared server-side)
        setFlags((prev) =>
          prev.map((f) => ({
            ...f,
            tierDefault: newTier === "Pro" ? true : f.tierDefault,
            enabled: newTier === "Pro" ? true : ["ai_chat", "marketing_tools"].includes(f.feature),
            hasOverride: false,
          }))
        );
      }
    });
  };

  const handleToggle = (feature: string, enabled: boolean) => {
    startTransition(async () => {
      const result = await toggleFeatureFlag(feature as FeatureFlagStatus["feature"], enabled);
      if (result.success) {
        setFlags((prev) =>
          prev.map((f) => {
            if (f.feature !== feature) return f;
            return {
              ...f,
              enabled,
              hasOverride: enabled !== f.tierDefault,
            };
          })
        );
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Feature Flags</h2>
            <p className="text-xs text-gray-500 mt-0.5">Manage features for this clinic</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Tier selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Clinic Tier
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TIER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleTierChange(opt.value)}
                  disabled={isPending}
                  className={`flex flex-col items-start rounded-lg border-2 px-3 py-2.5 text-left transition-colors ${
                    tier === opt.value
                      ? "border-purple-600 bg-purple-50"
                      : "border-gray-200 hover:border-gray-300"
                  } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span className={`text-sm font-semibold ${tier === opt.value ? "text-purple-700" : "text-gray-900"}`}>
                    {opt.label}
                  </span>
                  <span className="text-xs text-gray-500">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Feature toggles */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Features
            </label>
            <div className="space-y-1">
              {flags.map((flag) => (
                <div
                  key={flag.feature}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{flag.label}</span>
                      {flag.hasOverride && (
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700">
                          override
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      Tier default: {flag.tierDefault ? "on" : "off"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {flag.hasOverride && (
                      <button
                        onClick={() => handleToggle(flag.feature, flag.tierDefault)}
                        disabled={isPending}
                        title="Reset to tier default"
                        className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <RotateCcwIcon className="size-3.5" />
                      </button>
                    )}
                    <Toggle
                      checked={flag.enabled}
                      onChange={(val) => handleToggle(flag.feature, val)}
                      disabled={isPending}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
