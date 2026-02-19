"use client";

import { useState } from "react";
import { SparklesIcon, AlertTriangleIcon, ClockIcon, ShieldCheckIcon } from "lucide-react";
import type { PreviousTreatmentSummary } from "@/lib/actions/charts";

interface ChartAiContextPanelProps {
  patientAllergies: string | null;
  patientMedicalNotes: string | null;
  previousTreatment: PreviousTreatmentSummary | null;
}

function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-purple-700 bg-purple-100 rounded">
      <SparklesIcon className="size-2.5" />
      AI Assist
    </span>
  );
}

function PanelCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span className="text-xs font-semibold text-gray-700">{title}</span>
        <AiBadge />
      </div>
      <div className="px-3 py-3 text-sm">{children}</div>
    </div>
  );
}

export function ChartAiContextPanel({
  patientAllergies,
  patientMedicalNotes,
  previousTreatment,
}: ChartAiContextPanelProps) {
  const [safetyAcknowledged, setSafetyAcknowledged] = useState(false);

  const hasAllergies = !!patientAllergies;
  const hasMedicalNotes = !!patientMedicalNotes;
  const hasSafetyData = hasAllergies || hasMedicalNotes;

  // Parse allergies
  let allergyList: string[] = [];
  if (patientAllergies) {
    try {
      const parsed = JSON.parse(patientAllergies);
      if (Array.isArray(parsed)) allergyList = parsed.filter(Boolean);
    } catch {
      allergyList = patientAllergies.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }

  return (
    <div className="w-[360px] flex-shrink-0 border-l border-gray-200 bg-gray-50 overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-purple-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
              AI Context Panel
            </span>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-medium text-gray-500 bg-gray-200 rounded-full">
            Beta v0.9
          </span>
        </div>

        {/* 1. Intake Summary */}
        <PanelCard title="Intake Summary">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-gray-600">
              <ClockIcon className="size-3.5" />
              <span className="text-xs font-medium">Previous Treatment</span>
            </div>
            {previousTreatment ? (
              <div className="space-y-1.5">
                <p className="text-xs text-gray-500">
                  {new Date(previousTreatment.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                {previousTreatment.cards.map((card, i) => (
                  <p key={i} className="text-xs text-gray-700">
                    <span className="font-medium">{card.title}</span>
                    {card.details !== "No details" && (
                      <span className="text-gray-500"> — {card.details}</span>
                    )}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">
                No previous treatment on file
              </p>
            )}
          </div>
        </PanelCard>

        {/* 2. Safety Checker */}
        <PanelCard title="Safety Checker">
          {hasSafetyData ? (
            <div className="space-y-3">
              {allergyList.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangleIcon className="size-3.5 text-amber-600" />
                    <span className="text-xs font-medium text-amber-700">
                      Known Allergies
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {allergyList.map((allergy) => (
                      <span
                        key={allergy}
                        className="px-2 py-0.5 text-[11px] font-medium text-red-700 bg-red-100 rounded-full"
                      >
                        {allergy}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {hasMedicalNotes && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheckIcon className="size-3.5 text-blue-600" />
                    <span className="text-xs font-medium text-blue-700">
                      Medical Notes
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{patientMedicalNotes}</p>
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={safetyAcknowledged}
                  onChange={(e) => setSafetyAcknowledged(e.target.checked)}
                  className="size-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-xs text-gray-600">
                  Acknowledge Alert
                </span>
              </label>
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">
              No allergies or medical notes on file
            </p>
          )}
        </PanelCard>
      </div>
    </div>
  );
}
