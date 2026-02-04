"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  SearchIcon,
  FilterIcon,
  ListIcon,
  LayoutListIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Provider, Room } from "@/lib/actions/appointments";
import type { JourneyPhase, TodayAppointment } from "@/lib/actions/today";

const PHASE_TABS: { value: JourneyPhase | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "here", label: "Here" },
  { value: "with_provider", label: "With Provider" },
  { value: "done", label: "Done" },
];

export function TodayFilters({
  providers,
  rooms,
  appointments,
}: {
  providers: Provider[];
  rooms: Room[];
  appointments: TodayAppointment[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedProviderId = searchParams.get("providerId") || "";
  const selectedRoomId = searchParams.get("roomId") || "";
  const selectedPhase = searchParams.get("phase") || "all";
  const density = searchParams.get("density") || "comfortable";
  const searchQuery = searchParams.get("search") || "";

  const [localSearch, setLocalSearch] = useState(searchQuery);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });
      router.push(`/today?${params.toString()}`);
    },
    [router, searchParams]
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchQuery) {
        updateParams({ search: localSearch });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, searchQuery, updateParams]);

  // Count appointments per phase (from the unfiltered-by-phase list)
  const phaseCounts = {
    all: appointments.length,
    upcoming: appointments.filter((a) => a.phase === "upcoming").length,
    here: appointments.filter((a) => a.phase === "here").length,
    with_provider: appointments.filter((a) => a.phase === "with_provider").length,
    done: appointments.filter((a) => a.phase === "done").length,
  };

  return (
    <div className="space-y-3">
      {/* Top row: filters + search + density */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Provider Filter */}
        <select
          value={selectedProviderId}
          onChange={(e) => updateParams({ providerId: e.target.value })}
          className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        >
          <option value="">All Providers</option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>

        {/* Room Filter */}
        {rooms.length > 0 && (
          <div className="relative">
            <select
              value={selectedRoomId}
              onChange={(e) => updateParams({ roomId: e.target.value })}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="">All Rooms</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
            <FilterIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        )}

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search patients..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>

        {/* Density Toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden ml-auto">
          <button
            onClick={() => updateParams({ density: "compact" })}
            title="Compact"
            className={cn(
              "p-2 transition-colors",
              density === "compact"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-500 hover:bg-gray-50"
            )}
          >
            <ListIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => updateParams({ density: "comfortable" })}
            title="Comfortable"
            className={cn(
              "p-2 transition-colors",
              density !== "compact"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-500 hover:bg-gray-50"
            )}
          >
            <LayoutListIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Phase tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {PHASE_TABS.map((tab) => {
          const count = phaseCounts[tab.value];
          const isActive = selectedPhase === tab.value;

          return (
            <button
              key={tab.value}
              onClick={() =>
                updateParams({ phase: tab.value === "all" ? "" : tab.value })
              }
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[20px] h-5 rounded-full px-1.5 text-xs font-medium",
                  isActive
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
