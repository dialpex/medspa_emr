"use client";

import { useState } from "react";

type Props = {
  balanceDue: number;
  onRecord: (amount: number) => void;
  isPending: boolean;
};

export function CashTendered({ balanceDue }: Props) {
  const [tendered, setTendered] = useState("");

  const tenderedAmount = parseFloat(tendered) || 0;
  const changeDue = Math.max(0, Math.round((tenderedAmount - balanceDue) * 100) / 100);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Amount Tendered</label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">$</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={tendered}
            onChange={(e) => setTendered(e.target.value)}
            placeholder={balanceDue.toFixed(2)}
            className="w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
            autoFocus
          />
        </div>
      </div>

      {tenderedAmount > 0 && tenderedAmount >= balanceDue && (
        <div className="flex items-center justify-between rounded-lg bg-green-50 border border-green-100 px-4 py-2.5">
          <span className="text-sm text-green-700">Change Due</span>
          <span className="text-lg font-semibold text-green-700 tabular-nums">
            ${changeDue.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}
