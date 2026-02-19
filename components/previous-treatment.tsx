"use client";

import { ClockIcon } from "lucide-react";
import type { PreviousTreatmentSummary } from "@/lib/actions/charts";

interface PreviousTreatmentProps {
  data: PreviousTreatmentSummary | null;
}

export function PreviousTreatment({ data }: PreviousTreatmentProps) {
  if (!data) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
        <p className="text-xs text-gray-400">No previous treatments on file</p>
      </div>
    );
  }

  const formattedDate = new Date(data.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 text-gray-700 font-medium text-sm">
        <ClockIcon className="size-4" />
        Previous Treatment — {formattedDate}
      </div>
      <div className="space-y-1">
        {data.cards.map((card, i) => (
          <p key={i} className="text-sm text-gray-600">
            <span className="font-medium">{card.title}</span>
            {card.details !== "No details" && (
              <span className="text-gray-500"> — {card.details}</span>
            )}
          </p>
        ))}
      </div>
    </div>
  );
}
