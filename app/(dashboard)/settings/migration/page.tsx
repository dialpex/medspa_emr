import Link from "next/link";
import { PageCard } from "@/components/ui/page-card";
import { getMigrationJobs } from "@/lib/actions/migration";
import { NewMigrationButton } from "./new-migration-button";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  Connecting: { label: "Connecting", color: "bg-yellow-100 text-yellow-800" },
  Connected: { label: "Connected", color: "bg-blue-100 text-blue-800" },
  Discovering: { label: "Discovering", color: "bg-blue-100 text-blue-800" },
  Discovered: { label: "Discovered", color: "bg-blue-100 text-blue-800" },
  MappingInProgress: { label: "Mapping", color: "bg-blue-100 text-blue-800" },
  MappingReview: { label: "Review Mappings", color: "bg-purple-100 text-purple-800" },
  Migrating: { label: "Migrating", color: "bg-indigo-100 text-indigo-800" },
  Paused: { label: "Paused", color: "bg-yellow-100 text-yellow-800" },
  Verifying: { label: "Verifying", color: "bg-green-100 text-green-800" },
  Completed: { label: "Completed", color: "bg-green-100 text-green-800" },
  Failed: { label: "Failed", color: "bg-red-100 text-red-800" },
};

const SOURCE_LABELS: Record<string, string> = {
  Boulevard: "Boulevard",
  AestheticsRecord: "Aesthetics Record",
  CsvUpload: "CSV Upload",
};

export default async function MigrationDashboardPage() {
  const jobs = await getMigrationJobs();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageCard
        title="Data Migration"
        label="Settings"
        headerAction={<NewMigrationButton />}
      >
        {jobs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📦</div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No migrations yet
            </h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              Import your data from another platform. We support Boulevard, Aesthetics Record, and CSV uploads.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Source</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Started</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Completed</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const status = STATUS_LABELS[job.status] ?? { label: job.status, color: "bg-gray-100 text-gray-800" };
                  return (
                    <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/settings/migration/${job.id}`}
                          className="font-medium text-purple-700 hover:text-purple-900"
                        >
                          {SOURCE_LABELS[job.source] ?? job.source}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {job.startedAt ? new Date(job.startedAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {job.completedAt ? new Date(job.completedAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PageCard>
    </div>
  );
}
