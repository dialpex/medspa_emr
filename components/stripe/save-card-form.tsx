"use client";

import { useState, useEffect } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";
import { StripeProvider } from "./stripe-provider";

type SaveCardInnerProps = {
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

function SaveCardInner({ onSuccess, onError }: SaveCardInnerProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setMessage(null);

    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/sales`,
      },
      redirect: "if_required",
    });

    if (error) {
      const msg = error.message || "Failed to save card";
      setMessage(msg);
      onError?.(msg);
    } else {
      setMessage("Card saved successfully!");
      onSuccess?.();
    }

    setIsProcessing(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {message && (
        <div
          className={`rounded-lg px-4 py-2 text-sm ${
            message.includes("successfully") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Saving...
          </>
        ) : (
          "Save Card"
        )}
      </button>
    </form>
  );
}

type SaveCardFormProps = {
  patientId: string;
  stripeAccountId: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

export function SaveCardForm({ patientId, stripeAccountId, onSuccess, onError }: SaveCardFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSetupIntent() {
      try {
        const res = await fetch("/api/billing/stripe/setup-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create setup intent");
        setClientSecret(data.clientSecret);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to initialize";
        setError(msg);
        onError?.(msg);
      } finally {
        setLoading(false);
      }
    }
    fetchSetupIntent();
  }, [patientId, onError]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !clientSecret) {
    return <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error || "Failed to initialize"}</div>;
  }

  return (
    <StripeProvider clientSecret={clientSecret} stripeAccountId={stripeAccountId}>
      <SaveCardInner onSuccess={onSuccess} onError={onError} />
    </StripeProvider>
  );
}
