"use client";

import { useState } from "react";
import { CalendarOffIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TodayAppointment, TodayPermissions } from "@/lib/actions/today";
import { SmartStatusPill, PHASE_BORDER_COLORS } from "./smart-status-pill";
import { TodayDetailPanel } from "./today-detail-panel";

function formatTimeRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    new Date(d).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  // Remove duplicate AM/PM if both are the same period
  const startStr = fmt(start);
  const endStr = fmt(end);
  const startPeriod = startStr.slice(-2);
  const endPeriod = endStr.slice(-2);
  if (startPeriod === endPeriod) {
    return `${startStr.slice(0, -3)} \u2013 ${endStr}`;
  }
  return `${startStr} \u2013 ${endStr}`;
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
      <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden bg-white">
        {appointments.map((apt) => (
          <div
            key={apt.id}
            onClick={() => setSelectedId(apt.id)}
            className={cn(
              "flex items-center gap-4 cursor-pointer transition-colors hover:bg-gray-50 border-l-4",
              PHASE_BORDER_COLORS[apt.phase],
              isCompact ? "px-4 py-2" : "px-4 py-3",
              selectedId === apt.id && "bg-blue-50 hover:bg-blue-50"
            )}
          >
            {/* Time */}
            <div className="flex-shrink-0 w-[170px] text-sm tabular-nums whitespace-nowrap">
              <span className="text-gray-900 font-medium">
                {formatTimeRange(apt.startTime, apt.endTime)}
              </span>
            </div>

            {/* Patient + Service + Provider + Room */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 truncate">
                  {apt.patientName}
                </span>
                {/* Secondary badges - only in comfortable mode */}
                {!isCompact && (
                  <div className="flex items-center gap-1.5">
                    {apt.status === "Scheduled" && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-orange-50 text-orange-600 border border-orange-200">
                        Needs Confirmation
                      </span>
                    )}
                    {apt.completedAt && !apt.checkedOutAt && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200">
                        Checkout Pending
                      </span>
                    )}
                    {apt.chartStatus && (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border",
                          apt.chartStatus === "Draft" &&
                            "bg-gray-50 text-gray-500 border-gray-200",
                          apt.chartStatus === "NeedsSignOff" &&
                            "bg-yellow-50 text-yellow-600 border-yellow-200",
                          apt.chartStatus === "MDSigned" &&
                            "bg-green-50 text-green-600 border-green-200"
                        )}
                      >
                        {apt.chartStatus === "NeedsSignOff"
                          ? "Needs Sign-Off"
                          : apt.chartStatus === "MDSigned"
                            ? "MD Signed"
                            : apt.chartStatus}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className={cn("flex items-center gap-2 text-sm text-gray-500", isCompact && "text-xs")}>
                {apt.serviceName && <span>{apt.serviceName}</span>}
                {apt.serviceName && apt.providerName && (
                  <span className="text-gray-300">&middot;</span>
                )}
                <span>{apt.providerName}</span>
                {apt.roomName && (
                  <>
                    <span className="text-gray-300">&middot;</span>
                    <span>{apt.roomName}</span>
                  </>
                )}
              </div>
            </div>

            {/* Status Pill */}
            <div className="flex-shrink-0">
              <SmartStatusPill
                appointment={apt}
                permissions={permissions}
              />
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
