"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  resolveDecision,
  approveMappingAndStart,
} from "@/lib/actions/migration";
import type { MigrationJobData } from "./migration-wizard";

interface MappingEntry {
  sourceId: string;
  sourceName: string;
  action: string;
  confidence: number;
  reasoning: string;
  targetId: string | null;
  targetName: string | null;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color =
    confidence >= 0.8
      ? "bg-green-100 text-green-700"
      : confidence >= 0.5
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {Math.round(confidence * 100)}%
    </span>
  );
}

function ActionBadge({ action }: { action: string }) {
  const styles: Record<string, string> = {
    map_existing: "bg-blue-100 text-blue-700",
    create_new: "bg-green-100 text-green-700",
    skip: "bg-gray-100 text-gray-700",
    needs_input: "bg-purple-100 text-purple-700",
  };
  const labels: Record<string, string> = {
    map_existing: "Map to Existing",
    create_new: "Create New",
    skip: "Skip",
    needs_input: "Needs Input",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[action] || "bg-gray-100 text-gray-700"}`}>
      {labels[action] || action}
    </span>
  );
}

export function MappingStep({ job }: { job: MigrationJobData }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandAutoResolved, setExpandAutoResolved] = useState(false);

  const mappingConfig = job.mappingConfig as { mappings: MappingEntry[] } | null;
  const pendingDecisions = job.pendingDecisions as MappingEntry[] | null;

  const autoResolved = mappingConfig?.mappings ?? [];
  const pending = pendingDecisions ?? [];

  const isMapping = job.status === "MappingInProgress";

  async function handleResolve(
    sourceId: string,
    action: "map_existing" | "create_new" | "skip",
    targetId?: string,
    targetName?: string
  ) {
    setLoading(true);
    try {
      const result = await resolveDecision(job.id, sourceId, action, targetId, targetName);
      if (!result.success) {
        setError(result.error);
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveAndStart() {
    setLoading(true);
    setError(null);
    try {
      const result = await approveMappingAndStart(job.id);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    } finally {
      setLoading(false);
    }
  }

  if (isMapping) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-purple-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-sm text-gray-500">AI is analyzing service mappings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Decisions */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-purple-700">
            {pending.length} decision{pending.length !== 1 ? "s" : ""} need your input
          </h4>
          {pending.map((decision) => (
            <div
              key={decision.sourceId}
              className="rounded-lg border border-purple-200 bg-purple-50 p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="font-medium text-gray-900">{decision.sourceName}</span>
                  <ConfidenceBadge confidence={decision.confidence} />
                </div>
                <ActionBadge action={decision.action} />
              </div>
              <p className="text-sm text-gray-600 mb-3">{decision.reasoning}</p>
              <div className="flex gap-2">
                {decision.targetId && (
                  <button
                    onClick={() =>
                      handleResolve(
                        decision.sourceId,
                        "map_existing",
                        decision.targetId!,
                        decision.targetName!
                      )
                    }
                    disabled={loading}
                    className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  >
                    Map to &ldquo;{decision.targetName}&rdquo;
                  </button>
                )}
                <button
                  onClick={() => handleResolve(decision.sourceId, "create_new")}
                  disabled={loading}
                  className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                >
                  Create New
                </button>
                <button
                  onClick={() => handleResolve(decision.sourceId, "skip")}
                  disabled={loading}
                  className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  Skip
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Auto-Resolved Mappings */}
      {autoResolved.length > 0 && (
        <div>
          <button
            onClick={() => setExpandAutoResolved(!expandAutoResolved)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <span className={`transition-transform ${expandAutoResolved ? "rotate-90" : ""}`}>
              &#9654;
            </span>
            {autoResolved.length} auto-resolved mappings
          </button>
          {expandAutoResolved && (
            <div className="mt-3 space-y-2">
              {autoResolved.map((mapping) => (
                <div
                  key={mapping.sourceId}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
                >
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">
                      {mapping.sourceName}
                    </span>
                    {mapping.targetName && (
                      <span className="text-sm text-gray-500">
                        {" "}
                        → {mapping.targetName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <ConfidenceBadge confidence={mapping.confidence} />
                    <ActionBadge action={mapping.action} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleApproveAndStart}
        disabled={loading || pending.length > 0}
        className="rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading
          ? "Starting..."
          : pending.length > 0
            ? `Resolve ${pending.length} decision${pending.length !== 1 ? "s" : ""} to continue`
            : "Approve & Start Migration"}
      </button>
    </div>
  );
}
