"use client";

import { useState, useTransition } from "react";
import { FlaskConicalIcon } from "lucide-react";
import { getFeatureFlagsAdmin } from "@/lib/actions/feature-flags";
import { FeatureFlagsModal } from "./feature-flags-modal";
import type { FeatureFlagsData } from "@/lib/actions/feature-flags";

export function FeatureFlagsButton() {
  const [data, setData] = useState<FeatureFlagsData | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpen = () => {
    startTransition(async () => {
      const result = await getFeatureFlagsAdmin();
      setData(result);
    });
  };

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={isPending}
        title="Feature Flags"
        className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
      >
        <FlaskConicalIcon className="size-4.5" />
      </button>

      {data && (
        <FeatureFlagsModal data={data} onClose={() => setData(null)} />
      )}
    </>
  );
}
