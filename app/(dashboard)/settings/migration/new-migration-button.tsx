"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMigrationJob } from "@/lib/actions/migration";
import type { MigrationSource } from "@prisma/client";

const SOURCES: Array<{
  value: MigrationSource;
  label: string;
  description: string;
}> = [
  {
    value: "Boulevard",
    label: "Boulevard",
    description: "Import from Boulevard via API",
  },
  {
    value: "AestheticsRecord",
    label: "Aesthetics Record",
    description: "Import from Aesthetics Record",
  },
  {
    value: "CsvUpload",
    label: "CSV Upload",
    description: "Import from a CSV file",
  },
];

export function NewMigrationButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSelect(source: MigrationSource) {
    setLoading(true);
    try {
      const result = await createMigrationJob(source);
      if (result.success) {
        router.push(`/settings/migration/${result.data.jobId}`);
      }
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
      >
        Start New Migration
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {SOURCES.map((source) => (
        <button
          key={source.value}
          onClick={() => handleSelect(source.value)}
          disabled={loading}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-purple-300 hover:bg-purple-50 transition-colors disabled:opacity-50"
        >
          {source.label}
        </button>
      ))}
      <button
        onClick={() => setOpen(false)}
        className="text-sm text-gray-500 hover:text-gray-700 ml-1"
      >
        Cancel
      </button>
    </div>
  );
}
