"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getMappingProposal } from "@/lib/actions/migration";
import type { MigrationJobData } from "./migration-wizard";
import type { DiscoveryResponse } from "@/lib/migration/agent-schemas";

export function DiscoverStep({ job }: { job: MigrationJobData }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discovery = job.sourceDiscovery as DiscoveryResponse | null;
  const isDiscovering = job.status === "Discovering";

  async function handleContinue() {
    setLoading(true);
    setError(null);
    try {
      const result = await getMappingProposal(job.id);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    } finally {
      setLoading(false);
    }
  }

  if (isDiscovering) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-purple-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-sm text-gray-500">AI is exploring your source data...</p>
      </div>
    );
  }

  if (!discovery) return null;

  return (
    <div className="space-y-6">
      {/* AI Summary */}
      <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-sm">
            AI
          </div>
          <div className="flex-1">
            <p className="text-sm text-purple-900">{discovery.summary}</p>
          </div>
        </div>
      </div>

      {/* Entity Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {discovery.entities.map((entity) => (
          <div
            key={entity.type}
            className="rounded-lg border border-gray-200 bg-white p-4 text-center"
          >
            <div className="text-2xl font-bold text-gray-900">{entity.count}</div>
            <div className="text-sm text-gray-500">{entity.type}s</div>
            {entity.sampleNames.length > 0 && (
              <div className="mt-2 text-xs text-gray-400 truncate">
                {entity.sampleNames.slice(0, 2).join(", ")}
                {entity.sampleNames.length > 2 && "..."}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Data Quality Issues */}
      {discovery.issues.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Data Quality Issues</h4>
          {discovery.issues.map((issue, i) => (
            <div
              key={i}
              className={`rounded-lg p-3 text-sm ${
                issue.severity === "error"
                  ? "bg-red-50 border border-red-200 text-red-800"
                  : issue.severity === "warning"
                    ? "bg-amber-50 border border-amber-200 text-amber-800"
                    : "bg-blue-50 border border-blue-200 text-blue-800"
              }`}
            >
              <span className="font-medium">{issue.entityType}:</span> {issue.description}
              <span className="text-xs ml-1">({issue.count})</span>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {discovery.recommendations.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-gray-700">Recommendations</h4>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            {discovery.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleContinue}
        disabled={loading}
        className="rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
      >
        {loading ? "Generating mappings..." : "Continue to Mapping"}
      </button>
    </div>
  );
}
