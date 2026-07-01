"use client";

import { useEffect, useState, useRef } from "react";
import { Check } from "lucide-react";

type Props = {
  totalPaid: number;
  onClose: () => void;
};

const AUTO_CLOSE_MS = 5000;

export function CheckoutSuccess({ totalPaid, onClose }: Props) {
  const [progress, setProgress] = useState(100);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / AUTO_CLOSE_MS) * 100);
      setProgress(pct);
    }, 50);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [onClose]);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-8">
      {/* Checkmark circle */}
      <div className="relative mb-6">
        {/* Countdown ring */}
        <svg className="size-20 -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="3"
          />
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="#22c55e"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 36}`}
            strokeDashoffset={`${2 * Math.PI * 36 * (1 - progress / 100)}`}
            className="transition-[stroke-dashoffset] duration-100 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="size-14 rounded-full bg-green-500 flex items-center justify-center animate-scale-in">
            <Check className="size-8 text-white" strokeWidth={3} />
          </div>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mb-1">
        Payment Complete
      </h2>
      <p className="text-3xl font-bold text-gray-900 tabular-nums mb-8">
        ${totalPaid.toFixed(2)}
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
