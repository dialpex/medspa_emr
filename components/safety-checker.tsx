"use client";

import { SparklesIcon } from "lucide-react";

interface SafetyCheckerProps {
  allergies: string | null;
  medicalNotes: string | null;
}

export function SafetyChecker({ allergies, medicalNotes }: SafetyCheckerProps) {
  if (!allergies && !medicalNotes) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-1.5">
      <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
        <SparklesIcon className="size-4" />
        Safety Context
      </div>
      {allergies && (
        <p className="text-sm text-amber-700">
          <span className="font-medium">Allergies:</span> {allergies}
        </p>
      )}
      {medicalNotes && (
        <p className="text-sm text-amber-700">
          <span className="font-medium">Medical notes:</span> {medicalNotes}
        </p>
      )}
    </div>
  );
}
