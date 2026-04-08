"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { AppointmentStatus } from "@prisma/client";
import type { CalendarAppointment, Provider } from "@/lib/actions/appointments";

// --- Constants ---
const DAY_START_HOUR = 0;
const DAY_END_HOUR = 24;
const TOTAL_HOURS = 24;
const TOTAL_MINUTES = TOTAL_HOURS * 60;
const PX_PER_HOUR = 62; // Same density as original 800px / 13hrs
const GRID_HEIGHT = PX_PER_HOUR * TOTAL_HOURS; // ~1488px
const BUSINESS_START_HOUR = 7; // Default scroll position
const SNAP_MINUTES = 15;
const GHOST_DURATION_MIN = 30;
const MIN_DISPLAY_DURATION_MIN = 30;
const MIN_COL_WIDTH = 160;

// Status colors (inline style values matching calendar-view.tsx)
const STATUS_COLORS: Record<AppointmentStatus, { bg: string; border: string; text: string }> = {
  Scheduled: { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  Confirmed: { bg: "#dcfce7", border: "#22c55e", text: "#166534" },
  CheckedIn: { bg: "#fef9c3", border: "#eab308", text: "#854d0e" },
  InProgress: { bg: "#f3e8ff", border: "#a855f7", text: "#6b21a8" },
  Completed: { bg: "#f3f4f6", border: "#9ca3af", text: "#4b5563" },
  NoShow: { bg: "#fee2e2", border: "#ef4444", text: "#991b1b" },
  Cancelled: { bg: "#f3f4f6", border: "#d1d5db", text: "#9ca3af" },
};

const BLOCK_COLORS = { bg: "#f3f4f6", border: "#9ca3af", text: "#4b5563" };

// --- Helpers ---
function minutesSinceDayStart(date: Date | string): number {
  const d = new Date(date);
  return (d.getHours() - DAY_START_HOUR) * 60 + d.getMinutes();
}

function topPercent(date: Date | string): number {
  return Math.max(0, (minutesSinceDayStart(date) / TOTAL_MINUTES) * 100);
}

function heightPercent(start: Date | string, end: Date | string): number {
  const startMin = minutesSinceDayStart(start);
  const endMin = minutesSinceDayStart(end);
  const duration = Math.max(endMin - startMin, MIN_DISPLAY_DURATION_MIN);
  return (duration / TOTAL_MINUTES) * 100;
}

function formatEventTime(date: Date | string): string {
  const d = new Date(date);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;
  const minuteStr = minutes > 0 ? `:${String(minutes).padStart(2, "0")}` : "";
  return `${hours}${minuteStr}${ampm}`;
}

// Generate hour labels
const HOUR_LABELS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
  const hour = DAY_START_HOUR + i;
  const h12 = hour % 12 || 12;
  const ampm = hour >= 12 ? "PM" : "AM";
  return { hour, label: `${h12} ${ampm}`, pct: (i * 60) / TOTAL_MINUTES * 100 };
});

// --- Types ---
export type ProviderDayViewProps = {
  appointments: CalendarAppointment[];
  providers: Provider[];
  currentDate: string;
  permissions: { canCreate: boolean; canEdit: boolean; canDelete: boolean };
  onEventClick: (appointmentId: string) => void;
  onSlotClick: (x: number, y: number, startTime: Date, endTime: Date) => void;
};

