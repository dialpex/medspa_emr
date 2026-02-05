"use client";

import { toggleProductActive } from "@/lib/actions/products";
import { useTransition } from "react";

export function ToggleActiveButton({
  productId,
  isActive,
}: {
  productId: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => toggleProductActive(productId))}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
        isActive
          ? "bg-green-50 text-green-700 hover:bg-green-100"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      } ${isPending ? "opacity-50" : ""}`}
    >
      {isActive ? "Active" : "Inactive"}
    </button>
  );
}
