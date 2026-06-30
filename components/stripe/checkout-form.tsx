"use client";

import { useState } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";

type Props = {
  onSuccess?: () => void;
  onError?: (message: string) => void;
  returnUrl?: string;
};

export function CheckoutForm({ onSuccess, onError, returnUrl }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl || `${window.location.origin}/sales`,
      },
      redirect: "if_required",
    });

    if (error) {
      const msg = error.message || "Payment failed";
      setMessage(msg);
      onError?.(msg);
    } else if (paymentIntent?.status === "succeeded") {
      setMessage("Payment succeeded!");
      onSuccess?.();
    } else if (paymentIntent?.status === "processing") {
      setMessage("Payment is processing...");
    }

    setIsProcessing(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {message && (
        <div
          className={`rounded-lg px-4 py-2 text-sm ${
            message.includes("succeeded")
              ? "bg-green-50 text-green-700"
              : message.includes("processing")
                ? "bg-yellow-50 text-yellow-700"
                : "bg-red-50 text-red-700"
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
            <Loader2 className="size-4 animate-spin" /> Processing...
          </>
        ) : (
          "Pay Now"
        )}
      </button>
    </form>
  );
}
