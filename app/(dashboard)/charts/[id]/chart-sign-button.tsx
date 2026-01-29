"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheckIcon, Loader2Icon } from "lucide-react";
import { signChart } from "@/lib/actions/charts";

export function ChartSignButton({ chartId }: { chartId: string }) {
  const router = useRouter();
  const [signing, setSigning] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleSign = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setSigning(true);
    const result = await signChart(chartId);
    if (result.success) {
      router.refresh();
    }
    setSigning(false);
    setConfirming(false);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSign}
        disabled={signing}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 ${
          confirming
            ? "text-white bg-green-600 hover:bg-green-700"
            : "text-green-700 bg-green-50 hover:bg-green-100 border border-green-200"
        }`}
      >
        {signing ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <ShieldCheckIcon className="size-4" />
        )}
        {confirming ? "Confirm Sign-off" : "Sign Chart"}
      </button>
      {confirming && (
        <button
          onClick={() => setConfirming(false)}
          className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
