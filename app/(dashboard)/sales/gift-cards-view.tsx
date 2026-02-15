"use client";

import { Gift } from "lucide-react";
import { PageCard } from "@/components/ui/page-card";

export function GiftCardsView() {
  return (
    <PageCard title="Gift Cards">
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Gift className="size-12 mb-4" />
        <p className="text-sm">Coming soon</p>
      </div>
    </PageCard>
  );
}
