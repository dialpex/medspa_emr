"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeMigration } from "@/lib/actions/migration";
import type { MigrationJobData } from "./migration-wizard";

export function VerifyStep({ job }: { job: MigrationJobData }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isComplete = job.status === "Completed";
  const progressEntries = Object.entries(job.progress);

  async function handleComplete() {
    setLoading(true);
    setError(null);
    try {
      const result = await completeMigration(job.id);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className={`rounded-lg p-4 ${isComplete ? "bg-green-50 border border-green-200" : "bg-blue-50 border border-blue-200"}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{isComplete ? "✓" : "📊"}</span>
          <h4 className={`text-sm font-medium ${isComplete ? "text-green-800" : "text-blue-800"}`}>
            {isComplete ? "Migration Complete!" : "Verification Report"}
          </h4>
        </div>
        {isComplete && job.completedAt && (
          <p className="text-sm text-green-700">
            Completed on {new Date(job.completedAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Results Table */}
      {progressEntries.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Entity</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Source</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Imported</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Skipped</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Failed</th>
              </tr>
            </thead>
            <tbody>
              {progressEntries.map(([type, counts]) => (
                <tr key={type} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{type}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{counts.total}</td>
                  <td className="px-4 py-3 text-right text-green-600 font-medium">{counts.imported}</td>
                  <td className="px-4 py-3 text-right text-yellow-600">{counts.skipped}</td>
                  <td className="px-4 py-3 text-right text-red-600">
                    {counts.failed > 0 ? counts.failed : "—"}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-medium">
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {progressEntries.reduce((s, [, c]) => s + c.total, 0)}
                </td>
                <td className="px-4 py-3 text-right text-green-600">
                  {progressEntries.reduce((s, [, c]) => s + c.imported, 0)}
                </td>
                <td className="px-4 py-3 text-right text-yellow-600">
                  {progressEntries.reduce((s, [, c]) => s + c.skipped, 0)}
                </td>
                <td className="px-4 py-3 text-right text-red-600">
                  {progressEntries.reduce((s, [, c]) => s + c.failed, 0) || "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Agent Log */}
      {job.agentLog && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Migration Log</h4>
          <div className="rounded-lg bg-gray-900 p-4 max-h-48 overflow-y-auto font-mono text-xs text-green-400">
            {job.agentLog.split("\n").map((line, i) => (
              <div key={i} className="whitespace-pre-wrap">{line}</div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>{job.logCount} log entries</span>
        <span>{job.entityMapCount} entity mappings</span>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {!isComplete && (
        <button
          onClick={handleComplete}
          disabled={loading}
          className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {loading ? "Completing..." : "Complete Migration"}
        </button>
      )}
    </div>
  );
}
