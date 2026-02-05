"use client";

import { useState } from "react";
import { CalendarOffIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TodayAppointment, TodayPermissions } from "@/lib/actions/today";
import { SmartStatusPill } from "./smart-status-pill";
import { TodayDetailPanel } from "./today-detail-panel";

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(start: Date, end: Date): string {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

export function TodayList({
  appointments,
  permissions,
  density,
}: {
  appointments: TodayAppointment[];
  permissions: TodayPermissions;
  density: "compact" | "comfortable";
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isCompact = density === "compact";

  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <CalendarOffIcon className="h-12 w-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          No appointments today
        </h3>
        <p className="text-sm text-gray-500">
          Check back later or adjust your filters.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white">
        {appointments.map((apt) => (
          <div
            key={apt.id}
            onClick={() => setSelectedId(apt.id)}
            className={cn(
              "flex items-center cursor-pointer transition-colors hover:bg-gray-50 group",
              isCompact ? "px-4 py-2" : "px-4 py-3",
              selectedId === apt.id && "bg-blue-50/60 hover:bg-blue-50/60"
            )}
          >
            {/* Status Indicator - Fixed width, left */}
            <div className="flex-shrink-0">
              <SmartStatusPill
                appointment={apt}
                permissions={permissions}
              />
            </div>

            {/* Main Content - Flexible */}
            <div className="flex-1 min-w-0 ml-1">
              <div className="font-semibold text-gray-900 truncate">
                {apt.patientName}
              </div>
              {!isCompact && (
                <div className="text-sm text-gray-500 truncate">
                  {apt.serviceName && <span>{apt.serviceName}</span>}
                  {apt.serviceName && apt.providerName && (
                    <span className="text-gray-300"> &middot; </span>
                  )}
                  <span className="text-xs text-gray-400">{apt.providerName}</span>
                </div>
              )}
            </div>

            {/* Time - Right aligned */}
            <div className="flex-shrink-0 text-right ml-4">
              <div className="text-xs text-gray-400">{formatTime(apt.startTime)}</div>
              {!isCompact && (
                <div className="text-[10px] text-gray-300">{formatDuration(apt.startTime, apt.endTime)}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <TodayDetailPanel
        appointmentId={selectedId}
        onClose={() => setSelectedId(null)}
        permissions={permissions}
      />
    </>
  );
}
