import { FEATURE_LABELS, type FeatureFlag } from "@/lib/feature-flags-core";
import { Lock } from "lucide-react";

export function FeatureGate({ feature }: { feature: FeatureFlag }) {
  const label = FEATURE_LABELS[feature];

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
          <Lock className="h-8 w-8 text-purple-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">
          {label} is not available on your plan
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Upgrade to the Pro plan to unlock {label} and other premium features.
        </p>
        <a
          href="/settings"
          className="mt-6 inline-flex items-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
        >
          View Plans
        </a>
      </div>
    </div>
  );
}
