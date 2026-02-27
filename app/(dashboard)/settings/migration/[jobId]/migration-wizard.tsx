"use client";

import { PageCard } from "@/components/ui/page-card";
import Link from "next/link";
import { ConnectStep } from "./connect-step";
import { DiscoverStep } from "./discover-step";
import { MappingStep } from "./mapping-step";
import { ProgressStep } from "./progress-step";
import { VerifyStep } from "./verify-step";

const STEPS = [
  { id: "connect", label: "Connect" },
  { id: "discover", label: "Discover" },
  { id: "map", label: "Review & Map" },
  { id: "migrate", label: "Migrate" },
  { id: "verify", label: "Verify" },
] as const;

function getActiveStep(status: string): number {
  switch (status) {
    case "Connecting":
    case "Connected":
      return 0;
    case "Discovering":
    case "Discovered":
      return 1;
    case "MappingInProgress":
    case "MappingReview":
      return 2;
    case "Migrating":
    case "Paused":
      return 3;
    case "Verifying":
    case "Completed":
      return 4;
    case "Failed":
      return -1;
    default:
      return 0;
  }
}

export interface MigrationJobData {
  id: string;
  source: string;
  status: string;
  sourceDiscovery: unknown;
  mappingConfig: unknown;
  pendingDecisions: unknown;
  progress: Record<string, { total: number; imported: number; skipped: number; failed: number }>;
  agentLog: string | null;
  consentSignedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  logCount: number;
  entityMapCount: number;
}

export function MigrationWizard({ job }: { job: MigrationJobData }) {
  const activeStep = getActiveStep(job.status);

  return (
    <PageCard
      title="Data Migration"
      label={job.source}
      headerAction={
        <Link
          href="/settings/migration"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Back to migrations
        </Link>
      }
    >
      {/* Step Indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((step, i) => (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  i < activeStep
                    ? "bg-green-100 text-green-700"
                    : i === activeStep
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {i < activeStep ? "✓" : i + 1}
              </div>
              <span
                className={`text-sm font-medium ${
                  i === activeStep ? "text-purple-700" : "text-gray-500"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-px mx-3 ${
                  i < activeStep ? "bg-green-300" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Error Banner */}
      {job.status === "Failed" && job.errorMessage && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-6">
          <h4 className="text-sm font-medium text-red-800">Migration Failed</h4>
          <p className="text-sm text-red-700 mt-1">{job.errorMessage}</p>
        </div>
      )}

      {/* Step Content */}
      {(job.status === "Connecting" || job.status === "Connected") && (
        <ConnectStep job={job} />
      )}
      {(job.status === "Discovering" || job.status === "Discovered") && (
        <DiscoverStep job={job} />
      )}
      {(job.status === "MappingInProgress" || job.status === "MappingReview") && (
        <MappingStep job={job} />
      )}
      {(job.status === "Migrating" || job.status === "Paused") && (
        <ProgressStep job={job} />
      )}
      {(job.status === "Verifying" || job.status === "Completed") && (
        <VerifyStep job={job} />
      )}
    </PageCard>
  );
}
