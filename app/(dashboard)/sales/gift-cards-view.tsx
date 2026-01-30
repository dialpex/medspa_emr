"use client";

import { Gift } from "lucide-react";

export function GiftCardsView() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <Gift className="size-12 mb-4" />
      <h3 className="text-lg font-medium text-gray-500 mb-1">Gift Cards</h3>
      <p className="text-sm">Coming soon</p>
    </div>
  );
}
