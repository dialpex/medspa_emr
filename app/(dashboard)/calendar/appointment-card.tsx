"use client";

import type { AppointmentStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

export interface AppointmentCardProps {
  id: string;
  patientName: string;
  providerName: string;
  serviceName: string | null;
  roomName: string | null;
  status: AppointmentStatus;
  onClick?: () => void;
}

// Status color mapping
const STATUS_COLORS: Record<AppointmentStatus, { bg: string; border: string; text: string }> = {
  Scheduled: {
    bg: "bg-blue-50",
    border: "border-l-blue-500",
    text: "text-blue-700",
  },
  Confirmed: {
    bg: "bg-green-50",
    border: "border-l-green-500",
    text: "text-green-700",
  },
  CheckedIn: {
    bg: "bg-yellow-50",
    border: "border-l-yellow-500",
    text: "text-yellow-700",
  },
  InProgress: {
    bg: "bg-purple-50",
    border: "border-l-purple-500",
    text: "text-purple-700",
  },
  Completed: {
    bg: "bg-gray-50",
    border: "border-l-gray-400",
    text: "text-gray-600",
  },
  NoShow: {
    bg: "bg-red-50",
    border: "border-l-red-500",
    text: "text-red-700",
  },
  Cancelled: {
    bg: "bg-gray-100",
    border: "border-l-gray-300",
    text: "text-gray-400",
  },
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  Scheduled: "Scheduled",
  Confirmed: "Confirmed",
  CheckedIn: "Checked In",
  InProgress: "In Progress",
  Completed: "Completed",
  NoShow: "No Show",
  Cancelled: "Cancelled",
};

export function AppointmentCard({
  patientName,
  providerName,
  serviceName,
  roomName,
  status,
  onClick,
}: AppointmentCardProps) {
  const colors = STATUS_COLORS[status];

  return (
    <div
      className={cn(
        "h-full w-full overflow-hidden rounded border-l-4 px-2 py-1 text-xs cursor-pointer transition-shadow hover:shadow-md",
        colors.bg,
        colors.border
      )}
      onClick={onClick}
    >
      <div className="font-semibold truncate text-gray-900">{patientName}</div>
      {serviceName && (
        <div className="truncate text-gray-600">{serviceName}</div>
      )}
      <div className="flex items-center justify-between mt-0.5">
        <span className="truncate text-gray-500">{providerName}</span>
        <span className={cn("text-[10px] font-medium", colors.text)}>
          {STATUS_LABELS[status]}
        </span>
      </div>
      {roomName && (
        <div className="truncate text-gray-400 text-[10px]">{roomName}</div>
      )}
    </div>
  );
}

// Status badge for use in forms/lists
export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const colors = STATUS_COLORS[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colors.bg,
        colors.text
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// Status selector for appointment forms
export function StatusSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: AppointmentStatus;
  onChange: (status: AppointmentStatus) => void;
  disabled?: boolean;
}) {
  const statuses: AppointmentStatus[] = [
    "Scheduled",
    "Confirmed",
    "CheckedIn",
    "InProgress",
    "Completed",
    "NoShow",
    "Cancelled",
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((status) => {
        const colors = STATUS_COLORS[status];
        const isSelected = value === status;

        return (
          <button
            key={status}
            type="button"
            disabled={disabled}
            onClick={() => onChange(status)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full border-2 transition-all",
              isSelected
                ? cn(colors.bg, colors.text, "border-current")
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {STATUS_LABELS[status]}
          </button>
        );
      })}
    </div>
  );
}

export { STATUS_COLORS, STATUS_LABELS };
