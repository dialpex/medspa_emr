"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getMigrationStatus,
  pauseMigration,
  resumeMigration,
} from "@/lib/actions/migration";
import type { MigrationJobData } from "./migration-wizard";

function ProgressBar({
  label,
  total,
  imported,
  skipped,
  failed,
}: {
  label: string;
  total: number;
  imported: number;
  skipped: number;
  failed: number;
}) {
  const processed = imported + skipped + failed;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">
          {processed}/{total} ({pct}%)
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full flex">
          {total > 0 && (
            <>
              <div
                className="bg-green-500 transition-all duration-300"
                style={{ width: `${(imported / total) * 100}%` }}
              />
              <div
                className="bg-yellow-400 transition-all duration-300"
                style={{ width: `${(skipped / total) * 100}%` }}
              />
              <div
                className="bg-red-400 transition-all duration-300"
                style={{ width: `${(failed / total) * 100}%` }}
              />
            </>
          )}
        </div>
      </div>
      <div className="flex gap-3 text-xs text-gray-500">
        <span className="text-green-600">{imported} imported</span>
        <span className="text-yellow-600">{skipped} skipped</span>
        {failed > 0 && <span className="text-red-600">{failed} failed</span>}
      </div>
    </div>
  );
}

export function ProgressStep({ job: initialJob }: { job: MigrationJobData }) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob);
  const [loading, setLoading] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const isPaused = job.status === "Paused";

  // Poll for status updates every 3 seconds
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(async () => {
      const updated = await getMigrationStatus(job.id);
      if (updated) {
        setJob(updated);
        // If status changed to Verifying, refresh the page to show verify step
        if (updated.status === "Verifying" || updated.status === "Completed" || updated.status === "Failed") {
          router.refresh();
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [job.id, isPaused, router]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [job.agentLog]);

  async function handlePause() {
    setLoading(true);
    try {
      await pauseMigration(job.id);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleResume() {
    setLoading(true);
    try {
      await resumeMigration(job.id);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const progressEntries = Object.entries(job.progress);

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isPaused && (
            <div className="animate-spin h-4 w-4 border-2 border-purple-600 border-t-transparent rounded-full" />
          )}
          <span className="text-sm font-medium text-gray-700">
            {isPaused ? "Migration paused" : "Migration in progress..."}
          </span>
        </div>
        <button
          onClick={isPaused ? handleResume : handlePause}
          disabled={loading}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            isPaused
              ? "bg-purple-600 text-white hover:bg-purple-700"
              : "border border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          {loading ? "..." : isPaused ? "Resume" : "Pause"}
        </button>
      </div>

      {/* Progress Bars */}
      {progressEntries.length > 0 && (
        <div className="space-y-4">
          {progressEntries.map(([type, counts]) => (
            <ProgressBar
              key={type}
              label={type}
              total={counts.total}
              imported={counts.imported}
              skipped={counts.skipped}
              failed={counts.failed}
            />
          ))}
        </div>
      )}

      {/* Agent Log */}
      {job.agentLog && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Agent Log</h4>
          <div className="rounded-lg bg-gray-900 p-4 max-h-64 overflow-y-auto font-mono text-xs text-green-400">
            {job.agentLog.split("\n").map((line, i) => (
              <div key={i} className="whitespace-pre-wrap">
                {line}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
