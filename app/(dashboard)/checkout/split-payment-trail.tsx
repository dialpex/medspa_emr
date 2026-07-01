"use client";

import { CheckCircle2 } from "lucide-react";
import type { CheckoutPayment } from "@/lib/services/checkout-shared";

type Props = {
  payments: CheckoutPayment[];
};

export function SplitPaymentTrail({ payments }: Props) {
  const positivePayments = payments.filter((p) => p.amount > 0);
  if (positivePayments.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
        Payments Received
      </h3>
      <div className="space-y-1.5">
        {positivePayments.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-2.5 rounded-lg bg-green-50 border border-green-100 px-3 py-2"
          >
            <CheckCircle2 className="size-4 text-green-600 flex-shrink-0" />
            <span className="text-sm text-green-800 flex-1">
              {p.paymentMethod === "Stripe" ? "Card" : p.paymentMethod}
              {p.reference ? ` (${p.reference})` : ""}
            </span>
            <span className="text-sm font-medium text-green-700 tabular-nums">
              ${p.amount.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
