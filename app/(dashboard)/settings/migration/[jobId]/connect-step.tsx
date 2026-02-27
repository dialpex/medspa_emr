"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { connectMigrationSource, discoverMigrationData } from "@/lib/actions/migration";
import { PROVIDER_REGISTRY } from "@/lib/migration/providers";
import type { MigrationSource } from "@prisma/client";
import type { MigrationJobData } from "./migration-wizard";

export function ConnectStep({ job }: { job: MigrationJobData }) {
  const router = useRouter();
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [consentChecked, setConsentChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);

  const providerInfo = PROVIDER_REGISTRY[job.source as MigrationSource];
  const isConnected = job.status === "Connected";
  const isCsvUpload = providerInfo?.strategy === "csv_import";

  function updateCredential(key: string, value: string) {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  }

  const requiredFieldsFilled = providerInfo?.credentialFields
    .filter((f) => f.required)
    .every((f) => credentials[f.key]?.trim()) ?? false;

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      const result = await connectMigrationSource(
        job.id,
        credentials,
        consentChecked
      );
      if (result.success) {
        setBusinessName(result.data.businessName ?? null);
        router.refresh();
      } else {
        setError(result.error);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleContinue() {
    setLoading(true);
    setError(null);
    try {
      const result = await discoverMigrationData(job.id);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    } finally {
      setLoading(false);
    }
  }

  const consentText = `I authorize Neuvvia to connect to ${job.source} using the credentials I've provided and to read my clinic's data (patients, appointments, services, photos, and invoices) for the purpose of migrating it to Neuvvia. Neuvvia will NOT modify or delete any data on ${job.source}.`;

  return (
    <div className="space-y-6">
      {!isConnected ? (
        <>
          {/* Credential Form */}
          <div className="space-y-4">
            <h3 className="text-base font-medium text-gray-900">
              Connect to {providerInfo?.displayName ?? job.source}
            </h3>
            <p className="text-sm text-gray-500">
              {isCsvUpload
                ? "Upload your CSV files to begin the import."
                : `Enter your ${providerInfo?.displayName ?? job.source} credentials. These will be encrypted and stored securely.`}
            </p>

            {providerInfo?.credentialFields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                </label>
                <input
                  type={field.type}
                  value={credentials[field.key] ?? ""}
                  onChange={(e) => updateCredential(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                />
              </div>
            ))}

            {isCsvUpload && (
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                <p className="text-sm text-gray-500">
                  CSV file upload will be available in a future update.
                </p>
              </div>
            )}
          </div>

          {/* Authorization Consent */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h4 className="text-sm font-medium text-amber-900 mb-2">
              Authorization Consent
            </h4>
            <p className="text-sm text-amber-800 mb-3">{consentText}</p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-amber-900">
                I understand and authorize this connection
              </span>
            </label>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={loading || (!isCsvUpload && !requiredFieldsFilled) || !consentChecked}
            className="rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Connecting..." : "Authorize & Connect"}
          </button>
        </>
      ) : (
        <>
          {/* Connected State */}
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-center gap-2">
              <span className="text-green-600 text-lg">&#10003;</span>
              <div>
                <h4 className="text-sm font-medium text-green-800">
                  Connected to {providerInfo?.displayName ?? job.source}
                </h4>
                {businessName && (
                  <p className="text-sm text-green-700">Business: {businessName}</p>
                )}
                {job.consentSignedAt && (
                  <p className="text-xs text-green-600 mt-1">
                    Consent signed on {new Date(job.consentSignedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>

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
            {loading ? "Discovering data..." : "Continue to Discovery"}
          </button>
        </>
      )}
    </div>
  );
}
