"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
  ListIcon,
  LayoutListIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Provider, Room } from "@/lib/actions/appointments";
import type { JourneyPhase, TodayAppointment } from "@/lib/actions/today";
import { PHASE_DOT_COLORS } from "./smart-status-pill";

const PHASE_TABS: { value: JourneyPhase | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "here", label: "Here" },
  { value: "with_provider", label: "In Session" },
  { value: "done", label: "Done" },
  { value: "no_show", label: "No Show" },
  { value: "cancelled", label: "Cancelled" },
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
  const [searchExpanded, setSearchExpanded] = useState(!!searchQuery);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);

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

  // Focus search input when expanded
  useEffect(() => {
    if (searchExpanded) {
      searchInputRef.current?.focus();
    }
  }, [searchExpanded]);

  // Close filters popover on outside click
  useEffect(() => {
    if (!filtersOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filtersOpen]);

  // Count appointments per phase
  const phaseCounts = {
    all: appointments.length,
    upcoming: appointments.filter((a) => a.phase === "upcoming").length,
    here: appointments.filter((a) => a.phase === "here").length,
    with_provider: appointments.filter((a) => a.phase === "with_provider").length,
    done: appointments.filter((a) => a.phase === "done").length,
    no_show: appointments.filter((a) => a.phase === "no_show").length,
    cancelled: appointments.filter((a) => a.phase === "cancelled").length,
  };

  const hasActiveFilters = !!selectedProviderId || !!selectedRoomId;

  return (
    <div className="flex items-center gap-2">
      {/* Phase Pills */}
      <div className="flex items-center gap-1 min-w-0">
        {PHASE_TABS.map((tab) => {
          const count = phaseCounts[tab.value];
          const isActive = selectedPhase === tab.value;
          const dotColor = PHASE_DOT_COLORS[tab.value];

          return (
            <button
              key={tab.value}
              onClick={() =>
                updateParams({ phase: tab.value === "all" ? "" : tab.value })
              }
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                isActive
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full flex-shrink-0",
                  isActive ? "bg-white" : dotColor
                )}
              />
              {tab.label}
              <span className={cn("text-[10px]", isActive ? "text-gray-300" : "text-gray-400")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Actions: Search + Filters */}
      <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
        {/* Search Toggle */}
        {searchExpanded ? (
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search patients..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onBlur={() => {
                if (!localSearch) setSearchExpanded(false);
              }}
              className="w-48 pl-8 pr-7 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <button
              onClick={() => {
                setLocalSearch("");
                setSearchExpanded(false);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSearchExpanded(true)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Search"
          >
            <SearchIcon className="h-4 w-4" />
          </button>
        )}

        {/* Filters Popover */}
        <div className="relative" ref={filtersRef}>
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              filtersOpen || hasActiveFilters
                ? "text-gray-900 bg-gray-100"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            )}
            title="Filters"
          >
            <SlidersHorizontalIcon className="h-4 w-4" />
            {hasActiveFilters && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full" />
            )}
          </button>

          {filtersOpen && (
            <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white py-3 shadow-lg">
              <div className="px-3 space-y-3">
                {/* Provider */}
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Provider
                  </label>
                  <select
                    value={selectedProviderId}
                    onChange={(e) => updateParams({ providerId: e.target.value })}
                    className="mt-1 w-full appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  >
                    <option value="">All Providers</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Room */}
                {rooms.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Room
                    </label>
                    <select
                      value={selectedRoomId}
                      onChange={(e) => updateParams({ roomId: e.target.value })}
                      className="mt-1 w-full appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    >
                      <option value="">All Rooms</option>
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Density */}
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Density
                  </label>
                  <div className="mt-1 flex rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => updateParams({ density: "compact" })}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors",
                        density === "compact"
                          ? "bg-gray-900 text-white"
                          : "bg-white text-gray-500 hover:bg-gray-50"
                      )}
                    >
                      <ListIcon className="h-3.5 w-3.5" />
                      Compact
                    </button>
                    <button
                      onClick={() => updateParams({ density: "comfortable" })}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors",
                        density !== "compact"
                          ? "bg-gray-900 text-white"
                          : "bg-white text-gray-500 hover:bg-gray-50"
                      )}
                    >
                      <LayoutListIcon className="h-3.5 w-3.5" />
                      Comfortable
                    </button>
                  </div>
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <button
                    onClick={() =>
                      updateParams({ providerId: "", roomId: "" })
                    }
                    className="w-full text-center text-xs text-blue-600 hover:text-blue-700 py-1"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
