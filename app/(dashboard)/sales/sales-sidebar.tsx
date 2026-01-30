"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FileText, DollarSign, CreditCard, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

const sections = [
  { key: "invoices", label: "Invoices", icon: FileText },
  { key: "payments", label: "Payments", icon: DollarSign },
  { key: "memberships", label: "Memberships", icon: CreditCard },
  { key: "gift-cards", label: "Gift Cards", icon: Gift },
];

export function SalesSidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("section") || "invoices";

  return (
    <nav className="w-[220px] shrink-0 border-r border-gray-200 bg-white py-4">
      <div className="px-4 pb-3">
        <h2 className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Sales</h2>
      </div>
      <ul className="space-y-0.5 px-2">
        {sections.map((s) => (
          <li key={s.key}>
            <button
              onClick={() => router.push(`/sales?section=${s.key}`)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active === s.key
                  ? "bg-purple-50 text-purple-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <s.icon className="size-4" />
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
