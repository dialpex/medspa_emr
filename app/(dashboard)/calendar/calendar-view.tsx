"use client";

// Polyfill for Temporal API (required by @schedule-x)
// Always assign to ensure consistency after hot-reloads (Turbopack)
import { Temporal } from "@js-temporal/polyfill";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).Temporal = Temporal;

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import { createViewDay, createViewWeek } from "@schedule-x/calendar";
import { createEventsServicePlugin } from "@schedule-x/events-service";
import { createDragAndDropPlugin } from "@schedule-x/drag-and-drop";
import { createResizePlugin } from "@schedule-x/resize";
import "@schedule-x/theme-default/dist/index.css";

import {
  updateAppointment,
  type CalendarAppointment,
  type Provider,
  type Room,
  type Service,
} from "@/lib/actions/appointments";
import { AppointmentForm } from "./appointment-form";
import { AppointmentPanel } from "./appointment-panel";
import { STATUS_COLORS } from "./appointment-card";
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
  } | undefined;

  const status = customData?.status || "Scheduled";
  const colors = STATUS_EVENT_COLORS[status];
  const patientName = customData?.patientName || (calendarEvent.title as string) || "";
  const serviceName = customData?.serviceName || "";

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
  services: Service[];
  currentDate: string; // ISO string from server
  view: "day" | "week";
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

  // Panel state (view/edit existing appointment)
  const [panelAppointmentId, setPanelAppointmentId] = useState<string | null>(null);

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
    key={`${view}-${currentDate}`}
    appointments={appointments}
    providers={providers}
    rooms={rooms}
    services={services}
    currentDate={currentDate}
    view={view}
    permissions={permissions}
    formState={formState}
    setFormState={setFormState}
    panelAppointmentId={panelAppointmentId}
    setPanelAppointmentId={setPanelAppointmentId}
  />;
}

// Inner component that only renders on client
function CalendarInner({
  appointments,
  providers,
  rooms,
  services,
  currentDate,
  view,
  permissions,
  formState,
  setFormState,
  panelAppointmentId,
  setPanelAppointmentId,
}: CalendarViewProps & {
  formState: { isOpen: boolean; initialStartTime?: Date; initialEndTime?: Date };
  setFormState: React.Dispatch<React.SetStateAction<{ isOpen: boolean; initialStartTime?: Date; initialEndTime?: Date }>>;
  panelAppointmentId: string | null;
  setPanelAppointmentId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const router = useRouter();

  // Events service plugin for managing events
  const eventsService = useMemo(() => createEventsServicePlugin(), []);

  // Convert appointments to events (safe on client)
  const events = useMemo(
    () => appointments.map(appointmentToEvent),
    [appointments]
  );

  // Sync events when appointments change (filters, navigation, etc.)
  useEffect(() => {
    if (eventsService.$app) {
      eventsService.set(events);
    }
  }, [events, eventsService]);


  // Create calendar instance
  const calendar = useCalendarApp({
    selectedDate: toPlainDate(currentDate),
    defaultView: view === "day" ? "day" : "week",
    views: [createViewDay(), createViewWeek()],
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

      // Click on empty slot - open create form
      onClickDateTime: (dateTime) => {
        if (!permissions.canCreate) return;

        try {
          // dateTime is a "fake-UTC" ZonedDateTime — interpret as local time
          const zdt = dateTime as unknown as Temporal.ZonedDateTime;
          const startTime = utcZonedDateTimeToLocalDate(zdt);
          const endTime = new Date(startTime.getTime() + 30 * 60000); // +30 min default

          setFormState({
            isOpen: true,
            initialStartTime: startTime,
            initialEndTime: endTime,
          });
        } catch (err) {
          console.error("[Calendar] onClickDateTime error:", err, dateTime);
          // Fallback: open form with current time
          const now = new Date();
          setFormState({
            isOpen: true,
            initialStartTime: now,
            initialEndTime: new Date(now.getTime() + 30 * 60000),
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

        router.refresh();
      },
    },
    dayBoundaries: {
      start: "07:00",
      end: "20:00",
    },
    weekOptions: {
      gridHeight: 800,
      nDays: 7,
      eventWidth: 95,
    },
  });

  // Close form handler
  const handleCloseForm = useCallback(() => {
    setFormState({ isOpen: false });
  }, [setFormState]);

  return (
    <div className="calendar-wrapper">
      {/* Custom styles */}
      <style jsx global>{`
        .sx-react-calendar-wrapper {
          height: 800px;
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
      `}</style>

      {/* Calendar */}
      <ScheduleXCalendar
        calendarApp={calendar}
        customComponents={{ timeGridEvent: TimeGridEvent }}
      />

      {/* Appointment Panel (slide-out for existing appointments) */}
      <AppointmentPanel
        appointmentId={panelAppointmentId}
        onClose={() => setPanelAppointmentId(null)}
        providers={providers}
        rooms={rooms}
        services={services}
        permissions={permissions}
      />

      {/* Appointment Form Modal (create new only) */}
      <AppointmentForm
        isOpen={formState.isOpen}
        onClose={handleCloseForm}
        providers={providers}
        rooms={rooms}
        services={services}
        permissions={permissions}
        initialStartTime={formState.initialStartTime}
        initialEndTime={formState.initialEndTime}
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
