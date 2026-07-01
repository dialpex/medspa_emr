"use client";

import { CreditCard, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SavedCard } from "@/lib/services/checkout-shared";

type Props = {
  cards: SavedCard[];
  selectedId: string | "new";
  onSelect: (id: string | "new") => void;
};

const BRAND_COLORS: Record<string, string> = {
  visa: "text-blue-700",
  mastercard: "text-orange-600",
  amex: "text-blue-500",
  discover: "text-orange-500",
};

export function SavedCardSelector({ cards, selectedId, onSelect }: Props) {
  return (
    <div className="space-y-2">
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => onSelect(card.id)}
          className={cn(
            "w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
            selectedId === card.id
              ? "bg-purple-50 border-purple-200 ring-1 ring-purple-200"
              : "bg-white border-gray-200 hover:bg-gray-50"
          )}
        >
          <CreditCard
            className={cn(
              "size-5 flex-shrink-0",
              BRAND_COLORS[card.cardBrand?.toLowerCase() ?? ""] ?? "text-gray-400"
            )}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">
                **** {card.cardLast4}
              </span>
              <span className="text-xs text-gray-500 capitalize">
                {card.cardBrand || "Card"}
              </span>
              {card.isDefault && (
                <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                  Default
                </span>
              )}
            </div>
            {card.cardExpMonth && card.cardExpYear && (
              <span className="text-xs text-gray-400">
                {String(card.cardExpMonth).padStart(2, "0")}/{String(card.cardExpYear).slice(-2)}
              </span>
            )}
          </div>
          <div
            className={cn(
              "size-4 rounded-full border-2 flex-shrink-0",
              selectedId === card.id
                ? "border-purple-600 bg-purple-600"
                : "border-gray-300"
            )}
          >
            {selectedId === card.id && (
              <div className="size-full rounded-full flex items-center justify-center">
                <div className="size-1.5 rounded-full bg-white" />
              </div>
            )}
          </div>
        </button>
      ))}

      {/* Add new card */}
      <button
        type="button"
        onClick={() => onSelect("new")}
        className={cn(
          "w-full flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-left transition-colors",
          selectedId === "new"
            ? "bg-purple-50 border-purple-300 ring-1 ring-purple-200"
            : "bg-white border-gray-300 hover:bg-gray-50"
        )}
      >
        <Plus className="size-5 text-gray-400 flex-shrink-0" />
        <span className="text-sm text-gray-600">Add new card</span>
        <div className="flex-1" />
        <div
          className={cn(
            "size-4 rounded-full border-2 flex-shrink-0",
            selectedId === "new"
              ? "border-purple-600 bg-purple-600"
              : "border-gray-300"
          )}
        >
          {selectedId === "new" && (
            <div className="size-full rounded-full flex items-center justify-center">
              <div className="size-1.5 rounded-full bg-white" />
            </div>
          )}
        </div>
      </button>
    </div>
  );
}
