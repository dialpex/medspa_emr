"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FileText, DollarSign, CreditCard, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useState, useEffect, useCallback } from "react";

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

  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);
  const [animate, setAnimate] = useState(false);

  const updateIndicator = useCallback(() => {
    if (!listRef.current) return;
    const el = itemRefs.current.get(active);
    if (!el) { setIndicator(null); return; }
    const listRect = listRef.current.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setIndicator({ top: elRect.top - listRect.top, height: elRect.height });
  }, [active]);

  useEffect(() => {
    updateIndicator();
    const raf = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  return (
    <nav className="w-[220px] shrink-0 border-r border-gray-200 bg-white py-4">
      <div className="px-4 pb-3">
        <h2 className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Sales</h2>
      </div>
      <ul ref={listRef} className="relative space-y-0.5 px-2">
        {indicator && (
          <div
            className="absolute left-2 right-2 rounded-lg bg-purple-50"
            style={{
              top: indicator.top,
              height: indicator.height,
              transition: animate ? "top 150ms cubic-bezier(0.4, 0, 0.2, 1), height 100ms ease" : "none",
            }}
          />
        )}
        {sections.map((s) => (
          <li
            key={s.key}
            ref={(el) => {
              if (el) itemRefs.current.set(s.key, el);
              else itemRefs.current.delete(s.key);
            }}
          >
            <button
              onClick={() => router.push(`/sales?section=${s.key}`)}
              className={cn(
                "relative z-[1] flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                active === s.key
                  ? "text-purple-700"
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
