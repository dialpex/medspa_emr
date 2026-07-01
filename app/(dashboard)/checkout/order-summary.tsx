"use client";

import type { CheckoutLineItem } from "@/lib/services/checkout-shared";
import type { CheckoutTotals } from "@/lib/services/checkout-shared";

type Props = {
  items: CheckoutLineItem[];
  totals: CheckoutTotals;
  redeemedItems: Set<string>;
};

export function OrderSummary({ items, totals, redeemedItems }: Props) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* Line items */}
      <div className="px-5 pt-4 pb-3 space-y-2">
        {items.map((item) => {
          const isRedeemed = redeemedItems.has(item.id);
          return (
            <div key={item.id} className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {item.description}
                </p>
                {item.quantity > 1 && (
                  <p className="text-xs text-gray-400">
                    {item.quantity} &times; ${item.unitPrice.toFixed(2)}
                  </p>
                )}
              </div>
              {isRedeemed ? (
                <span className="text-sm font-medium text-green-600">
                  Package Credit
                </span>
              ) : (
                <span className="text-sm font-medium text-gray-900 tabular-nums">
                  ${item.total.toFixed(2)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Dashed divider */}
      <div className="mx-5 border-t border-dashed border-gray-200" />

      {/* Totals breakdown */}
      <div className="px-5 py-3 space-y-1">
        <div className="flex justify-between">
          <span className="text-sm text-gray-400">Subtotal</span>
          <span className="text-sm text-gray-400 tabular-nums">
            ${totals.subtotal.toFixed(2)}
          </span>
        </div>
        {totals.discount > 0 && (
          <div className="flex justify-between">
            <span className="text-sm text-gray-400">Discount</span>
            <span className="text-sm text-red-500 tabular-nums">
              -${totals.discount.toFixed(2)}
            </span>
          </div>
        )}
        {totals.tax > 0 && (
          <div className="flex justify-between">
            <span className="text-sm text-gray-400">Tax</span>
            <span className="text-sm text-gray-400 tabular-nums">
              ${totals.tax.toFixed(2)}
            </span>
          </div>
        )}
        {totals.gratuity > 0 && (
          <div className="flex justify-between">
            <span className="text-sm text-gray-400">Gratuity</span>
            <span className="text-sm text-gray-400 tabular-nums">
              ${totals.gratuity.toFixed(2)}
            </span>
          </div>
        )}
        {totals.packageCredits > 0 && (
          <div className="flex justify-between">
            <span className="text-sm text-gray-400">Package Credits</span>
            <span className="text-sm text-green-500 tabular-nums">
              -${totals.packageCredits.toFixed(2)}
            </span>
          </div>
        )}
        {totals.depositApplied > 0 && (
          <div className="flex justify-between">
            <span className="text-sm text-gray-400">Deposit Applied</span>
            <span className="text-sm text-red-500 tabular-nums">
              -${totals.depositApplied.toFixed(2)}
            </span>
          </div>
        )}
        {totals.totalPaid > 0 && (
          <div className="flex justify-between">
            <span className="text-sm text-gray-400">Paid</span>
            <span className="text-sm text-green-500 tabular-nums">
              -${totals.totalPaid.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Solid divider */}
      <div className="mx-5 border-t border-gray-200" />

      {/* Balance due */}
      <div className="px-5 py-4 flex items-center justify-between">
        <span className="text-base font-semibold text-gray-900">
          Balance due
        </span>
        <span
          className={`text-2xl font-bold tabular-nums ${
            totals.balanceDue <= 0 ? "text-green-600" : "text-gray-900"
          }`}
        >
          ${totals.balanceDue.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
