"use client";

import { Banknote, Loader2 } from "lucide-react";
import type { CheckoutDeposit } from "@/lib/services/checkout-shared";

type Props = {
  deposits: CheckoutDeposit[];
  appliedDepositIds: Set<string>;
  onApply: (depositId: string) => void;
  applying?: boolean;
};

export function DepositSection({ deposits, appliedDepositIds, onApply, applying }: Props) {
  const available = deposits.filter((d) => !appliedDepositIds.has(d.id));
  if (available.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
        Deposit on File
      </h3>
      <div className="space-y-2">
        {available.map((deposit) => (
          <div
            key={deposit.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <Banknote className="size-4 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  ${deposit.amount.toFixed(2)} deposit
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(deposit.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onApply(deposit.id)}
              disabled={applying}
              className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 flex items-center gap-1.5"
            >
              {applying ? <Loader2 className="size-3 animate-spin" /> : null}
              Apply to Sale
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
