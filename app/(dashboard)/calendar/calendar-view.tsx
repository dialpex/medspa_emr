"use client";

// Polyfill for Temporal API (required by @schedule-x)
// Always assign to ensure consistency after hot-reloads (Turbopack)
import { Temporal } from "@js-temporal/polyfill";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).Temporal = Temporal;

import { useState, useCallback, useMemo, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import { createViewDay, createViewWeek, createViewMonthGrid } from "@schedule-x/calendar";
import { createEventsServicePlugin } from "@schedule-x/events-service";
import { createDragAndDropPlugin } from "@schedule-x/drag-and-drop";
import { createResizePlugin } from "@schedule-x/resize";
import "@schedule-x/theme-default/dist/index.css";

import {
  updateAppointment,
  type CalendarAppointment,
  type Provider,
  type Room,
  type ResourceOption,
  type Service,
} from "@/lib/actions/appointments";
import { BlockTimeForm } from "./block-time-form";
import { AppointmentForm } from "./appointment-form";
import { AppointmentPanel } from "./appointment-panel";
import { STATUS_COLORS } from "./appointment-card";
import { ProviderDayView } from "./provider-day-view";
import type { AppointmentStatus } from "@prisma/client";

// Status → CSS color vars for schedule-x events
const STATUS_EVENT_COLORS: Record<AppointmentStatus, { bg: string; border: string; text: string }> = {
  Scheduled: { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  Confirmed: { bg: "#dcfce7", border: "#22c55e", text: "#166534" },
  CheckedIn: { bg: "#fef9c3", border: "#eab308", text: "#854d0e" },
  InProgress: { bg: "#f3e8ff", border: "#a855f7", text: "#6b21a8" },
  Completed: { bg: "#f3f4f6", border: "#9ca3af", text: "#4b5563" },
  NoShow: { bg: "#fee2e2", border: "#ef4444", text: "#991b1b" },
  Cancelled: { bg: "#f3f4f6", border: "#d1d5db", text: "#9ca3af" },
};

// Format time for event display (e.g. "1:15pm")
function formatEventTime(date: Date | string): string {
  const d = new Date(date);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;
  const minuteStr = minutes > 0 ? `:${String(minutes).padStart(2, "0")}` : "";
  return `${hours}${minuteStr}${ampm}`;
}

// Custom event component for the time grid
function TimeGridEvent({ calendarEvent }: { calendarEvent: Record<string, unknown> }) {
  const customData = calendarEvent._customData as {
    patientName: string;
    serviceName: string | null;
    status: AppointmentStatus;
    startTimeDisplay?: string;
    isRecurring?: boolean;
    isBlock?: boolean;
    blockTitle?: string | null;
  } | undefined;

  const isBlock = customData?.isBlock;
  const status = customData?.status || "Scheduled";
  const colors = isBlock
    ? { bg: "#f3f4f6", border: "#9ca3af", text: "#4b5563" }
    : STATUS_EVENT_COLORS[status];
  const patientName = isBlock ? (customData?.blockTitle || "Block") : (customData?.patientName || (calendarEvent.title as string) || "");
  const serviceName = isBlock ? "" : (customData?.serviceName || "");

  // Use pre-computed display time from _customData, fall back to extraction
  const start = calendarEvent.start as unknown as Temporal.ZonedDateTime;
  let timeStr = customData?.startTimeDisplay || "";
  if (!timeStr) {
    try {
      timeStr = formatEventTime(utcZonedDateTimeToLocalDate(start));
    } catch {
      timeStr = "";
    }
  }

  // Check if this is a compact (short) event
  const startMs = start ? Number(start.epochMilliseconds) : 0;
  const end = calendarEvent.end as unknown as Temporal.ZonedDateTime;
  const endMs = end ? Number(end.epochMilliseconds) : 0;
  const durationMin = startMs && endMs ? (endMs - startMs) / 60000 : 30;
  const isCompact = durationMin <= 30;

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        backgroundColor: colors.bg,
        borderLeft: `3px solid ${colors.border}`,
        borderRadius: "4px",
        padding: isCompact ? "2px 6px" : "4px 8px",
        overflow: "hidden",
        cursor: "pointer",
        color: colors.text,
        fontSize: "12px",
        lineHeight: isCompact ? "1.3" : "1.4",
      }}
    >
      {isCompact ? (
        // Compact: single line — time  Name  Service
        <div style={{ display: "flex", gap: "6px", alignItems: "baseline", whiteSpace: "nowrap", overflow: "hidden" }}>
          <span style={{ opacity: 0.8, flexShrink: 0 }}>{timeStr}</span>
          {customData?.isRecurring && <span style={{ opacity: 0.6, flexShrink: 0, fontSize: "10px" }} title="Recurring">↻</span>}
          <span style={{ fontWeight: 600 }}>{patientName}</span>
          {serviceName && (
            <span style={{ opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis" }}>{serviceName}</span>
          )}
        </div>
      ) : (
        // Full: time + service on first line, name bold below
        <>
          <div style={{ display: "flex", gap: "6px", alignItems: "baseline", fontSize: "11px", overflow: "hidden", whiteSpace: "nowrap" }}>
            <span style={{ opacity: 0.8, flexShrink: 0 }}>{timeStr}</span>
            {customData?.isRecurring && <span style={{ opacity: 0.6, flexShrink: 0 }} title="Recurring">↻</span>}
            {serviceName && (
              <span style={{ opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis" }}>{serviceName}</span>
            )}
          </div>
          <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{patientName}</div>
        </>
      )}
    </div>
  );
}

export type CalendarViewProps = {
  appointments: CalendarAppointment[];
  providers: Provider[];
  rooms: Room[];
  resources: ResourceOption[];
  services: Service[];
  currentDate: string; // ISO string from server
  view: "day" | "week" | "month";
  permissions: {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
};

// Convert Temporal.ZonedDateTime to Date
function zonedDateTimeToDate(zdt: Temporal.ZonedDateTime): Date {
  return new Date(zdt.epochMilliseconds);
}

// Build a Temporal.ZonedDateTime in UTC using the browser's *local* time
// components.  This makes .hour and epochMilliseconds agree on the same
// clock value, so schedule-x positions events where the user expects them
// (no UTC ↔ local offset).
function dateToUtcZonedDateTime(date: Date | string): Temporal.ZonedDateTime {
  const d = new Date(date);
  return Temporal.PlainDateTime.from({
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
  }).toZonedDateTime("UTC");
}

// Reverse: convert a "fake-UTC" ZonedDateTime back to a real local Date
function utcZonedDateTimeToLocalDate(zdt: Temporal.ZonedDateTime): Date {
  // The hour/minute stored in the ZDT represent local wall-clock time
  return new Date(zdt.year, zdt.month - 1, zdt.day, zdt.hour, zdt.minute, zdt.second);
}

// Minimum visual duration for events (30 minutes in ms)
const MIN_DISPLAY_DURATION_MS = 30 * 60 * 1000;

// Convert appointment to schedule-x event format
function appointmentToEvent(apt: CalendarAppointment) {
  const startMs = new Date(apt.startTime).getTime();
  const endMs = new Date(apt.endTime).getTime();
  // Enforce minimum 30-minute visual size
  const displayEndMs = Math.max(endMs, startMs + MIN_DISPLAY_DURATION_MS);

  return {
    id: apt.id,
    title: apt.patientName,
    start: dateToUtcZonedDateTime(apt.startTime),
    end: dateToUtcZonedDateTime(new Date(displayEndMs)),
    _customData: {
      patientId: apt.patientId,
      patientName: apt.patientName,
      providerId: apt.providerId,
      providerName: apt.providerName,
      serviceId: apt.serviceId,
      serviceName: apt.serviceName,
      roomId: apt.roomId,
      roomName: apt.roomName,
      status: apt.status,
      notes: apt.notes,
      startTimeDisplay: formatEventTime(apt.startTime),
      isRecurring: !!apt.recurrenceGroupId,
      isBlock: apt.isBlock,
      blockTitle: apt.blockTitle,
    },
  };
}

// Convert date to Temporal.PlainDate for schedule-x selectedDate
function toPlainDate(date: Date | string): Temporal.PlainDate {
  const d = new Date(date);

  // Check for invalid date - fallback to today
  if (isNaN(d.getTime())) {
    console.error("[Calendar] Invalid date received:", date);
    const today = new Date();
    return Temporal.PlainDate.from({
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      day: today.getDate(),
    });
  }

  return Temporal.PlainDate.from({
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  });
}

export function CalendarView({
  appointments,
  providers,
  rooms,
  resources,
  services,
  currentDate,
  view,
  permissions,
}: CalendarViewProps) {
  const router = useRouter();

  // Track if component has mounted (client-side only)
  const [isMounted, setIsMounted] = useState(false);

  // Form modal state (create only)
  const [formState, setFormState] = useState<{
    isOpen: boolean;
    initialStartTime?: Date;
    initialEndTime?: Date;
  }>({ isOpen: false });

  // Block time form state
  const [blockFormState, setBlockFormState] = useState<{
    isOpen: boolean;
    initialStartTime?: Date;
    initialEndTime?: Date;
  }>({ isOpen: false });

  // Slot menu state (choose between appointment or block)
  const [slotMenu, setSlotMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    startTime?: Date;
    endTime?: Date;
  }>({ isOpen: false, x: 0, y: 0 });

  // Panel state (view/edit existing appointment)
  const [panelAppointmentId, setPanelAppointmentId] = useState<string | null>(null);

  // Key includes view + appointment fingerprint so the calendar remounts
  // when data changes (new appointment created) but NOT on date navigation
  const dataFingerprint = useMemo(
    () => appointments.map((a) => a.id).sort().join(","),
    [appointments]
  );

  // Set mounted flag after hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Don't render calendar until client-side (schedule-x requires Temporal polyfill)
  if (!isMounted) {
    return (
      <div className="h-[800px] flex items-center justify-center border border-gray-200 rounded-lg bg-gray-50">
        <div className="text-gray-500">Loading calendar...</div>
      </div>
    );
  }

  return <CalendarInner
    key={`${view}-${dataFingerprint}`}
    appointments={appointments}
    providers={providers}
    rooms={rooms}
    resources={resources}
    services={services}
    currentDate={currentDate}
    view={view}
    permissions={permissions}
    formState={formState}
    setFormState={setFormState}
    blockFormState={blockFormState}
    setBlockFormState={setBlockFormState}
    slotMenu={slotMenu}
    setSlotMenu={setSlotMenu}
    panelAppointmentId={panelAppointmentId}
    setPanelAppointmentId={setPanelAppointmentId}
  />;
}

// Inner component that only renders on client
function CalendarInner({
  appointments,
  providers,
  rooms,
  resources,
  services,
  currentDate,
  view,
  permissions,
  formState,
  setFormState,
  blockFormState,
  setBlockFormState,
  slotMenu,
  setSlotMenu,
  panelAppointmentId,
  setPanelAppointmentId,
}: CalendarViewProps & {
  formState: { isOpen: boolean; initialStartTime?: Date; initialEndTime?: Date };
  setFormState: React.Dispatch<React.SetStateAction<{ isOpen: boolean; initialStartTime?: Date; initialEndTime?: Date }>>;
  blockFormState: { isOpen: boolean; initialStartTime?: Date; initialEndTime?: Date };
  setBlockFormState: React.Dispatch<React.SetStateAction<{ isOpen: boolean; initialStartTime?: Date; initialEndTime?: Date }>>;
  slotMenu: { isOpen: boolean; x: number; y: number; startTime?: Date; endTime?: Date };
  setSlotMenu: React.Dispatch<React.SetStateAction<{ isOpen: boolean; x: number; y: number; startTime?: Date; endTime?: Date }>>;
  panelAppointmentId: string | null;
  setPanelAppointmentId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Track last mouse click position so onClickDateTime can position the menu.
  // We capture on both mousedown and click (capture phase) with a timestamp
  // so we can verify freshness — schedule-x sometimes fires onClickDateTime
  // asynchronously after internal processing.
  const lastClickPos = useRef<{ x: number; y: number; ts: number }>({ x: 0, y: 0, ts: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      lastClickPos.current = { x: e.clientX, y: e.clientY, ts: Date.now() };
    };
    // Capture on both phases to ensure we get it before schedule-x processes
    document.addEventListener("mousedown", handler, true);
    document.addEventListener("click", handler, true);
    return () => {
      document.removeEventListener("mousedown", handler, true);
      document.removeEventListener("click", handler, true);
    };
  }, []);

  // Events service plugin for managing events
  const eventsService = useMemo(() => createEventsServicePlugin(), []);

  // Convert appointments to events (safe on client)
  const events = useMemo(
    () => appointments.map(appointmentToEvent),
    [appointments]
  );

  // Sync selected date when navigating (without remounting).
  // The key does NOT include currentDate, so date changes don't remount —
  // we update schedule-x's internal date here instead.
  const currentPlainDate = useMemo(() => toPlainDate(currentDate), [currentDate]);
  const isFirstRender = useRef(true);
  useEffect(() => {
    // Skip first render — selectedDate is already set in config
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (calendar as any).datePickerState?.select(currentPlainDate);
    } catch {
      // Some schedule-x versions may not expose datePickerState
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlainDate]);

  // Create calendar instance
  const calendar = useCalendarApp({
    selectedDate: toPlainDate(currentDate),
    defaultView: view === "day" ? "day" : view === "month" ? "month-grid" : "week",
    views: [createViewDay(), createViewWeek(), createViewMonthGrid()],
    events: events,
    plugins: [
      eventsService,
      ...(permissions.canEdit ? [createDragAndDropPlugin(), createResizePlugin()] : []),
    ],
    callbacks: {
      // Click on event - open slide-out panel
      onEventClick: (calendarEvent) => {
        setPanelAppointmentId(calendarEvent.id as string);
      },

      // Click on empty slot - show menu to choose appointment or block
      onClickDateTime: (dateTime) => {
        if (!permissions.canCreate) return;

        try {
          const zdt = dateTime as unknown as Temporal.ZonedDateTime;
          const startTime = utcZonedDateTimeToLocalDate(zdt);
          const endTime = new Date(startTime.getTime() + 30 * 60000);

          // Use captured click position if fresh (within 500ms), otherwise
          // compute position from the time grid DOM based on the clicked time
          const pos = lastClickPos.current;
          const isFresh = Date.now() - pos.ts < 500;
          let x: number, y: number;

          if (isFresh && pos.x > 0) {
            x = pos.x;
            y = pos.y;
          } else {
            // Fallback: compute from time grid geometry
            const hour = startTime.getHours();
            const minute = startTime.getMinutes();
            const dateStr = `${startTime.getFullYear()}-${String(startTime.getMonth() + 1).padStart(2, "0")}-${String(startTime.getDate()).padStart(2, "0")}`;
            const dayCol = document.querySelector<HTMLElement>(`.sx__time-grid-day[data-time-grid-date="${dateStr}"]`);
            if (dayCol) {
              const rect = dayCol.getBoundingClientRect();
              const totalHours = 24; // dayBoundaries
              const pct = (hour * 60 + minute) / (totalHours * 60);
              x = rect.left + rect.width / 2;
              y = rect.top + pct * rect.height;
            } else {
              x = window.innerWidth / 2;
              y = window.innerHeight / 3;
            }
          }

          setSlotMenu({ isOpen: true, x, y, startTime, endTime });
        } catch (err) {
          console.error("[Calendar] onClickDateTime error:", err, dateTime);
          const now = new Date();
          const pos = lastClickPos.current;
          const isFresh = Date.now() - pos.ts < 500;
          setSlotMenu({
            isOpen: true,
            x: isFresh ? pos.x : window.innerWidth / 2,
            y: isFresh ? pos.y : window.innerHeight / 3,
            startTime: now,
            endTime: new Date(now.getTime() + 30 * 60000),
          });
        }
      },

      // Drag and drop - update appointment times
      onEventUpdate: async (updatedEvent) => {
        if (!permissions.canEdit) return;

        // start/end are "fake-UTC" ZonedDateTimes whose h/m represent local time
        const startZdt = updatedEvent.start as unknown as Temporal.ZonedDateTime;
        const endZdt = updatedEvent.end as unknown as Temporal.ZonedDateTime;
        const startTime = utcZonedDateTimeToLocalDate(startZdt);
        const endTime = utcZonedDateTimeToLocalDate(endZdt);

        await updateAppointment(updatedEvent.id as string, {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        });

        startTransition(() => { router.refresh(); });
      },
    },
    dayBoundaries: {
      start: "00:00",
      end: "24:00",
    },
    weekOptions: {
      gridHeight: 1488, // 62px/hour × 24hrs — same density as day view
      nDays: 7,
      eventWidth: 95,
    },
  });

  // Close form handler
  const handleCloseForm = useCallback(() => {
    setFormState({ isOpen: false });
  }, [setFormState]);

  // Memoize customComponents so ScheduleXCalendar doesn't re-mount
  // the calendar DOM on every render (its useEffect depends on this ref)
  const customComponents = useMemo(() => ({ timeGridEvent: TimeGridEvent }), []);

  // Auto-scroll week view to business hours (7 AM)
  useEffect(() => {
    if (view === "day") return; // day view handles its own scroll
    const timer = setTimeout(() => {
      const wrapper = document.querySelector<HTMLElement>(".sx-react-calendar-wrapper");
      if (!wrapper) return;
      // 1488px grid / 24 hours = 62px/hour; scroll to 7 AM
      wrapper.scrollTop = 7 * 62;
    }, 100);
    return () => clearTimeout(timer);
  }, [view, currentDate]);

  // --- Hover ghost block ---
  const ghostDataRef = useRef<{ startTime: Date; endTime: Date } | null>(null);
  const ghostElRef = useRef<HTMLDivElement | null>(null);
  const DAY_START_HOUR = 0;
  const DAY_END_HOUR = 24;
  const GHOST_DURATION_MIN = 30;
  const SNAP_MINUTES = 15;

  useEffect(() => {
    if (!permissions.canCreate) return;
    if (view === "month" || view === "day") return;

    // Create ghost element once
    let ghost = ghostElRef.current;
    if (!ghost) {
      ghost = document.createElement("div");
      ghost.className = "calendar-ghost-block";
      ghost.innerHTML = '<span class="ghost-label"></span>';
      ghostElRef.current = ghost;
    }

    let currentDayCol: HTMLElement | null = null;

    const showGhost = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Don't show ghost when hovering over an existing event
      if (target.closest(".sx__time-grid-event, .sx__time-grid-event-inner")) {
        if (ghost!.parentElement) ghost!.style.display = "none";
        return;
      }

      const dayCol = target.closest<HTMLElement>(".sx__time-grid-day");
      if (!dayCol) {
        if (ghost!.parentElement) ghost!.style.display = "none";
        return;
      }

      const dateStr = dayCol.getAttribute("data-time-grid-date");
      if (!dateStr) { ghost!.style.display = "none"; return; }

      // Move ghost into the day column if needed
      if (currentDayCol !== dayCol) {
        dayCol.appendChild(ghost!);
        currentDayCol = dayCol;
      }

      const rect = dayCol.getBoundingClientRect();
      const relY = e.clientY - rect.top;
      const totalHours = DAY_END_HOUR - DAY_START_HOUR;
      const hourFloat = DAY_START_HOUR + (relY / rect.height) * totalHours;

      // Snap to nearest SNAP_MINUTES
      const totalMinutes = Math.round((hourFloat * 60) / SNAP_MINUTES) * SNAP_MINUTES;
      const snappedHour = Math.floor(totalMinutes / 60);
      const snappedMin = totalMinutes % 60;

      if (snappedHour < DAY_START_HOUR || snappedHour >= DAY_END_HOUR) {
        ghost!.style.display = "none";
        return;
      }

      const topPct = ((snappedHour - DAY_START_HOUR) * 60 + snappedMin) / (totalHours * 60) * 100;
      const heightPct = GHOST_DURATION_MIN / (totalHours * 60) * 100;

      ghost!.style.display = "block";
      ghost!.style.top = `${topPct}%`;
      ghost!.style.height = `${heightPct}%`;

      // Time label
      const h12 = snappedHour % 12 || 12;
      const ampm = snappedHour >= 12 ? "pm" : "am";
      const minStr = snappedMin > 0 ? `:${String(snappedMin).padStart(2, "0")}` : "";
      ghost!.querySelector<HTMLElement>(".ghost-label")!.textContent = `${h12}${minStr}${ampm}`;

      // Store for click
      const [year, month, day] = dateStr.split("-").map(Number);
      const startTime = new Date(year, month - 1, day, snappedHour, snappedMin);
      const endTime = new Date(startTime.getTime() + GHOST_DURATION_MIN * 60000);
      ghostDataRef.current = { startTime, endTime };
    };

    const hideGhost = () => {
      if (ghost!.parentElement) ghost!.style.display = "none";
      ghostDataRef.current = null;
    };

    const handleGhostClick = (e: MouseEvent) => {
      if (!ghostDataRef.current) return;
      e.stopPropagation();
      e.preventDefault();
      const { startTime, endTime } = ghostDataRef.current;
      ghost!.style.display = "none";
      setSlotMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        startTime,
        endTime,
      });
    };

    const wrapper = document.querySelector<HTMLElement>(".sx-react-calendar-wrapper");
    if (!wrapper) return;

    wrapper.addEventListener("mousemove", showGhost);
    wrapper.addEventListener("mouseleave", hideGhost);
    ghost.addEventListener("click", handleGhostClick);

    return () => {
      wrapper.removeEventListener("mousemove", showGhost);
      wrapper.removeEventListener("mouseleave", hideGhost);
      ghost!.removeEventListener("click", handleGhostClick);
      if (ghost!.parentElement) ghost!.parentElement.removeChild(ghost!);
      currentDayCol = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendar, view, permissions.canCreate]);

  return (
    <div className="calendar-wrapper">
      {/* Custom styles */}
      <style jsx global>{`
        .sx-react-calendar-wrapper {
          height: 800px;
          overflow-y: auto;
        }
        .sx-react-calendar-wrapper .sx-calendar {
          border-radius: 0.5rem;
          border: 1px solid #e5e7eb;
        }
        .sx-react-calendar-wrapper .sx-event {
          border-radius: 4px;
          cursor: pointer;
          transition: box-shadow 0.2s;
          overflow: hidden;
        }
        .sx-react-calendar-wrapper .sx-event:hover {
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        /* Remove default padding since custom component handles it */
        .sx-react-calendar-wrapper .sx__time-grid-event-inner {
          padding: 0;
        }
        /* Time grid styling */
        .sx-react-calendar-wrapper .sx-time-grid-day {
          min-height: 60px;
        }
        .sx-react-calendar-wrapper .sx-current-time-indicator {
          background-color: #ef4444;
        }
        /* Hide built-in Schedule-X header — we use our own */
        .sx-react-calendar-wrapper .sx__calendar-header {
          display: none;
        }
        /* Month grid styling */
        .sx-react-calendar-wrapper .sx__month-grid-day {
          min-height: 100px;
        }
        .sx-react-calendar-wrapper .sx__month-grid-event {
          font-size: 12px;
          border-radius: 4px;
          cursor: pointer;
        }
        /* Make time grid days position:relative for ghost overlay */
        .sx-react-calendar-wrapper .sx__time-grid-day {
          position: relative;
        }
        /* Ghost hover block — injected into day columns */
        .calendar-ghost-block {
          display: none;
          position: absolute;
          left: 2px;
          right: 2px;
          pointer-events: auto;
          cursor: pointer;
          z-index: 5;
          border: 2px dashed rgba(147, 51, 234, 0.45);
          background: rgba(147, 51, 234, 0.05);
          border-radius: 6px;
          padding: 3px 8px;
          box-sizing: border-box;
          transition: top 0.06s ease-out;
        }
        .calendar-ghost-block:hover {
          border-color: rgba(147, 51, 234, 0.7);
          background: rgba(147, 51, 234, 0.1);
        }
        .calendar-ghost-block .ghost-label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(147, 51, 234, 0.6);
          user-select: none;
        }
      `}</style>

      {/* Calendar — custom provider-column view for day, schedule-x for week/month */}
      {view === "day" ? (
        <ProviderDayView
          appointments={appointments}
          providers={providers}
          currentDate={currentDate}
          permissions={permissions}
          onEventClick={(id) => setPanelAppointmentId(id)}
          onSlotClick={(x, y, start, end) =>
            setSlotMenu({ isOpen: true, x, y, startTime: start, endTime: end })
          }
        />
      ) : (
        <ScheduleXCalendar
          calendarApp={calendar}
          customComponents={customComponents}
        />
      )}

      {/* Appointment Panel (slide-out for existing appointments) */}
      <AppointmentPanel
        appointmentId={panelAppointmentId}
        onClose={() => setPanelAppointmentId(null)}
        providers={providers}
        rooms={rooms}
        resources={resources}
        services={services}
        permissions={permissions}
      />

      {/* Slot Menu — choose Appointment or Block Time */}
      {slotMenu.isOpen && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setSlotMenu({ isOpen: false, x: 0, y: 0 })} />
          <div
            className="fixed z-50 bg-white rounded-lg border border-gray-200 shadow-lg py-1 w-52"
            style={{
              left: Math.max(8, Math.min(slotMenu.x - 104, window.innerWidth - 216)),
              top: Math.max(8, Math.min(slotMenu.y, window.innerHeight - 120)),
            }}
          >
            <button
              className="w-full px-4 py-2.5 text-sm text-left hover:bg-gray-50 flex items-center gap-3 font-medium text-gray-900"
              onClick={() => {
                setSlotMenu({ isOpen: false, x: 0, y: 0 });
                setFormState({
                  isOpen: true,
                  initialStartTime: slotMenu.startTime,
                  initialEndTime: slotMenu.endTime,
                });
              }}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              New Appointment
            </button>
            <button
              className="w-full px-4 py-2.5 text-sm text-left hover:bg-gray-50 flex items-center gap-3 font-medium text-gray-900"
              onClick={() => {
                setSlotMenu({ isOpen: false, x: 0, y: 0 });
                setBlockFormState({
                  isOpen: true,
                  initialStartTime: slotMenu.startTime,
                  initialEndTime: slotMenu.endTime,
                });
              }}
            >
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              Block Time
            </button>
          </div>
        </>
      )}

      {/* Appointment Form Modal (create new only) */}
      <AppointmentForm
        isOpen={formState.isOpen}
        onClose={handleCloseForm}
        providers={providers}
        rooms={rooms}
        resources={resources}
        services={services}
        permissions={permissions}
        initialStartTime={formState.initialStartTime}
        initialEndTime={formState.initialEndTime}
      />

      {/* Block Time Form Modal */}
      <BlockTimeForm
        isOpen={blockFormState.isOpen}
        onClose={() => setBlockFormState({ isOpen: false })}
        providers={providers}
        initialStartTime={blockFormState.initialStartTime}
        initialEndTime={blockFormState.initialEndTime}
      />

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span>Scheduled</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span>Confirmed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-500" />
          <span>Checked In</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-purple-500" />
          <span>In Progress</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-400" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span>No Show</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-300" />
          <span>Cancelled</span>
        </div>
      </div>
    </div>
  );
}
