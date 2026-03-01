"use client";

import Link from "next/link";
import { FileTextIcon } from "lucide-react";

type PatientChart = {
  id: string;
  status: string;
  chiefComplaint: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { name: string } | null;
  template: { name: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  NeedsSignOff: "bg-amber-50 text-amber-700",
  MDSigned: "bg-green-50 text-green-700",
};

const STATUS_LABELS: Record<string, string> = {
  Draft: "Draft",
  NeedsSignOff: "Needs Sign-off",
  MDSigned: "Signed",
};

export function PatientCharts({ charts }: { charts: PatientChart[] }) {
  if (charts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileTextIcon className="size-8 mx-auto mb-2 text-gray-300" />
        No charts yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {charts.map((chart) => (
        <Link
          key={chart.id}
          href={chart.status === "Draft" ? `/charts/${chart.id}/edit` : `/charts/${chart.id}`}
          className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-900">
                {chart.chiefComplaint ?? "No chief complaint"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {chart.createdBy?.name ?? "Unknown"}
                {chart.template && ` · ${chart.template.name}`}
                {" · "}
                {new Date(chart.updatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLES[chart.status]}`}>
              {STATUS_LABELS[chart.status] ?? chart.status}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
