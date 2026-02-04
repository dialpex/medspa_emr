"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { Loader2Icon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JourneyPhase, TodayAppointment, TodayPermissions } from "@/lib/actions/today";
import {
  confirmAppointment,
  checkInAppointment,
  startSession,
  completeSession,
  checkOutAppointment,
} from "@/lib/actions/today";

const PHASE_CONFIG: Record<
  JourneyPhase,
  { label: string; bg: string; text: string; border: string }
> = {
  upcoming: {
    label: "Upcoming",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  here: {
    label: "Here",
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-200",
  },
  with_provider: {
    label: "With Provider",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  done: {
    label: "Done",
    bg: "bg-gray-100",
    text: "text-gray-600",
    border: "border-gray-200",
  },
};

export const PHASE_BORDER_COLORS: Record<JourneyPhase, string> = {
  upcoming: "border-l-blue-400",
  here: "border-l-yellow-400",
  with_provider: "border-l-purple-400",
  done: "border-l-gray-300",
};

type PillAction = {
  label: string;
  action: () => Promise<{ success: boolean; error?: string }>;
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
      break;
    case "here":
      if (permissions.canStartSession) {
        actions.push({
          label: "Start Session",
          action: () => startSession(appointment.id),
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
  const [isPending, startTransition] = useTransition();
  const [elapsed, setElapsed] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const config = PHASE_CONFIG[appointment.phase];
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
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors",
          config.bg,
          config.text,
          config.border,
          actions.length > 0 && "cursor-pointer hover:shadow-sm",
          actions.length === 0 && "cursor-default",
          isPending && "opacity-60"
        )}
      >
        {isPending ? (
          <Loader2Icon className="h-3 w-3 animate-spin" />
        ) : null}
        <span>{config.label}</span>
        {elapsed && (
          <span className="opacity-70">&middot; {elapsed}</span>
        )}
        {actions.length > 0 && !isPending && (
          <ChevronDownIcon className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        )}
      </button>

      {open && actions.length > 0 && (
        <div className="absolute right-0 z-50 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={(e) => {
                e.stopPropagation();
                handleAction(action);
              }}
              disabled={isPending}
              className="flex w-full items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
