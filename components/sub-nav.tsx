"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type SubNavItem = {
  label: string;
  param: string;
  icon: React.ReactNode;
};

export function SubNav({
  basePath,
  items,
  defaultParam,
}: {
  basePath: string;
  items: SubNavItem[];
  defaultParam?: string;
}) {
  const searchParams = useSearchParams();
  const active = searchParams.get("section") || defaultParam || items[0]?.param;

  return (
    <div className="border-b border-gray-200 bg-white px-6">
      <nav className="-mb-px flex justify-center gap-6">
        {items.map((item) => {
          const isActive = active === item.param;
          return (
            <Link
              key={item.param}
              href={`${basePath}?section=${item.param}`}
              className={`flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? "border-amber-600 text-amber-700"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
