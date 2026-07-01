"use client";

import { useEffect, useRef, useCallback } from "react";
import { X, ArrowLeft } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function CheckoutDrawer({ open, onClose, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, handleEscape]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        ref={panelRef}
        className="absolute right-0 top-0 bottom-0 w-full max-w-[480px] bg-gray-50 shadow-2xl flex flex-col animate-slide-in-right rounded-l-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="size-5" />
            </button>
            <h2 className="text-lg font-bold text-gray-900">Checkout</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
