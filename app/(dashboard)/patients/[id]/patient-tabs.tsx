"use client";

import { useState, type ReactNode } from "react";

interface Tab {
  value: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
}

export function PatientTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.value ?? "");

  const activeTab = tabs.find((t) => t.value === active);

  return (
    <div>
      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <div className="flex items-center gap-6">
          {tabs.map((tab) => {
            const isActive = tab.value === active;
            return (
              <button
                key={tab.value}
                onClick={() => setActive(tab.value)}
                className={`inline-flex items-center gap-1.5 py-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-purple-700 text-purple-700 font-semibold"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-4">{activeTab?.content}</div>
    </div>
  );
}
