"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { Loader2Icon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JourneyPhase, TodayAppointment, TodayPermissions } from "@/lib/actions/today";
import {
  confirmAppointment,
  checkInAppointment,
  beginService,
  completeSession,
  checkOutAppointment,
} from "@/lib/actions/today";
import { updateAppointmentStatus } from "@/lib/actions/appointments";

// Dot colors for each status variant
export const STATUS_DOT_COLORS: Record<string, string> = {
  upcoming: "bg-blue-500",
  confirm: "bg-orange-500",
  here: "bg-yellow-500",
  in_session: "bg-purple-500",
  checkout: "bg-green-500",
  done: "bg-green-500",
  no_show: "bg-red-500",
  cancelled: "bg-gray-400",
};

// Phase pill colors for filter bar
export const PHASE_DOT_COLORS: Record<JourneyPhase | "all", string> = {
  all: "bg-gray-900",
  upcoming: "bg-blue-500",
  here: "bg-yellow-500",
  with_provider: "bg-purple-500",
  done: "bg-green-500",
  no_show: "bg-red-500",
  cancelled: "bg-gray-400",
};

function getStatusVariant(appointment: TodayAppointment): {
  key: string;
  label: string;
  dotColor: string;
} {
  switch (appointment.phase) {
    case "upcoming":
      if (appointment.status === "Scheduled") {
        return { key: "confirm", label: "Confirm", dotColor: STATUS_DOT_COLORS.confirm };
      }
      return { key: "upcoming", label: "Upcoming", dotColor: STATUS_DOT_COLORS.upcoming };
    case "here":
      return { key: "here", label: "Here", dotColor: STATUS_DOT_COLORS.here };
    case "with_provider":
      return { key: "in_session", label: "In Session", dotColor: STATUS_DOT_COLORS.in_session };
    case "done":
      if (appointment.completedAt && !appointment.checkedOutAt) {
        return { key: "checkout", label: "Checkout", dotColor: STATUS_DOT_COLORS.checkout };
      }
      return { key: "done", label: "Done", dotColor: STATUS_DOT_COLORS.done };
    case "no_show":
      return { key: "no_show", label: "No Show", dotColor: STATUS_DOT_COLORS.no_show };
    case "cancelled":
      return { key: "cancelled", label: "Cancelled", dotColor: STATUS_DOT_COLORS.cancelled };
  }
}

type PillAction = {
  label: string;
  action: () => Promise<{ success: boolean; error?: string }>;
  destructive?: boolean;
};

function getAvailableActions(
  appointment: TodayAppointment,
  permissions: TodayPermissions
): PillAction[] {
  const actions: PillAction[] = [];

  switch (appointment.phase) {
    case "upcoming":
      if (permissions.canConfirm && appointment.status === "Scheduled") {
        actions.push({
          label: "Confirm",
          action: () => confirmAppointment(appointment.id),
        });
      }
      if (permissions.canCheckIn) {
        actions.push({
          label: "Check In",
          action: () => checkInAppointment(appointment.id),
        });
      }
      if (permissions.canEdit) {
        actions.push({
          label: "No Show",
          action: () => updateAppointmentStatus(appointment.id, "NoShow"),
          destructive: true,
        });
        actions.push({
          label: "Cancel",
          action: () => updateAppointmentStatus(appointment.id, "Cancelled"),
          destructive: true,
        });
      }
      break;
    case "here":
      if (permissions.canBeginService) {
        actions.push({
          label: "Begin Service",
          action: () => beginService(appointment.id),
        });
      }
      break;
    case "with_provider":
      if (permissions.canCompleteSession) {
        actions.push({
          label: "Complete Session",
          action: () => completeSession(appointment.id),
        });
      }
      break;
    case "done":
      if (permissions.canCheckOut && !appointment.checkedOutAt) {
        actions.push({
          label: "Check Out",
          action: () => checkOutAppointment(appointment.id),
        });
      }
      break;
  }

  return actions;
}

function formatElapsed(from: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(from).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

export function SmartStatusPill({
  appointment,
  permissions,
}: {
  appointment: TodayAppointment;
  permissions: TodayPermissions;
}) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [elapsed, setElapsed] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const variant = getStatusVariant(appointment);
  const actions = getAvailableActions(appointment, permissions);

  // Elapsed time for "here" and "with_provider"
  useEffect(() => {
    const timestampField =
      appointment.phase === "here"
        ? appointment.checkedInAt
        : appointment.phase === "with_provider"
          ? appointment.startedAt
          : null;

    if (!timestampField) {
      setElapsed("");
      return;
    }

    setElapsed(formatElapsed(timestampField));
    const interval = setInterval(() => {
      setElapsed(formatElapsed(timestampField));
    }, 60000);

    return () => clearInterval(interval);
  }, [appointment.phase, appointment.checkedInAt, appointment.startedAt]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handlePillClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (actions.length > 0) {
      if (!open && dropdownRef.current) {
        const rect = dropdownRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        setOpenUpward(spaceBelow < 120);
      }
      setOpen(!open);
    }
  };

  const handleAction = (action: PillAction) => {
    startTransition(async () => {
      await action.action();
      setOpen(false);
    });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handlePillClick}
        disabled={isPending}
        className={cn(
          "w-28 flex-shrink-0 text-left rounded-lg px-2 py-1 transition-colors",
          actions.length > 0 && "hover:bg-gray-100 cursor-pointer",
          actions.length === 0 && "cursor-default",
          isPending && "opacity-60"
        )}
      >
        <div className="flex items-center gap-2">
          {isPending ? (
            <Loader2Icon className="h-3 w-3 animate-spin text-gray-400 flex-shrink-0" />
          ) : (
            <span className={cn("w-2 h-2 rounded-full flex-shrink-0", variant.dotColor)} />
          )}
          <span className="text-xs font-medium text-gray-700">{variant.label}</span>
          {actions.length > 0 && !isPending && (
            <ChevronDownIcon className={cn("h-3 w-3 text-gray-400 flex-shrink-0 transition-transform", open && "rotate-180")} />
          )}
        </div>
        {elapsed && (
          <span className="text-[10px] text-gray-400 ml-4 block">{elapsed}</span>
        )}
      </button>

      {open && actions.length > 0 && (
        <div className={cn(
          "absolute left-0 z-50 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg",
          openUpward ? "bottom-full mb-1" : "top-full mt-1"
        )}>
          {actions.map((action, i) => {
            const prevAction = actions[i - 1];
            const showSeparator = action.destructive && prevAction && !prevAction.destructive;
            return (
              <div key={action.label}>
                {showSeparator && <div className="my-1 border-t border-gray-100" />}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction(action);
                  }}
                  disabled={isPending}
                  className={cn(
                    "flex w-full items-center px-3 py-2 text-sm disabled:opacity-50",
                    action.destructive
                      ? "text-red-600 hover:bg-red-50"
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  {action.label}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
