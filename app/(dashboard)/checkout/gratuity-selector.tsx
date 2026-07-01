"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  preDiscountSubtotal: number;
  discountAmount: number;
  value: number;
  onChange: (amount: number) => void;
};

const PRESETS = [
  { label: "No tip", pct: 0 },
  { label: "15%", pct: 15 },
  { label: "18%", pct: 18 },
  { label: "20%", pct: 20 },
];

export function GratuitySelector({ preDiscountSubtotal, discountAmount, value, onChange }: Props) {
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const gratuityBase = Math.max(0, preDiscountSubtotal - discountAmount);

  function getPresetAmount(pct: number): number {
    return Math.round(gratuityBase * (pct / 100) * 100) / 100;
  }

  function isPresetActive(pct: number): boolean {
    if (pct === 0) return value === 0 && !showCustom;
    return Math.abs(value - getPresetAmount(pct)) < 0.01;
  }

  function handlePreset(pct: number) {
    setShowCustom(false);
    onChange(getPresetAmount(pct));
  }

  function handleCustomSubmit() {
    const parsed = parseFloat(customValue);
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(Math.round(parsed * 100) / 100);
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-2.5">
        Add a gratuity?
      </h3>
      <div className="flex items-center gap-2 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.pct}
            type="button"
            onClick={() => handlePreset(p.pct)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
              isPresetActive(p.pct)
                ? "bg-purple-600 text-white shadow-md shadow-purple-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setShowCustom(true);
            setCustomValue(value > 0 ? value.toFixed(2) : "");
          }}
          className={cn(
            "rounded-full p-2 transition-all duration-200",
            showCustom
              ? "bg-purple-600 text-white shadow-md shadow-purple-200"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>

      {/* Custom input */}
      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          showCustom ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">$</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onBlur={handleCustomSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
              placeholder="0.00"
              className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
              autoFocus={showCustom}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
