"use client";

import { Package } from "lucide-react";
import type { PackageMatch } from "@/lib/services/packages";
import type { CheckoutLineItem } from "@/lib/services/checkout-shared";

type Props = {
  items: CheckoutLineItem[];
  packageMatches: PackageMatch[];
  redeemedItems: Set<string>;
  onToggle: (itemId: string, match: PackageMatch) => void;
  disabled?: boolean;
};

export function PackageCreditSection({ items, packageMatches, redeemedItems, onToggle, disabled }: Props) {
  // Only show items that have matching packages
  const matchableItems = items.filter(
    (item) =>
      item.serviceId &&
      packageMatches.some((m) => m.serviceId === item.serviceId)
  );

  if (matchableItems.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
        Package Credits
      </h3>
      <div className="space-y-2">
        {matchableItems.map((item) => {
          const match = packageMatches.find((m) => m.serviceId === item.serviceId);
          if (!match) return null;
          const isRedeemed = redeemedItems.has(item.id);

          return (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Package className="size-4 text-purple-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {item.description}
                  </p>
                  <p className="text-xs text-gray-500">
                    &ldquo;{match.packageName}&rdquo; &middot; {match.remainingQuantity}/{match.totalQuantity} left
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-gray-500">Use credit</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isRedeemed}
                  disabled={disabled}
                  onClick={() => onToggle(item.id, match)}
                  className={`
                    relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent
                    transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
                    ${isRedeemed ? "bg-purple-600" : "bg-gray-200"}
                    ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                  `}
                >
                  <span
                    className={`
                      pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform
                      transition duration-200 ease-in-out
                      ${isRedeemed ? "translate-x-4" : "translate-x-0"}
                    `}
                  />
                </button>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
