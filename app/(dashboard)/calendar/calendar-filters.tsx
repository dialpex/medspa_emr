"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  FilterIcon,
} from "lucide-react";
import type { Provider, Room } from "@/lib/actions/appointments";

export type CalendarFiltersProps = {
  providers: Provider[];
  rooms: Room[];
  currentDate: string; // ISO string from server
  view: "day" | "week";
};

export function CalendarFilters({
  providers,
  rooms,
  currentDate,
  view,
}: CalendarFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedProviderId = searchParams.get("providerId") || "";
  const selectedRoomId = searchParams.get("roomId") || "";

  // Update URL with new params
  const updateParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    router.push(`/calendar?${params.toString()}`);
  };

  // Navigate to a specific date
  const navigateToDate = (date: Date) => {
    updateParams({ date: date.toISOString().split("T")[0] });
  };

  // Navigate prev/next based on view
  const navigatePrev = () => {
    const newDate = new Date(dateObj);
    if (view === "day") {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 7);
    }
    navigateToDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(dateObj);
    if (view === "day") {
      newDate.setDate(newDate.getDate() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    navigateToDate(newDate);
  };

  const navigateToday = () => {
    navigateToDate(new Date());
  };

  // Ensure currentDate is a Date object (may be serialized string from SSR)
  const dateObj = new Date(currentDate);

  // Format date for display
  const formatDateHeader = () => {
    if (view === "day") {
      return dateObj.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } else {
      // Week view - show date range
      const startOfWeek = new Date(dateObj);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);

      const startMonth = startOfWeek.toLocaleDateString("en-US", { month: "short" });
      const endMonth = endOfWeek.toLocaleDateString("en-US", { month: "short" });
      const year = startOfWeek.getFullYear();

      if (startMonth === endMonth) {
        return `${startMonth} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${year}`;
      } else {
        return `${startMonth} ${startOfWeek.getDate()} - ${endMonth} ${endOfWeek.getDate()}, ${year}`;
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
      {/* Date Navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={navigatePrev}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          aria-label={view === "day" ? "Previous day" : "Previous week"}
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>

        <button
          onClick={navigateToday}
          className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Today
        </button>

        <button
          onClick={navigateNext}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          aria-label={view === "day" ? "Next day" : "Next week"}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>

        <h2 className="text-lg font-semibold ml-4">{formatDateHeader()}</h2>
      </div>

      {/* View Toggle & Filters */}
      <div className="flex items-center gap-3">
        {/* View Toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => updateParams({ view: "day" })}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              view === "day"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Day
          </button>
          <button
            onClick={() => updateParams({ view: "week" })}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              view === "week"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Week
          </button>
        </div>

        {/* Provider Filter */}
        <div className="relative">
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
          <CalendarIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>

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
      </div>
    </div>
  );
}
