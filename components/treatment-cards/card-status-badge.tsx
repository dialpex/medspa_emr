"use client";

import { CheckCircleIcon, AlertTriangleIcon, AlertCircleIcon } from "lucide-react";
import type { CardStatus } from "@/lib/templates/validation";

interface CardStatusBadgeProps {
  status: CardStatus;
  missingFields?: string[];
}

export function CardStatusBadge({ status, missingFields }: CardStatusBadgeProps) {
  if (status === "Complete") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full">
        <CheckCircleIcon className="size-3" />
        Complete
      </span>
    );
  }

  if (status === "MissingHighRisk") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700 rounded-full"
        title={missingFields?.length ? `Missing: ${missingFields.join(", ")}` : undefined}
      >
        <AlertCircleIcon className="size-3" />
        High-risk incomplete
      </span>
    );
  }

  // "Missing" — non-critical
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-full"
      title={missingFields?.length ? `Missing: ${missingFields.join(", ")}` : undefined}
    >
      <AlertTriangleIcon className="size-3" />
      Missing info
    </span>
  );
}
