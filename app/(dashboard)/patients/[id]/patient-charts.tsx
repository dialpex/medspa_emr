"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FileTextIcon, Trash2 } from "lucide-react";
import { deleteChart } from "@/lib/actions/charts";

type PatientChart = {
  id: string;
  status: string;
  chiefComplaint: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string | null;
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

type Props = {
  charts: PatientChart[];
  userId: string;
  canDeleteAny: boolean;
};

export function PatientCharts({ charts, userId, canDeleteAny }: Props) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function canDelete(chart: PatientChart) {
    if (chart.status !== "Draft") return false;
    return canDeleteAny || chart.createdById === userId;
  }

  function handleDelete(chartId: string) {
    startTransition(async () => {
      const result = await deleteChart(chartId);
      if (!result.success) {
        alert(result.error);
      }
      setConfirmDeleteId(null);
    });
  }

  if (charts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileTextIcon className="size-8 mx-auto mb-2 text-gray-300" />
        No charts yet.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {charts.map((chart) => (
          <div key={chart.id} className="relative">
            <Link
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
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLES[chart.status]}`}>
                    {STATUS_LABELS[chart.status] ?? chart.status}
                  </span>
                  {canDelete(chart) && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setConfirmDeleteId(chart.id);
                      }}
                      className="rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete draft"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete draft chart?</h3>
            <p className="text-sm text-gray-500 mb-5">
              This will permanently delete this draft chart and any associated photos. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