// --- Event Block ---
function EventBlock({
  apt,
  onClick,
}: {
  apt: CalendarAppointment;
  onClick: () => void;
}) {
  const isBlock = apt.isBlock;
  const colors = isBlock ? BLOCK_COLORS : STATUS_COLORS[apt.status];
  const top = topPercent(apt.startTime);
  const height = heightPercent(apt.startTime, apt.endTime);
  const timeStr = formatEventTime(apt.startTime);
  const label = isBlock ? (apt.blockTitle || "Block") : apt.patientName;
  const subtitle = isBlock ? "" : (apt.serviceName || "");

  const startMs = new Date(apt.startTime).getTime();
  const endMs = new Date(apt.endTime).getTime();
  const durationMin = (endMs - startMs) / 60000;
  const isCompact = durationMin <= 30;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="absolute left-1 right-1 rounded cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
      style={{
        top: `${top}%`,
        height: `${height}%`,
        minHeight: 24,
        backgroundColor: colors.bg,
        borderLeft: `3px solid ${colors.border}`,
        color: colors.text,
        fontSize: 12,
        lineHeight: isCompact ? "1.3" : "1.4",
        padding: isCompact ? "2px 6px" : "4px 8px",
        zIndex: 2,
      }}
    >
      {isCompact ? (
        <div style={{ display: "flex", gap: 6, alignItems: "baseline", whiteSpace: "nowrap", overflow: "hidden" }}>
          <span style={{ opacity: 0.8, flexShrink: 0 }}>{timeStr}</span>
          {apt.recurrenceGroupId && <span style={{ opacity: 0.6, flexShrink: 0, fontSize: 10 }} title="Recurring">↻</span>}
          <span style={{ fontWeight: 600 }}>{label}</span>
          {subtitle && <span style={{ opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</span>}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, alignItems: "baseline", fontSize: 11, overflow: "hidden", whiteSpace: "nowrap" }}>
            <span style={{ opacity: 0.8, flexShrink: 0 }}>{timeStr}</span>
            {apt.recurrenceGroupId && <span style={{ opacity: 0.6, flexShrink: 0 }} title="Recurring">↻</span>}
            {subtitle && <span style={{ opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</span>}
          </div>
          <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        </>
      )}
    </div>
  );
}

// --- Main Component ---
export function ProviderDayView({
  appointments,
  providers,
  currentDate,
  permissions,
  onEventClick,
  onSlotClick,
}: ProviderDayViewProps) {
  // Group appointments by provider
  const appointmentsByProvider = useMemo(() => {
    const map = new Map<string, CalendarAppointment[]>();
    for (const p of providers) {
      map.set(p.id, []);
    }
    for (const apt of appointments) {
      const list = map.get(apt.providerId);
      if (list) {
        list.push(apt);
      } else {
        // Provider not in list (shouldn't happen, but handle gracefully)
        map.set(apt.providerId, [apt]);
      }
    }
    return map;
  }, [appointments, providers]);

  // Determine which providers to show (all providers, even those with no appointments)
  const visibleProviders = useMemo(() => {
    if (providers.length === 0) {
      // Fallback: derive from appointments
      const seen = new Map<string, string>();
      for (const apt of appointments) {
        if (!seen.has(apt.providerId)) {
          seen.set(apt.providerId, apt.providerName);
        }
      }
      return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
    }
    return providers;
  }, [providers, appointments]);

  // Auto-scroll to business hours on mount
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTop = BUSINESS_START_HOUR * PX_PER_HOUR;
  }, [currentDate]);

  // Ghost hover state
  const [ghost, setGhost] = useState<{
    providerId: string;
    topPct: number;
    heightPct: number;
    label: string;
    startTime: Date;
    endTime: Date;
  } | null>(null);

  // Current time indicator
  const [nowPct, setNowPct] = useState<number | null>(null);
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const dateStr = new Date(currentDate).toISOString().split("T")[0];
      if (todayStr !== dateStr) {
        setNowPct(null);
        return;
      }
      const min = minutesSinceDayStart(now);
      if (min < 0 || min > TOTAL_MINUTES) {
        setNowPct(null);
      } else {
        setNowPct((min / TOTAL_MINUTES) * 100);
      }
    };
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [currentDate]);

  // Handle mouse move for ghost block
  const gridRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!permissions.canCreate) return;

    const target = e.target as HTMLElement;
    // Don't show ghost over existing events
    if (target.closest("[data-event-block]")) {
      setGhost(null);
      return;
    }

    const col = target.closest<HTMLElement>("[data-provider-col]");
    if (!col) {
      setGhost(null);
      return;
    }

    const providerId = col.getAttribute("data-provider-col")!;
    const rect = col.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const hourFloat = DAY_START_HOUR + (relY / rect.height) * TOTAL_HOURS;

    // Snap
    const totalMin = Math.round((hourFloat * 60) / SNAP_MINUTES) * SNAP_MINUTES;
    const snappedHour = Math.floor(totalMin / 60);
    const snappedMin = totalMin % 60;

    if (snappedHour < DAY_START_HOUR || snappedHour >= DAY_END_HOUR) {
      setGhost(null);
      return;
    }

    const topPct = ((snappedHour - DAY_START_HOUR) * 60 + snappedMin) / TOTAL_MINUTES * 100;
    const heightPct = GHOST_DURATION_MIN / TOTAL_MINUTES * 100;

    const h12 = snappedHour % 12 || 12;
    const ampm = snappedHour >= 12 ? "pm" : "am";
    const minStr = snappedMin > 0 ? `:${String(snappedMin).padStart(2, "0")}` : "";
    const label = `${h12}${minStr}${ampm}`;

    const [year, month, day] = new Date(currentDate).toISOString().split("T")[0].split("-").map(Number);
    const startTime = new Date(year, month - 1, day, snappedHour, snappedMin);
    const endTime = new Date(startTime.getTime() + GHOST_DURATION_MIN * 60000);

    setGhost({ providerId, topPct, heightPct, label, startTime, endTime });
  }, [permissions.canCreate, currentDate]);

  const handleMouseLeave = useCallback(() => {
    setGhost(null);
  }, []);

  const handleGhostClick = useCallback((e: React.MouseEvent) => {
    if (!ghost) return;
    e.stopPropagation();
    onSlotClick(e.clientX, e.clientY, ghost.startTime, ghost.endTime);
    setGhost(null);
  }, [ghost, onSlotClick]);

  // Click on empty column space
  const handleColClick = useCallback((e: React.MouseEvent, providerId: string) => {
    if (!permissions.canCreate) return;
    // If ghost is visible, use ghost data (more accurate snapping)
    if (ghost && ghost.providerId === providerId) {
      onSlotClick(e.clientX, e.clientY, ghost.startTime, ghost.endTime);
      setGhost(null);
      return;
    }

    // Fallback: compute from click position
    const col = (e.target as HTMLElement).closest<HTMLElement>("[data-provider-col]");
    if (!col) return;
    const rect = col.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const hourFloat = DAY_START_HOUR + (relY / rect.height) * TOTAL_HOURS;
    const totalMin = Math.round((hourFloat * 60) / SNAP_MINUTES) * SNAP_MINUTES;
    const snappedHour = Math.floor(totalMin / 60);
    const snappedMin = totalMin % 60;

    const [year, month, day] = new Date(currentDate).toISOString().split("T")[0].split("-").map(Number);
    const startTime = new Date(year, month - 1, day, snappedHour, snappedMin);
    const endTime = new Date(startTime.getTime() + GHOST_DURATION_MIN * 60000);
    onSlotClick(e.clientX, e.clientY, startTime, endTime);
  }, [permissions.canCreate, ghost, currentDate, onSlotClick]);

  if (visibleProviders.length === 0) {
    return (
      <div className="h-[800px] flex items-center justify-center border border-gray-200 rounded-lg bg-gray-50">
        <div className="text-gray-500">No providers configured</div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Provider headers */}
      <div
        className="grid border-b border-gray-200 bg-gray-50"
        style={{
          gridTemplateColumns: `64px repeat(${visibleProviders.length}, minmax(${MIN_COL_WIDTH}px, 1fr))`,
        }}
      >
        {/* Empty corner cell */}
        <div className="border-r border-gray-200" />
        {visibleProviders.map((provider) => (
          <div
            key={provider.id}
            className="px-3 py-3 text-center border-r border-gray-100 last:border-r-0"
          >
            <span className="text-sm font-semibold text-gray-800">{provider.name}</span>
          </div>
        ))}
      </div>

      {/* Time grid — scrollable, defaults to business hours */}
      <div
        ref={scrollContainerRef}
        className="overflow-auto"
        style={{ maxHeight: 800 }}
      >
        <div
          ref={gridRef}
          className="grid relative"
          style={{
            gridTemplateColumns: `64px repeat(${visibleProviders.length}, minmax(${MIN_COL_WIDTH}px, 1fr))`,
            height: GRID_HEIGHT,
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Time gutter */}
          <div className="relative border-r border-gray-200 select-none">
            {HOUR_LABELS.map(({ hour, label, pct }) => (
              <div
                key={hour}
                className="absolute right-2 text-[11px] text-gray-400 font-medium"
                style={{ top: `${pct}%`, transform: "translateY(-50%)" }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Provider columns */}
          {visibleProviders.map((provider) => {
            const providerApts = appointmentsByProvider.get(provider.id) || [];
            return (
              <div
                key={provider.id}
                data-provider-col={provider.id}
                className="relative border-r border-gray-100 last:border-r-0"
                style={{ height: GRID_HEIGHT }}
                onClick={(e) => handleColClick(e, provider.id)}
              >
                {/* Hour grid lines */}
                {HOUR_LABELS.map(({ hour, pct }) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-gray-100"
                    style={{ top: `${pct}%` }}
                  />
                ))}

                {/* Half-hour lines */}
                {HOUR_LABELS.slice(0, -1).map(({ hour }) => {
                  const halfPct = ((hour - DAY_START_HOUR) * 60 + 30) / TOTAL_MINUTES * 100;
                  return (
                    <div
                      key={`half-${hour}`}
                      className="absolute left-0 right-0 border-t border-gray-50"
                      style={{ top: `${halfPct}%` }}
                    />
                  );
                })}

                {/* Events */}
                {providerApts.map((apt) => (
                  <EventBlock
                    key={apt.id}
                    apt={apt}
                    onClick={() => onEventClick(apt.id)}
                  />
                ))}

                {/* Ghost hover block */}
                {ghost && ghost.providerId === provider.id && (
                  <div
                    data-ghost-block
                    onClick={handleGhostClick}
                    className="absolute left-1 right-1 rounded-md cursor-pointer"
                    style={{
                      top: `${ghost.topPct}%`,
                      height: `${ghost.heightPct}%`,
                      border: "2px dashed rgba(147, 51, 234, 0.45)",
                      background: "rgba(147, 51, 234, 0.05)",
                      zIndex: 3,
                      transition: "top 0.06s ease-out",
                      padding: "3px 8px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "rgba(147, 51, 234, 0.6)",
                        userSelect: "none",
                      }}
                    >
                      {ghost.label}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Current time indicator — spans across all provider columns */}
          {nowPct !== null && (
            <div
              className="absolute pointer-events-none"
              style={{
                top: `${nowPct}%`,
                left: 64,
                right: 0,
                height: 2,
                backgroundColor: "#ef4444",
                zIndex: 4,
              }}
            >
              <div
                className="absolute rounded-full"
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: "#ef4444",
                  top: -3,
                  left: -4,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
