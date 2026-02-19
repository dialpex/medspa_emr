"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheckIcon, Loader2Icon, AlertCircleIcon, CheckCircleIcon } from "lucide-react";
import { signChart, providerSignChart, coSignChart } from "@/lib/actions/charts";
import { validateTreatmentCard } from "@/lib/templates/validation";

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

interface TreatmentCardInfo {
  id: string;
  templateType: string;
  title: string;
  structuredData: string;
}

export function ProviderSignButton({
  chartId,
  treatmentCards,
}: {
  chartId: string;
  treatmentCards: TreatmentCardInfo[];
}) {
  const router = useRouter();
  const [signing, setSigning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockingCards, setBlockingCards] = useState<
    Array<{ cardTitle: string; missingFields: string[] }>
  >([]);

  const handleSign = async () => {
    setError(null);
    setBlockingCards([]);

    // Client-side validation first
    const blocking: Array<{ cardTitle: string; missingFields: string[] }> = [];
    for (const card of treatmentCards) {
      const result = validateTreatmentCard(card.templateType, card.structuredData);
      if (result.isSignBlocking) {
        blocking.push({ cardTitle: card.title, missingFields: result.missingHighRiskFields });
      }
    }

    if (blocking.length > 0) {
      setBlockingCards(blocking);
      return;
    }

    if (!confirming) {
      setConfirming(true);
      return;
    }

    setSigning(true);
    const result = await providerSignChart(chartId);
    if (result.success) {
      router.push(`/charts/${chartId}`);
      router.refresh();
    } else {
      setError(result.error ?? "Failed to sign chart");
      // Check for server-side blocking errors
      const data = result.data as { blockingErrors?: Array<{ cardTitle: string; missingFields: string[] }> } | undefined;
      if (data?.blockingErrors) {
        setBlockingCards(data.blockingErrors);
      }
    }
    setSigning(false);
    setConfirming(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={handleSign}
          disabled={signing}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 ${
            confirming
              ? "text-white bg-purple-600 hover:bg-purple-700"
              : "text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200"
          }`}
        >
          {signing ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <CheckCircleIcon className="size-4" />
          )}
          {confirming ? "Confirm Complete & Sign" : "Complete & Sign"}
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

      {error && !blockingCards.length && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {blockingCards.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1">
          <p className="text-sm font-medium text-red-700 flex items-center gap-1.5">
            <AlertCircleIcon className="size-4" />
            Cannot sign — high-risk fields incomplete:
          </p>
          <ul className="text-sm text-red-600 ml-6 list-disc space-y-0.5">
            {blockingCards.map((card) => (
              <li key={card.cardTitle}>
                <span className="font-medium">{card.cardTitle}:</span>{" "}
                {card.missingFields.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function CoSignButton({ chartId }: { chartId: string }) {
  const router = useRouter();
  const [signing, setSigning] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleCoSign = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setSigning(true);
    const result = await coSignChart(chartId);
    if (result.success) {
      router.refresh();
    }
    setSigning(false);
    setConfirming(false);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCoSign}
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
        {confirming ? "Confirm Co-sign" : "Approve & Co-sign"}
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
